// Entrar sem internet: a senha guardada como hash confere, a errada não, e só para quem entrou neste aparelho
// node tests/offline-unlock.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const store = new Map()
const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() }
const sessionStorage = { clear: () => {} }
const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, console, crypto: globalThis.crypto, TextEncoder, Uint8Array, localStorage, sessionStorage, require: (name) => {
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  modules[path] = exports
  return exports
}

;(async () => {
  const u = load('src/lib/offlineUnlock.ts')
  assert.equal(u.canUnlockOffline(), true)
  const user = { id: 'u1', name: 'Manoel', email: null, phone: '35999990000', role: 'lite', farmId: null, farmName: null, permissions: null }
  await u.saveOfflineCredential(user, 'segredo1')
  const raw = JSON.parse(store.get('offline_credential_v1'))
  assert.ok(!raw.hash.includes('segredo'), 'a senha não pode ficar guardada')
  assert.equal(raw.iterations, 150000)
  assert.equal(raw.salt.length, 32)

  // telefone com ou sem máscara; senha certa abre, errada não
  assert.deepEqual(JSON.parse(JSON.stringify(await u.unlockOffline('(35) 99999-0000', 'segredo1'))), user)
  assert.deepEqual(JSON.parse(JSON.stringify(await u.unlockOffline('35999990000', 'segredo1'))), user)
  assert.equal(await u.unlockOffline('35999990000', 'errada'), null)
  assert.equal(await u.unlockOffline('35999990000', ''), null)
  // outra pessoa não entra com a credencial guardada
  assert.equal(await u.unlockOffline('outro@example.com', 'segredo1'), null)
  assert.equal(u.offlineCredentialFor('(35) 99999-0000') !== null, true)
  assert.equal(u.offlineCredentialFor('31999990000'), null)

  // por e-mail, sem diferenciar maiúsculas
  await u.saveOfflineCredential({ ...user, email: 'Edeuza@Example.com', phone: null }, 'outra12')
  assert.equal((await u.unlockOffline('edeuza@example.com', 'outra12')).email, 'Edeuza@Example.com')
  assert.equal(await u.unlockOffline('(35) 99999-0000', 'segredo1'), null, 'a credencial anterior foi substituída')

  // Sair comum deixa a credencial; apagar tudo remove
  store.set('cached_user', '{}'); store.set('lite_cache_v1', '{}')
  u.logoutKeepingDevice()
  assert.equal(store.has('cached_user'), false)
  assert.equal(store.has('lite_cache_v1'), true)
  assert.equal(store.has('offline_credential_v1'), true)
  await u.wipeDevice()
  assert.equal(store.size, 0)
  console.log('offline-unlock: ok')
})().catch((e) => { console.error(e); process.exit(1) })
