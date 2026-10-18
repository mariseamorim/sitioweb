// Movimentação de estoque: regras puras e as rotas de criar, corrigir e desfazer (o saldo acompanha)
// node tests/estoque-movimentacao.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const plain = (v) => JSON.parse(JSON.stringify(v))
const NextResponse = { json: (data, options) => Response.json(data, options) }

// Banco de mentira: um insumo com saldo 100 e as movimentações dele
let supply, movements, auth
function resetDb() {
  supply = { id: 's1', farmId: 'farm', name: 'Ração', unit: 'kg', currentQuantity: 100, packageKg: null }
  movements = [{ id: 'm1', supplyId: 's1', type: 'Entrada', quantity: 10, feeding: null }, { id: 'trato', supplyId: 's1', type: 'Saída', quantity: 2, feeding: { id: 'f1' } }]
  auth = { user: { id: 'u1' }, farmId: 'farm' }
}
const run = (op) => {
  if (op._op === 'supply.update') {
    supply.currentQuantity += op.args.data.currentQuantity.increment
    return { ...supply, movements: movements.map(({ feeding: _, ...m }) => m) }
  }
  if (op._op === 'movement.create') { const m = { id: 'novo', supplyId: op.args.data.supplyId, ...op.args.data, feeding: null }; movements.push(m); return m }
  if (op._op === 'movement.update') { const m = movements.find((x) => x.id === op.args.where.id); Object.assign(m, op.args.data); return m }
  if (op._op === 'movement.delete') { const i = movements.findIndex((x) => x.id === op.args.where.id); return movements.splice(i, 1)[0] }
  throw new Error('operação inesperada')
}
const prisma = {
  supply: { findFirst: async ({ where }) => (where.id === supply.id && where.farmId === supply.farmId ? { id: supply.id } : null), update: (args) => ({ _op: 'supply.update', args }) },
  supplyMovement: {
    findFirst: async ({ where }) => movements.find((m) => m.id === where.id && m.supplyId === where.supplyId && supply.farmId === where.supply.farmId) ?? null,
    create: (args) => ({ _op: 'movement.create', args }), update: (args) => ({ _op: 'movement.update', args }), delete: (args) => ({ _op: 'movement.delete', args }),
  },
  $transaction: async (ops) => ops.map(run),
}

function load(path) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, console, Response, Number, Math, JSON, String, require: (name) => {
    if (name === 'next/server') return { NextResponse }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return { requireFarmAccess: async () => auth, notFound: (msg) => Response.json({ error: msg }, { status: 404 }) }
    if (name === '@/lib/lotUsage') return { supplyDailyUse: async () => new Map([['s1', 2.5]]), withDailyUse: (s, use) => ({ ...s, dailyUseKg: use.get(s.id) ?? null, daysLeft: use.get(s.id) ? Math.floor(s.currentQuantity / use.get(s.id)) : null }) }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  return exports
}
const req = (data) => ({ json: async () => data })
const params = (movId) => ({ params: Promise.resolve({ id: 's1', movId }) })

;(async () => {
  const rules = load('src/lib/stockMovements.ts')

  // --- regras puras ---
  assert.deepEqual(plain(rules.parseMovement({ type: 'Entrada', quantity: '12,5', date: '2026-10-18', description: '  nota 7 ' })), { type: 'Entrada', quantity: 12.5, date: '2026-10-18', description: 'nota 7' })
  assert.deepEqual(plain(rules.parseMovement({ type: 'Saída', quantity: 3, date: '2026-10-18T00:00:00.000Z', description: '' })), { type: 'Saída', quantity: 3, date: '2026-10-18', description: null })
  assert.equal(rules.parseMovement({ type: 'Ajuste', quantity: 1, date: '2026-10-18' }), null, 'tipo desconhecido')
  assert.equal(rules.parseMovement({ type: 'Entrada', quantity: '0', date: '2026-10-18' }), null, 'quantidade zero')
  assert.equal(rules.parseMovement({ type: 'Entrada', quantity: '', date: '2026-10-18' }), null, 'sem quantidade')
  assert.equal(rules.parseMovement({ type: 'Entrada', quantity: '5', date: '' }), null, 'sem data')
  assert.equal(rules.parseMovement({ type: 'Entrada', quantity: '5', date: '2026-13-40' }), null, 'data inválida')
  assert.equal(rules.parseMovement(null), null)
  assert.equal(rules.movementReady({ type: 'Entrada', quantity: '5', date: '2026-10-18' }), true)
  assert.equal(rules.movementReady({ type: 'Entrada', quantity: '', date: '2026-10-18' }), false)

  assert.equal(rules.movementDelta(null, { type: 'Entrada', quantity: 10 }), 10)
  assert.equal(rules.movementDelta({ type: 'Entrada', quantity: 10 }, { type: 'Saída', quantity: 4 }), -14, 'entrada de 10 virou saída de 4')
  assert.equal(rules.movementDelta({ type: 'Saída', quantity: 5 }, null), 5, 'desfazer uma saída devolve ao estoque')
  assert.equal(rules.movementDelta({ type: 'Entrada', quantity: 0.1 }, { type: 'Entrada', quantity: 0.3 }), 0.2, 'sem lixo de ponto flutuante')

  const list = [{ id: 's1', currentQuantity: 100, movements: [{ id: 'm1', type: 'Entrada', quantity: 10, date: '2026-10-01T00:00:00.000Z' }] }, { id: 's2', currentQuantity: 7, movements: [] }]
  const pending = [{ supplyId: 's1', farmId: 'farm', type: 'Entrada', quantity: 10, date: '2026-10-18', description: null, _pendingId: 1 }, { supplyId: 's1', farmId: 'farm', type: 'Saída', quantity: 3, date: '2026-10-18', description: 'uso', _pendingId: 2 }]
  const applied = plain(rules.applyPendingMovements(list, pending))
  assert.equal(applied[0].currentQuantity, 107)
  assert.deepEqual(applied[0].movements.map((m) => m.id), ['pending_1', 'pending_2', 'm1'])
  assert.equal(applied[0].movements[1].date, '2026-10-18T00:00:00.000Z')
  assert.deepEqual(applied[1], list[1], 'insumo sem pendências fica igual')
  assert.equal(rules.applyPendingMovements(list, []), list)

  // --- rota: criar ---
  const create = load('src/app/api/estoque/[id]/movimentacao/route.ts')
  const edit = load('src/app/api/estoque/[id]/movimentacao/[movId]/route.ts')
  resetDb()
  let res = await create.POST(req({ type: 'Saída', quantity: '7,5', date: '2026-10-18', description: 'trato manual' }), params())
  assert.equal(res.status, 201)
  let body = await res.json()
  assert.equal(body.supply.currentQuantity, 92.5)
  assert.equal(body.supply.dailyUseKg, 2.5, 'devolve o consumo dos lotes para a tela não recarregar')
  assert.equal(body.supply.daysLeft, 37)
  assert.equal(body.movement.id, 'novo')
  assert.equal(body.movement.quantity, 7.5)
  assert.equal(body.movement.description, 'trato manual')
  assert.equal((await create.POST(req({ type: 'Entrada', quantity: '', date: '2026-10-18' }), params())).status, 400)
  assert.equal((await create.POST(req({ type: 'Entrada', quantity: '1', date: '2026-10-18' }), { params: Promise.resolve({ id: 'outro' }) })).status, 404)

  // --- rota: corrigir (a diferença entra no saldo) ---
  resetDb()
  res = await edit.PATCH(req({ type: 'Saída', quantity: 4, date: '2026-10-17', description: null }), params('m1'))
  assert.equal(res.status, 200)
  body = await res.json()
  assert.equal(body.supply.currentQuantity, 86, '100 - 10 (entrada que saiu) - 4 (saída nova)')
  assert.equal(body.movement.type, 'Saída')
  assert.equal(movements[0].quantity, 4)
  assert.equal((await edit.PATCH(req({ type: 'Entrada', quantity: 0, date: '2026-10-17' }), params('m1'))).status, 400)
  assert.equal((await edit.PATCH(req({ type: 'Entrada', quantity: 1, date: '2026-10-17' }), params('nada'))).status, 404)
  res = await edit.PATCH(req({ type: 'Entrada', quantity: 1, date: '2026-10-17' }), params('trato'))
  assert.equal(res.status, 409, 'saída do trato de lote não se altera por aqui')
  assert.equal(supply.currentQuantity, 86, 'saldo não muda nas recusas')

  // --- rota: desfazer ---
  resetDb()
  res = await edit.DELETE({}, params('m1'))
  assert.equal(res.status, 200)
  body = await res.json()
  assert.equal(body.supply.currentQuantity, 90, 'desfazer a entrada de 10 tira do saldo')
  assert.equal(movements.some((m) => m.id === 'm1'), false)
  assert.equal((await edit.DELETE({}, params('m1'))).status, 404)
  assert.equal((await edit.DELETE({}, params('trato'))).status, 409)

  // sem permissão nada acontece
  auth = { error: Response.json({ error: 'Faça login' }, { status: 401 }) }
  assert.equal((await create.POST(req({ type: 'Entrada', quantity: 1, date: '2026-10-18' }), params())).status, 401)
  assert.equal((await edit.PATCH(req({ type: 'Entrada', quantity: 1, date: '2026-10-18' }), params('m1'))).status, 401)
  assert.equal((await edit.DELETE({}, params('m1'))).status, 401)
  assert.equal(supply.currentQuantity, 90)
  console.log('estoque-movimentacao: ok')
})().catch((e) => { console.error(e); process.exit(1) })
