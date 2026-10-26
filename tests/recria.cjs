// Recria por animal: quem entra, a entrada, as contas e a fila sem internet (regra pura, sem banco)
// node tests/recria.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const loaded = {}
function load(path) {
  if (loaded[path]) return loaded[path]
  const exports = {}
  loaded[path] = exports
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: (name) => { if (name.startsWith('./')) return load(`src/lib/${name.slice(2)}.ts`); throw new Error(`módulo inesperado: ${name}`) } })
  return exports
}

const r = load('src/lib/rearing.ts')
const today = '2026-10-26'
const calf = { id: 'b1', code: '07', customCode: null, name: 'Mimosa', species: 'Bezerra', gender: 'Fêmea', birthDate: '2026-01-15', status: 'Vivo', lotId: null, rearingStart: null, rearingEnd: null }

// Quem entra: bovino jovem vivo, fora de lote e fora da recria
assert.equal(r.canEnterRearing(calf, today), true)
assert.equal(r.canEnterRearing({ ...calf, species: 'Bezerro', gender: 'Macho' }, today), true, 'bezerro também')
assert.equal(r.canEnterRearing({ ...calf, species: 'Boi de engorda', gender: 'Macho', isCastrated: true }, today), true, 'boi jovem castrado entra')
assert.equal(r.canEnterRearing({ ...calf, birthDate: '2023-01-15' }, today), false, 'com 30 meses já é vaca')
assert.equal(r.canEnterRearing({ ...calf, species: 'Cavalo', gender: 'Macho' }, today), false, 'só bovinos')
assert.equal(r.canEnterRearing({ ...calf, status: 'Vendido' }, today), false)
assert.equal(r.canEnterRearing({ ...calf, lotId: 'lote1' }, today), false, 'no lote, acompanha pelo lote')
assert.equal(r.canEnterRearing({ ...calf, rearingStart: '2026-09-01' }, today), false, 'já está na recria')
assert.equal(r.canEnterRearing({ ...calf, rearingStart: '2026-03-01', rearingEnd: '2026-09-01' }, today), true, 'saiu: pode voltar')
assert.equal(r.isInRearing({ rearingStart: '2026-09-01T00:00:00.000Z', rearingEnd: null }), true)

// Entrada: desmama entre o nascimento e hoje; pesos em kg
assert.equal(r.rearingEntryError({ start: '2026-09-15', birthDate: '2026-01-15', today, weight: 180, target: 320 }), null)
assert.equal(r.rearingEntryError({ start: '2026-09-15', birthDate: '2026-01-15', today, weight: null, target: null }), null, 'peso e alvo são opcionais')
assert.equal(r.rearingEntryError({ start: '', birthDate: '2026-01-15', today }), 'Informe a data da desmama')
assert.equal(r.rearingEntryError({ start: '2026-11-01', birthDate: '2026-01-15', today }), 'A desmama não pode ser no futuro')
assert.equal(r.rearingEntryError({ start: '2026-01-01', birthDate: '2026-01-15T00:00:00.000Z', today }), 'A desmama não pode ser antes do nascimento')
assert.match(r.rearingEntryError({ start: '2026-09-15', birthDate: '2026-01-15', today, weight: 0 }), /Peso inválido/)
assert.match(r.rearingEntryError({ start: '2026-09-15', birthDate: '2026-01-15', today, target: 5000 }), /Peso-alvo inválido/)

// Contas: idade, dias na recria, ganho e previsão do alvo (só pesagens a partir da desmama)
const animal = { ...calf, rearingStart: '2026-09-01', rearingTarget: 320, weighings: [{ date: '2026-06-01', weight: 120 }, { date: '2026-09-01', weight: 180 }, { date: '2026-10-01', weight: 204 }] }
const s = r.rearingSummary(animal, today)
assert.equal(s.months, 9)
assert.equal(s.days, 55)
assert.equal(s.entry.weight, 180, 'a pesagem antes da desmama não conta como entrada')
assert.equal(s.last.weight, 204)
assert.equal(s.gainKg, 24)
assert.equal(s.gmd, 0.8)
assert.deepEqual({ ...s.projection }, { remainingKg: 116, days: 145, date: '2027-02-23' })
assert.equal(r.rearingSummary({ ...animal, rearingTarget: null }, today).projection, null, 'sem alvo não há previsão')
assert.equal(r.rearingSummary({ ...animal, rearingEnd: '2026-10-10' }, today).days, 39, 'encerrada: conta até a saída')
assert.equal(r.rearingSummary({ ...animal, rearingEnd: '2026-10-10' }, today).projection, null)
assert.equal(r.rearingSummary({ ...animal, weighings: [] }, today).gmd, null)

// Fila sem internet: cada item sabe a rota (JSON: os objetos vêm do sandbox)
const plain = (v) => JSON.parse(JSON.stringify(v))
assert.deepEqual(plain(r.pendingRequest({ _type: 'entrar', animalId: 'b1', farmId: 'f', start: '2026-09-01', weight: 180, target: null })),
  { url: '/api/animals/b1/recria', method: 'POST', body: { start: '2026-09-01', weight: 180, target: null } })
assert.deepEqual(plain(r.pendingRequest({ _type: 'pesar', animalId: 'b1', farmId: 'f', date: '2026-10-01', weight: 204 })),
  { url: '/api/animals/b1/pesagens', method: 'POST', body: { date: '2026-10-01', weight: 204 } })
assert.deepEqual(plain(r.pendingRequest({ _type: 'sair', animalId: 'b1', farmId: 'f', end: '2026-10-20' })),
  { url: '/api/animals/b1/recria', method: 'PATCH', body: { end: '2026-10-20' } })

// A lista como vai ficar depois da fila subir
const herd = [calf, { ...calf, id: 'b2', code: '08', name: 'Pintado', species: 'Bezerro', gender: 'Macho' }]
const merged = Array.from(r.applyPending(
  [{ ...animal, id: 'b1' }],
  [
    { _type: 'entrar', animalId: 'b2', farmId: 'f', start: '2026-10-20', weight: 190, target: 360 },
    { _type: 'pesar', animalId: 'b1', farmId: 'f', date: '2026-10-20', weight: 220 },
    { _type: 'pesar', animalId: 'b1', farmId: 'f', date: '2026-10-15', weight: 212 },
    { _type: 'sair', animalId: 'b1', farmId: 'f', end: '2026-10-25' },
    { _type: 'pesar', animalId: 'nao-existe', farmId: 'f', date: '2026-10-20', weight: 1 },
  ],
  herd,
))
assert.equal(merged.length, 2, 'quem não está na lista nem no rebanho é ignorado')
const b1 = merged.find((a) => a.id === 'b1')
assert.deepEqual(Array.from(b1.weighings, (w) => `${w.date}:${w.weight}`), ['2026-06-01:120', '2026-09-01:180', '2026-10-01:204', '2026-10-15:212', '2026-10-20:220'], 'pesagens entram em ordem de data')
assert.equal(b1.rearingEnd, '2026-10-25')
const b2 = merged.find((a) => a.id === 'b2')
assert.equal(b2.rearingStart, '2026-10-20')
assert.equal(b2.rearingTarget, 360)
assert.deepEqual(Array.from(b2.weighings, (w) => w.weight), [190], 'o peso da desmama vira a primeira pesagem')
assert.equal(animal.weighings.length, 3, 'a lista original não muda')

console.log('recria: ok')
