// Dados sem internet: busca com cópia, fila com URL própria, lista com a fila por cima e envio geral
// node tests/offline-data.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

// Aparelho de mentira: localStorage, navigator e fetch controláveis
const store = new Map()
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}
const navigator = { onLine: true }
let calls = []
let responder = () => ({ status: 200, body: {} })
const fetch = async (url, init = {}) => {
  calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined })
  // Honra o sinal de cancelamento, como o fetch de verdade
  const aborted = new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
  const r = await Promise.race([responder(url, init), aborted])
  if (r.networkError) throw new TypeError('Failed to fetch')
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} }
}
const events = []
const window = { dispatchEvent: (e) => events.push(e), addEventListener() {}, removeEventListener() {} }
const sandbox = { exports: {}, DOMException, localStorage, navigator, fetch, window, AbortController, setTimeout, clearTimeout, console, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } } }

const loaded = {}
function load(path) {
  if (loaded[path]) return loaded[path]
  const exports = {}
  loaded[path] = exports
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { ...sandbox, exports, require: (name) => { if (name.startsWith('./')) return load(`src/lib/${name.slice(2)}.ts`); throw new Error(`módulo inesperado: ${name}`) } })
  return exports
}
const plain = (v) => JSON.parse(JSON.stringify(v))
const d = load('src/lib/offlineData.ts')

;(async () => {
  // ── cachedGet ───────────────────────────────────────────────────────
  responder = () => ({ status: 200, body: [{ id: 'a' }] })
  let r = await d.cachedGet('cache_x', '/api/x')
  assert.deepEqual(plain(r), { data: [{ id: 'a' }], fromCache: false }, 'com rede, guarda e devolve')
  assert.equal(store.get('cache_x'), '[{"id":"a"}]')

  responder = () => ({ networkError: true })
  r = await d.cachedGet('cache_x', '/api/x')
  assert.deepEqual(plain(r), { data: [{ id: 'a' }], fromCache: true }, 'rede falhou: usa a cópia')

  responder = () => ({ status: 500, body: { error: 'banco fora' } })
  r = await d.cachedGet('cache_x', '/api/x')
  assert.equal(r.fromCache, true, '5xx: usa a cópia')

  responder = () => ({ status: 403, body: { error: 'Sem permissão' } })
  await assert.rejects(() => d.cachedGet('cache_x', '/api/x'), (e) => e.status === 403 && e.message === 'Sem permissão', '4xx não usa a cópia')

  navigator.onLine = false
  calls = []
  r = await d.cachedGet('cache_x', '/api/x')
  assert.equal(r.fromCache, true)
  assert.equal(calls.length, 0, 'sem sinal nem tenta a rede')
  await assert.rejects(() => d.cachedGet('cache_nada', '/api/nada'), /Sem internet/, 'sem cópia e sem sinal: erro')
  navigator.onLine = true

  // ── sendOrQueue ─────────────────────────────────────────────────────
  responder = () => ({ status: 201, body: { id: 'novo' } })
  let s = await d.sendOrQueue('vac', { type: 'create', url: '/api/vac', method: 'POST', body: { a: 1 } })
  assert.deepEqual(plain(s), { status: 'sent', data: { id: 'novo' } })

  responder = () => ({ status: 400, body: { error: 'Data inválida' } })
  s = await d.sendOrQueue('vac', { type: 'create', url: '/api/vac', method: 'POST', body: { a: 1 } })
  assert.deepEqual(plain(s), { status: 'rejected', error: 'Data inválida', code: 400 }, '4xx não entra na fila')
  assert.equal(d.pendingOf('vac').length, 0)

  responder = () => ({ networkError: true })
  s = await d.sendOrQueue('vac', { type: 'create', url: '/api/vac', method: 'POST', body: { a: 2 }, local: { farmId: 'f1', animal: { name: 'Mimosa' } } })
  assert.equal(s.status, 'queued')
  let q = d.pendingOf('vac')
  assert.equal(q.length, 1)
  assert.equal(q[0]._url, '/api/vac'); assert.equal(q[0]._method, 'POST'); assert.deepEqual(plain(q[0]._body), { a: 2 })
  assert.equal(q[0].farmId, 'f1'); assert.equal(q[0].animal.name, 'Mimosa'); assert.equal(q[0]._type, 'create')
  assert.equal(d.pendingItemId(q[0]), `pending_${s.pendingId}`)
  assert.equal(d.isPendingId(d.pendingItemId(q[0])), true)
  assert.equal(d.pendingIdOf(d.pendingItemId(q[0])), s.pendingId)

  navigator.onLine = false
  s = await d.sendOrQueue('vac', { type: 'update', id: 'srv1', url: '/api/vac/srv1', method: 'PUT', body: { appliedDate: '2026-11-01' } })
  assert.equal(s.status, 'queued')
  s = await d.sendOrQueue('vac', { type: 'delete', id: 'srv2', url: '/api/vac/srv2', method: 'DELETE' })
  assert.equal(s.status, 'queued')
  navigator.onLine = true
  assert.equal(d.pendingOf('vac').length, 3)
  assert.equal(d.pendingOf('vac', (p) => p.farmId === 'f1').length, 1, 'filtro')

  // ── withPending ─────────────────────────────────────────────────────
  const server = [{ id: 'srv1', appliedDate: null, name: 'A' }, { id: 'srv2', name: 'B' }, { id: 'srv3', name: 'C' }]
  const merged = d.withPending(server, d.pendingOf('vac'), (p) => (p._type === 'create' ? { id: d.pendingItemId(p), ...p._body, name: p.animal?.name } : null))
  assert.deepEqual(plain(merged.map((x) => x.id)), ['srv1', 'srv3', d.pendingItemId(q[0])], 'delete tira, create entra no fim')
  assert.equal(merged[0].appliedDate, '2026-11-01', 'update mescla o corpo')
  assert.equal(merged[2].name, 'Mimosa')

  // ── syncModule ──────────────────────────────────────────────────────
  // Registro antigo, sem _url: só sai com `legacy`
  store.set('pending_vac', JSON.stringify([...d.pendingOf('vac'), { _pendingId: 999, vaccineName: 'Aftosa', farmId: 'f1', _type: 'create' }]))
  assert.equal(d.pendingOf('vac').length, 4)

  calls = []
  responder = (url) => (url === '/api/vac/srv2' ? { status: 404, body: { error: 'Não existe mais' } } : { status: 200, body: {} })
  let rep = await d.syncModule('vac')
  assert.deepEqual(plain(rep), { sent: 2, rejected: 1, stopped: false, errors: ['Não existe mais'] }, 'enviados saem, 404 sai como recusado')
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['POST /api/vac', 'PUT /api/vac/srv1', 'DELETE /api/vac/srv2'])
  assert.deepEqual(plain(calls[1].body), { appliedDate: '2026-11-01' })
  assert.equal(calls[2].body, undefined, 'DELETE sem corpo')
  assert.equal(d.pendingOf('vac').length, 1, 'o antigo fica')

  calls = []
  rep = await d.syncModule('vac', (rec) => ({ url: '/api/vac', method: 'POST', body: { vaccineName: rec.vaccineName } }))
  assert.equal(rep.sent, 1)
  assert.deepEqual(plain(calls[0].body), { vaccineName: 'Aftosa' })
  assert.equal(d.pendingOf('vac').length, 0)

  // Falha de rede no meio: para e guarda o resto, na ordem
  navigator.onLine = false
  await d.sendOrQueue('fin', { type: 'create', url: '/api/fin', method: 'POST', body: { n: 1 } })
  await d.sendOrQueue('fin', { type: 'create', url: '/api/fin', method: 'POST', body: { n: 2 } })
  navigator.onLine = true
  let n = 0
  responder = () => (++n === 1 ? { status: 200 } : { networkError: true })
  rep = await d.syncModule('fin')
  assert.deepEqual(plain(rep), { sent: 1, rejected: 0, stopped: true, errors: [] })
  assert.deepEqual(plain(d.pendingOf('fin').map((p) => p._body)), [{ n: 2 }])

  // 5xx também para (o servidor vai voltar)
  responder = () => ({ status: 503, body: {} })
  rep = await d.syncModule('fin')
  assert.equal(rep.stopped, true); assert.equal(d.pendingOf('fin').length, 1)

  // Sem sinal, nem tenta
  navigator.onLine = false
  calls = []
  rep = await d.syncModule('fin')
  assert.equal(calls.length, 0)
  navigator.onLine = true

  // ── pendingModules / syncAll ────────────────────────────────────────
  store.set('pending_estoque-mov', JSON.stringify([{ _pendingId: 1, supplyId: 's1', type: 'entrada' }]))
  assert.deepEqual(plain(d.pendingModules()), ['fin'], 'fila antiga sem _url fica para a tela do módulo')
  responder = () => ({ status: 200, body: {} })
  const all = await d.syncAll()
  assert.deepEqual(plain(all), { sent: 1, rejected: 0 })
  assert.equal(events.length, 1); assert.equal(events[0].type, d.SYNC_EVENT)
  assert.deepEqual(plain(d.pendingModules()), [])

  // ── fetchWithTimeout ────────────────────────────────────────────────
  responder = () => new Promise(() => {}) // nunca responde
  await assert.rejects(() => d.fetchWithTimeout('/lento', {}, 20), 'demora vira erro')

  console.log('offline-data: ok')
})().catch((e) => { console.error(e); process.exit(1) })
