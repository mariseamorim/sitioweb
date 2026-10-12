const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-11T15:00:00Z'])) }
  static now() { return new Date('2026-10-11T15:00:00Z').getTime() }
}
let animals = [], productions = [], counter = 0, editable = true
const farm = { id: 'farm', milkPrice: 2.5 }
const matches = (a, where) => Object.entries(where).every(([k, v]) => {
  if (v instanceof Date) return a[k]?.getTime() === v.getTime()
  if (v && typeof v === 'object') return v.not !== undefined ? a[k] !== v.not : v.in ? v.in.includes(a[k]) : true
  return a[k] === v
})
const prisma = {
  animal: {
    findMany: async ({ where }) => animals.filter(a => matches(a, where)),
    findFirst: async ({ where }) => animals.find(a => matches(a, where)) || null,
    count: async ({ where }) => animals.filter(a => matches(a, where)).length,
    create: async ({ data }) => { const a = { id: `a${++counter}`, ...data }; animals.push(a); return a },
    update: async ({ where, data }) => { const a = animals.find(a => matches(a, where)); Object.entries(data).forEach(([k, v]) => { if (v !== undefined) a[k] = v }); return a },
  },
  milkProduction: {
    findFirst: async ({ where }) => productions.find(p => matches(p, where)) || null,
    create: async ({ data }) => { const p = { id: `p${++counter}`, animal: null, ...data }; productions.push(p); return p },
    update: async ({ where, data }) => { const p = productions.find(p => matches(p, where)); Object.entries(data).forEach(([k, v]) => { if (v !== undefined) p[k] = v }); return p },
    createMany: async ({ data }) => { for (const entry of data) await prisma.milkProduction.create({ data: entry }); return { count: data.length } },
  },
  farm: { findUnique: async () => farm, update: async ({ data }) => Object.assign(farm, data) },
  reproduction: { findFirst: async () => null },
}
const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date: TestDate, Intl, Request, Response, console, require: name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return { requireFarmAccess: async (_, mode) => mode === 'edit' && !editable ? { error: Response.json({ error: 'Acesso negado' }, { status: 403 }) } : { farmId: 'farm' }, notFound: message => Response.json({ error: message }, { status: 404 }) }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error(name)
  } }, { filename: path })
  modules[path] = exports
  return exports
}
const rules = load('src/lib/animalRules.ts')
const validation = load('src/lib/milkValidation.ts')
const animalAPI = load('src/app/api/animals/route.ts')
const animalEdit = load('src/app/api/animals/[id]/route.ts')
const milkAPI = load('src/app/api/milk-production/route.ts')
const milkEdit = load('src/app/api/milk-production/[id]/route.ts')
const milkBatch = load('src/app/api/milk-production/batch/route.ts')
const priceAPI = load('src/app/api/milk-production/price/route.ts')
const request = data => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
const params = id => ({ params: Promise.resolve({ id }) })
const baseAnimal = { name: 'Animal', species: 'Bezerro', gender: 'Fêmea', birthDate: '2024-04-11', status: 'Vivo' }
async function main() {
  for (const species of ['Boi', 'Boi de engorda', 'Touro']) {
    assert.equal(rules.fixedAnimalGender(species), 'Macho')
    assert.equal((await animalAPI.POST(request({ ...baseAnimal, species }))).status, 400)
  }
  assert.equal(rules.fixedAnimalGender('Vaca'), 'Fêmea')
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, species: 'Vaca', gender: 'Macho' }))).status, 400)
  assert.equal(rules.fixedAnimalGender('Bezerro'), null)
  assert.equal(rules.canAddCalf({ ...baseAnimal, birthDate: '2024-04-12' }), false)
  assert.equal(rules.canAddCalf(baseAnimal), true)
  assert.equal(rules.animalCategory(baseAnimal), 'Vaca')
  assert.equal(rules.animalCategory({ ...baseAnimal, birthDate: '2024-04-12' }), 'Bezerra')
  assert.equal(rules.animalCategory({ ...baseAnimal, gender: 'Macho', birthDate: '2023-10-12' }), 'Bezerro')
  assert.equal(rules.animalCategory({ ...baseAnimal, gender: 'Macho', birthDate: '2023-10-11' }), 'Touro')
  assert.equal(rules.animalCategory({ ...baseAnimal, gender: 'Macho', isCastrated: true }), 'Boi de engorda')
  assert.equal(rules.canAddCalf({ ...baseAnimal, gender: 'Macho' }), false)
  assert.equal(rules.canAddCalf({ ...baseAnimal, species: 'Cavalo', birthDate: '2018-01-01' }), false)
  assert.equal(rules.hasAnimalAge('2024-02-29', 36, '2027-02-27'), false)
  assert.equal(rules.hasAnimalAge('2024-02-29', 36, '2027-02-28'), true)
  assert.equal(rules.validAnimalDate('2024-02-30'), null)
  assert.equal(rules.validAnimalDate(new TestDate('bad')), null)
  assert.equal(rules.validAnimalDate('2024-02-20junk'), null)

  let res = await animalAPI.POST(request({ ...baseAnimal, acquisitionType: 'compra', species: 'Vaca' }))
  assert.equal(res.status, 400); assert.equal(animals.length, 0)
  res = await animalAPI.POST(request({ ...baseAnimal, acquisitionType: 'compra', species: 'Vaca', birthDate: '2023-10-11' }))
  assert.equal(res.status, 201); assert.equal(animals[0].species, 'Vaca')
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, acquisitionType: 'compra', species: 'Vaca', birthDate: '2021-01-01' }))).status, 201)
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, gender: 'Macho', isCastrated: true }))).status, 201)
  assert.equal(animals.at(-1).species, 'Boi de engorda')
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, isCastrated: true }))).status, 400)
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, birthDate: '2026-10-12' }))).status, 400)

  animals.push({ id: 'young-mother', farmId: 'farm', ...baseAnimal, birthDate: new TestDate('2024-04-12') })
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, motherId: 'young-mother', birthDate: '2026-10-11' }))).status, 400)
  assert.equal((await animalAPI.POST(request({ ...baseAnimal, motherId: animals[0].id, birthDate: '2026-10-11' }))).status, 201)
  assert.equal(animals.at(-1).species, 'Bezerra')
  assert.equal((await animalEdit.PATCH(request({ motherId: 'young-mother' }), params(animals.at(-1).id))).status, 400)
  const bull = animals.find(a => a.species === 'Boi de engorda')
  assert.equal((await animalEdit.PUT(request({ ...baseAnimal, gender: 'Macho', birthDate: '2022-01-01', isCastrated: false }), params(bull.id))).status, 200)
  assert.equal(bull.species, 'Touro')
  assert.equal((await animalEdit.PUT(request({ ...baseAnimal, gender: 'Macho', isCastrated: true }), params(bull.id))).status, 200)
  assert.equal(bull.species, 'Boi de engorda')
  assert.equal((await animalEdit.PUT(request(baseAnimal), params('foreign-animal'))).status, 404)

  res = await milkAPI.POST(request({ date: '2026-10-11', quantity: '100,5' }))
  assert.equal(res.status, 201); assert.equal(productions[0].quantity, 100.5); assert.equal(productions[0].pricePerLiter, 2.5)
  await priceAPI.PUT(request({ price: '3,15' }))
  assert.equal(farm.milkPrice, 3.15); assert.equal(productions[0].pricePerLiter, 2.5)
  assert.equal((await milkAPI.POST(request({ date: '2026-10-11', quantity: 50, pricePerLiter: '2,35' }))).status, 201)
  const production = productions[0]
  res = await milkEdit.PUT(request({ date: '2026-10-10', quantity: '120,5', pricePerLiter: '2,65', cowsMilked: '8', observations: 'Corrigido' }), params(production.id))
  assert.equal(res.status, 200); assert.equal(productions.length, 2)
  assert.equal(production.quantity, 120.5); assert.equal(production.pricePerLiter, 2.65); assert.equal(production.cowsMilked, 8)
  assert.equal(production.date.toISOString().slice(0, 10), '2026-10-10')
  assert.equal((await milkEdit.PUT(request({ quantity: '125,5' }), params(production.id))).status, 200)
  assert.equal(production.pricePerLiter, 2.65)
  for (const data of [{ quantity: 0 }, { quantity: -2 }, { quantity: '2litros' }, { date: '2026-02-30' }, { pricePerLiter: '-1' }, { pricePerLiter: 'Infinity' }, { cowsMilked: 2.5 }]) {
    assert.equal((await milkEdit.PUT(request(data), params(production.id))).status, 400)
  }
  assert.equal((await milkEdit.PUT(request({ quantity: 10 }), params('foreign-production'))).status, 404)
  assert.equal((await milkEdit.PUT(request({ pricePerLiter: null }), params(production.id))).status, 200)
  assert.equal(production.pricePerLiter, null)
  assert.equal((await milkAPI.POST(request({ date: '2026-02-30', quantity: 10 }))).status, 400)
  assert.equal((await milkAPI.POST(request({ date: '2026-10-11', quantity: '10foo' }))).status, 400)
  assert.equal((await milkAPI.POST(request({ date: '2026-10-11', quantity: 10, animalId: 'other-farm' }))).status, 404)
  assert.equal((await milkBatch.POST(request({ date: '2026-10-11', items: [{ animalId: animals[0].id, quantity: '20,5' }], pricePerLiter: '2,75' }))).status, 201)
  assert.equal(productions.at(-1).pricePerLiter, 2.75)
  assert.equal((await milkBatch.POST(request({ date: '2026-10-11', items: [{ animalId: animals[0].id, quantity: '20x' }] }))).status, 400)
  assert.equal((await milkBatch.POST(request({ date: '2026-10-11', items: [{ animalId: 'other-farm', quantity: 20 }] }))).status, 400)
  assert.equal((await priceAPI.PUT(request({ price: -1 }))).status, 400)
  editable = false
  assert.equal((await milkEdit.PUT(request({ quantity: 10 }), params(production.id))).status, 403)
  assert.equal((await animalAPI.POST(request(baseAnimal))).status, 403)
  assert.equal((await priceAPI.PUT(request({ price: 2 }))).status, 403)
  assert.equal(validation.milkPrice('2,1234'), 2.1234)
  console.log('Animais e leite: limites de idade, sexo, castração, compra, mães, edição, preço histórico e permissões passaram.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
