// Nota do laticínio com mais de um nome: regra da divisão (pura) e a rota que grava a divisão (com banco simulado)
// node tests/lite-nota.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const plain = (v) => JSON.parse(JSON.stringify(v))
const deep = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg)

// ── banco simulado ──────────────────────────────────────────────────────
let payees = [
  { id: 'p1', pointId: 'pt1', farmId: null, name: 'Manoel', producerCode: '005712', sequence: '030', active: true, position: 0 },
  { id: 'p2', pointId: 'pt1', farmId: null, name: 'Edeuza', producerCode: '005713', sequence: '031', active: true, position: 1 },
  { id: 'px', pointId: 'other', farmId: null, name: 'De outro produtor', producerCode: null, sequence: null, active: true, position: 0 },
]
let splits = []
const match = (r, where) => Object.entries(where).every(([k, v]) => {
  if (v instanceof Date) return r[k].getTime() === v.getTime()
  if (v && typeof v === 'object') { if (v.in) return v.in.includes(r[k]); if (v.gte) return r[k] >= v.gte }
  return r[k] === v
})
const prisma = {
  milkPoint: { findMany: async () => [{ id: 'pt1' }] },
  milkPayee: {
    findMany: async ({ where }) => payees.filter((p) => match(p, where)),
    findFirst: async ({ where }) => payees.find((p) => match(p, where)) ?? null,
    count: async ({ where }) => payees.filter((p) => match(p, where)).length,
  },
  milkSplit: {
    findMany: async ({ where }) => splits.filter((s) => match(s, where)),
    upsert: async ({ where, create, update }) => {
      const found = splits.find((s) => s.payeeId === where.payeeId_date.payeeId && s.date.getTime() === where.payeeId_date.date.getTime())
      if (found) Object.assign(found, update); else splits.push({ ...create })
    },
    deleteMany: async ({ where }) => { splits = splits.filter((s) => !match(s, where)) },
  },
  $transaction: async (ops) => { for (const op of ops) await op },
}
let user = { id: 'u1', name: 'Produtor', role: 'lite', effectiveFarmId: null }

const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, Map, Set, console, Response, require: (name) => {
    if (name === 'next/server') return { NextResponse: { json: (data, options) => Response.json(data, options) } }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return { requireUser: async () => ({ user }), canEdit: () => true, canAccessModule: () => true }
    if (name === '@/lib/utils') return { todayUTC: () => new Date('2026-07-12T00:00:00Z') }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  modules[path] = exports
  return exports
}

const lite = load('src/lib/lite.ts')
const P = [
  { id: 'p1', pointId: 'pt1', name: 'Manoel', producerCode: '005712', sequence: '030', active: true, position: 0 },
  { id: 'p2', pointId: 'pt1', name: 'Edeuza', producerCode: '005713', sequence: '031', active: true, position: 1 },
]
const S = [
  { payeeId: 'p1', date: '2026-07-10', liters: 100 }, { payeeId: 'p2', date: '2026-07-10', liters: 49 },
  { payeeId: 'p1', date: '2026-07-08', liters: 100 }, { payeeId: 'p2', date: '2026-07-08', liters: 52 },
]
const E = [
  { pointId: 'pt1', date: '2026-07-09', liters: 74 }, { pointId: 'pt1', date: '2026-07-10', liters: 75 },
  { pointId: 'pt1', date: '2026-07-11', liters: 76 }, { pointId: 'pt1', date: '2026-07-12', liters: 78 },
  { pointId: 'other', date: '2026-07-12', liters: 500 },
]

// dias de coleta do local, em ordem
deep(lite.splitDates(S, P, 'pt1'), ['2026-07-08', '2026-07-10'])

// desde a última coleta: dia seguinte à coleta anterior até o dia; só do local
deep(lite.litersSinceLastSplit(E, S, P, 'pt1', '2026-07-12'), { liters: 154, from: '2026-07-11' })
deep(lite.litersSinceLastSplit(E, S, P, 'pt1', '2026-07-10'), { liters: 149, from: '2026-07-09' })
// sem coleta anterior: só o dia
deep(lite.litersSinceLastSplit(E, [], P, 'pt1', '2026-07-12'), { liters: 78, from: '2026-07-12' })

// última divisão antes do dia
deep(lite.lastSplit(S, P, 'pt1', '2026-07-12').map((s) => s.liters), [100, 49])
deep(lite.lastSplit(S, P, 'pt1', '2026-07-08'), [])

// sugestão: mesma proporção da última (100/149), arredondada, resto no último nome
deep(lite.suggestSplit(154, P, lite.lastSplit(S, P, 'pt1', '2026-07-12')), { p1: 103.4, p2: 50.6 })
// sem proporção: igual; soma sempre bate
deep(lite.suggestSplit(155, P), { p1: 77.5, p2: 77.5 })
deep(lite.suggestSplit(100, [...P, { id: 'p3', pointId: 'pt1', name: 'Zé', producerCode: null, sequence: null, active: true, position: 2 }]), { p1: 33.3, p2: 33.3, p3: 33.4 })
deep(lite.suggestSplit(154, P, [{ payeeId: 'p1', liters: 1 }]), { p1: 154, p2: 0 }, 'tudo num nome')
deep(lite.suggestSplit(10, []), {})

// total por nome no período
const t = lite.totalsByPayee(S, '2026-07-09', '2026-07-12')
assert.equal(t.get('p1'), 100); assert.equal(t.get('p2'), 49)
const t2 = lite.totalsByPayee(S, '2026-07-01', '2026-07-31')
assert.equal(t2.get('p1'), 200); assert.equal(t2.get('p2'), 101)

// ── rota PUT /api/lite/divisao ──────────────────────────────────────────
;(async () => {
const api = load('src/app/api/lite/divisao/route.ts')
const put = (body) => api.PUT({ json: async () => body })

let res = await put({ changes: [{ payeeId: 'p1', date: '2026-07-12', liters: 103 }, { payeeId: 'p2', date: '2026-07-12', liters: 51 }] })
assert.equal(res.status, 200)
deep(splits.map((s) => [s.payeeId, s.liters]), [['p1', 103], ['p2', 51]])

// reenviar o mesmo dado não duplica; alterar substitui
res = await put({ changes: [{ payeeId: 'p1', date: '2026-07-12', liters: 104 }] })
assert.equal(res.status, 200)
deep(splits.map((s) => [s.payeeId, s.liters]), [['p1', 104], ['p2', 51]])

// liters null apaga a parte daquele nome
res = await put({ changes: [{ payeeId: 'p2', date: '2026-07-12', liters: null }] })
assert.equal(res.status, 200)
deep(splits.map((s) => s.payeeId), ['p1'])

// nome de outro produtor: 404; data futura: 400; litros inválidos: 400; vazio: 400
assert.equal((await put({ changes: [{ payeeId: 'px', date: '2026-07-12', liters: 10 }] })).status, 404)
assert.equal((await put({ changes: [{ payeeId: 'p1', date: '2026-07-13', liters: 10 }] })).status, 400)
assert.equal((await put({ changes: [{ payeeId: 'p1', date: '2026-07-12', liters: 'abc' }] })).status, 400)
assert.equal((await put({ changes: [] })).status, 400)

// motorista não divide a nota
user = { id: 'd1', name: 'Joel', role: 'motorista', effectiveFarmId: null }
assert.equal((await put({ changes: [{ payeeId: 'p1', date: '2026-07-12', liters: 10 }] })).status, 403)

console.log('lite-nota: ok')
})().catch((e) => { console.error(e); process.exit(1) })
