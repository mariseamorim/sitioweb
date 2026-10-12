const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
let records = [], counter = 0
const user = { id: 'owner', name: 'Produtor', role: 'editor', effectiveFarmId: 'farm' }
const match = (record, where) => Object.entries(where).every(([key, value]) => {
  if (value instanceof Date) return record[key].getTime() === value.getTime()
  if (value && typeof value === 'object') {
    if (value.gte) return record[key] >= value.gte
    if (value.in) return value.in.includes(record[key])
  }
  return record[key] === value
})
const prisma = {
  farm: { findUnique: async () => ({ name: 'Fazenda', milkPrice: 2.5 }) },
  milkEntry: { findMany: async () => [] },
  milkProduction: {
    findMany: async ({ where }) => records.filter(r => match(r, where)),
    create: async ({ data }) => { const r = { id: `p${++counter}`, ...data }; records.push(r); return r },
    update: async ({ where, data }) => Object.assign(records.find(r => r.id === where.id), data),
    deleteMany: async ({ where }) => { records = records.filter(r => !match(r, where)) },
  },
  $executeRaw: async () => 1,
  $transaction: async fn => {
    const before = records.map(r => ({ ...r }))
    try { return await fn(prisma) } catch (e) { records = before; throw e }
  },
}
const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, Map, Set, console, require: name => {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => Response.json(data, options) } }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return { requireUser: async () => ({ user }), canEdit: () => true, canAccessModule: () => true, renewSession: response => response }
    if (name === '@/lib/utils') return { todayUTC: () => new Date('2026-10-11T00:00:00Z') }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw Error(name)
  } })
  return (modules[path] = exports)
}
const api = load('src/app/api/lite/route.ts')
const save = (liters, date = '2026-10-11') => api.PUT(new Request('http://local/api/lite', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes: [{ pointId: 'fazenda', date, liters }] }) }))
async function main() {
  records.push({ id: 'manual', farmId: 'farm', date: new Date('2026-10-11'), quantity: 30, source: null })
  records.push({ id: 'other-farm', farmId: 'other', date: new Date('2026-10-11'), quantity: 999, source: null })
  assert.equal((await api.GET()).status, 200)
  assert.equal((await (await api.GET()).json()).entries[0].liters, 30)
  assert.equal((await save(50)).status, 200)
  assert.equal(records.find(r => r.source === 'lite').quantity, 20)
  assert.equal(records.find(r => r.source === 'lite').pricePerLiter, 2.5)
  assert.equal((await save(50)).status, 200)
  assert.equal(records.filter(r => r.source === 'lite').length, 1)
  assert.equal((await (await api.GET()).json()).entries[0].liters, 50)
  // Edição na Produção reflete no total do Lite.
  records.find(r => r.id === 'manual').quantity = 40
  assert.equal((await (await api.GET()).json()).entries[0].liters, 60)
  assert.equal((await save(70)).status, 200)
  assert.equal(records.find(r => r.source === 'lite').quantity, 30)
  assert.equal((await save(10)).status, 409)
  assert.equal(records.find(r => r.source === 'lite').quantity, 30)
  assert.equal((await save(null)).status, 409)
  assert.equal((await save(40)).status, 200)
  assert.equal(records.filter(r => r.source === 'lite').length, 0)
  assert.equal((await save(15, '2026-10-10')).status, 200)
  assert.equal((await save(null, '2026-10-10')).status, 200)
  assert.equal(records.find(r => r.id === 'other-farm').quantity, 999)
  console.log('Sincronização Lite/Produção: total compartilhado, edição, reenvio, remoção, preço e isolamento passaram.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
