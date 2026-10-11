const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

let session, users, farms, vendors, points, jar, network, sequence
const env = { NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback' }
const matches = (record, where) => Object.entries(where).every(([key, value]) => typeof value === 'object' && value?.equals ? record[key]?.toLowerCase() === value.equals.toLowerCase() : record[key] === value)
const userStore = {
  findUnique: async ({ where }) => users.find(u => matches(u, where)) || null,
  findUniqueOrThrow: async ({ where }) => { const u = users.find(u => matches(u, where)); if (!u) throw new Error('NOT_FOUND'); return u },
  findFirst: async ({ where }) => users.find(u => matches(u, where)) || null,
  create: async ({ data }) => { const u = { id: `u${++sequence}`, password: null, googleId: null, farmId: null, vendorId: null, ...data }; users.push(u); return u },
  update: async ({ where, data }) => { const u = await userStore.findUniqueOrThrow({ where }); if (data.milkPoints?.create) points.push({ ownerId: u.id, ...data.milkPoints.create }); Object.assign(u, data); return u },
  updateMany: async ({ where, data }) => { const selected = users.filter(u => matches(u, where)); selected.forEach(u => Object.assign(u, data)); return { count: selected.length } },
}
const prisma = {
  user: userStore,
  farm: { create: async ({ data }) => { const f = { id: `f${++sequence}`, ...data }; farms.push(f); return f } },
  vendor: {
    findUnique: async ({ where }) => vendors.find(v => matches(v, where)) || null,
    create: async ({ data }) => { const v = { id: `v${++sequence}`, ...data }; vendors.push(v); return v },
  },
  vendorClient: { create: async ({ data }) => data },
  $transaction: async fn => {
    const snapshot = structuredClone({ users, farms, vendors, points })
    try { return await fn(prisma) } catch (e) { ({ users, farms, vendors, points } = snapshot); throw e }
  },
}
const auth = {
  getSessionUser: async () => session,
  hashPassword: async p => `hash:${p}`,
  setSessionCookie: (res, id) => res.cookies.set('session', id),
  clearSessionCookies: res => res.cookies.set('session', ''),
  requireAdmin: async () => ({ error: Response.json({}, { status: 403 }) }),
}
function response(body, status, headers) {
  const res = new Response(body, { status, headers })
  res.savedCookies = {}
  res.cookies = { set: (key, value, options) => { res.savedCookies[key] = { value, options } } }
  return res
}
const NextResponse = {
  json: (body, options = {}) => response(JSON.stringify(body), options.status || 200, { 'content-type': 'application/json' }),
  redirect: url => response(null, 307, { location: String(url) }),
}
const loaded = {}
function load(path) {
  if (loaded[path]) return loaded[path]
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(source, {
    exports, Request, Response, URL, URLSearchParams, Buffer, AbortSignal, Date, console, process: { env },
    fetch: async (url, options) => { network.push({ url, options }); if (url.endsWith('/token')) return Response.json({ access_token: 'test-token' }); return Response.json(googleInfo) },
    require: name => {
      if (name === 'crypto') return require('node:crypto')
      if (name === 'next/server') return { NextResponse }
      if (name === 'next/headers') return { cookies: async () => ({ get: key => jar[key] ? { value: jar[key] } : undefined }) }
      if (name === '@prisma/client') return { Prisma: { PrismaClientKnownRequestError: class extends Error {} } }
      if (name === '@/lib/auth') return auth
      if (name === '@/lib/prisma') return { prisma }
      if (name === '@/lib/vendors') return { newInviteCode: () => 'TESTCODE' }
      if (name === '@/lib/modules') return { MODULES: [{ key: 'fazendas' }, { key: 'leite' }] }
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
      throw new Error(name)
    },
  }, { filename: path })
  loaded[path] = exports
  return exports
}
let googleInfo
function reset() {
  session = null; users = []; farms = []; vendors = []; points = []; jar = {}; network = []; sequence = 0
  googleInfo = { sub: 'google-user', email: 'pessoa@example.com', email_verified: true, name: 'Pessoa' }
}
const request = (path, data) => {
  const req = new Request(`http://localhost:3000${path}`, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : undefined)
  req.nextUrl = new URL(req.url)
  return req
}
const register = load('src/app/api/auth/register/route.ts')
const lite = load('src/app/api/lite/cadastro/route.ts')
const vendor = load('src/app/api/fornecedores/route.ts')
const start = load('src/app/api/auth/google/route.ts')
const callback = load('src/app/api/auth/google/callback/route.ts')
const google = load('src/lib/google-auth.ts')

async function begin(next = '/', link = false) {
  const res = await start.GET(request(`/api/auth/google?next=${encodeURIComponent(next)}${link ? '&link=1' : ''}`))
  const location = new URL(res.headers.get('location'))
  const cookie = res.savedCookies.google_oauth
  jar.google_oauth = cookie.value
  assert.equal(cookie.options.httpOnly, true)
  assert.equal(cookie.options.maxAge, 600)
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(location.searchParams.get('scope'), 'openid email profile')
  return location.searchParams.get('state')
}
const finish = state => callback.GET(request(`/api/auth/google/callback?code=test-code&state=${state}`))

async function main() {
  reset()
  const credentials = { name: 'Pessoa', email: ' PESSOA@example.com ', password: 'secret123' }
  let res = await register.POST(request('/api/auth/register', { user: credentials }))
  assert.equal(res.status, 201)
  assert.equal(users.length, 1); assert.equal(farms.length, 0)
  assert.equal(users[0].email, 'pessoa@example.com'); assert.equal(users[0].role, 'onboarding')
  assert.equal(users[0].password, 'hash:secret123'); assert.equal(res.savedCookies.session.value, users[0].id)
  session = { ...users[0] }
  res = await register.POST(request('/api/auth/register', { farm: { name: 'Fazenda Teste', email: 'pessoa@example.com', state: 'mg' } }))
  assert.equal(res.status, 201); assert.equal(users.length, 1); assert.equal(farms.length, 1)
  assert.equal(users[0].farmId, farms[0].id); assert.equal(users[0].role, 'editor')
  assert.equal(farms[0].state, 'MG'); assert.equal('email' in farms[0], false)
  session = { ...users[0] }
  assert.equal((await register.POST(request('/api/auth/register', { farm: { name: 'Outra' } }))).status, 409)
  assert.equal(farms.length, 1)
  session = null
  assert.equal((await register.POST(request('/api/auth/register', { user: credentials }))).status, 409)

  reset()
  await register.POST(request('/api/auth/register', { user: credentials }))
  session = { ...users[0] }
  assert.equal((await register.POST(request('/api/auth/register', { farm: { name: ' ' } }))).status, 400)
  assert.equal(users[0].role, 'onboarding'); assert.equal(farms.length, 0)
  assert.equal((await lite.POST(request('/api/lite/cadastro', { profile: 'motorista', pointName: 'Tanque', pointKind: 'tanque' }))).status, 201)
  assert.equal(users.length, 1); assert.equal(users[0].role, 'motorista'); assert.equal(points[0].kind, 'tanque')

  reset()
  await register.POST(request('/api/auth/register', { user: credentials }))
  session = { ...users[0] }
  assert.equal((await vendor.POST(request('/api/fornecedores', { vendor: { companyName: 'Empresa', contactName: 'Pessoa', phone: '123' } }))).status, 201)
  assert.equal(users.length, 1); assert.equal(users[0].role, 'fornecedor'); assert.equal(vendors[0].email, 'pessoa@example.com')

  reset()
  let state = await begin('/lite/cadastro?perfil=motorista')
  res = await finish('wrong-state')
  assert.ok(res.headers.get('location').includes('googleError=state')); assert.equal(network.length, 0)
  const flow = JSON.parse(jar.google_oauth); flow.expires = 1; jar.google_oauth = JSON.stringify(flow)
  assert.ok((await finish(state)).headers.get('location').includes('googleError=state')); assert.equal(network.length, 0)
  state = await begin('/lite/cadastro?perfil=motorista')
  res = await finish(state)
  assert.equal(res.headers.get('location'), 'http://localhost:3000/lite/cadastro?perfil=motorista')
  assert.equal(users[0].googleId, googleInfo.sub); assert.equal(users[0].password, null); assert.equal(users[0].role, 'onboarding')
  assert.equal(network[0].options.body.get('code_verifier'), JSON.parse(jar.google_oauth).verifier)
  assert.equal(network[1].options.headers.Authorization, 'Bearer test-token')
  assert.equal(res.savedCookies.google_oauth.options.maxAge, 0)

  reset()
  googleInfo.email_verified = false
  assert.ok((await finish(await begin())).headers.get('location').includes('googleError=failed'))
  assert.equal(users.length, 0)

  reset()
  users.push({ id: 'existing', name: 'Pessoa', email: 'pessoa@example.com', password: 'hash:secret', role: 'editor' })
  assert.ok((await finish(await begin())).headers.get('location').includes('googleError=link'))
  assert.equal(users[0].googleId, undefined)
  session = { ...users[0] }
  assert.equal((await finish(await begin('/perfil', true))).headers.get('location'), 'http://localhost:3000/perfil?googleLinked=1')
  assert.equal(users[0].googleId, googleInfo.sub)
  session = null
  res = await finish(await begin('//evil.example'))
  assert.equal(res.headers.get('location'), 'http://localhost:3000/')
  assert.equal(res.savedCookies.session.value, 'existing')

  reset()
  users.push({ id: 'existing', name: 'Pessoa', email: 'other@example.com', role: 'editor' }); session = { ...users[0] }
  assert.ok((await finish(await begin('/perfil', true))).headers.get('location').includes('googleError=mismatch'))
  assert.equal(users[0].googleId, undefined)
  reset()
  assert.equal((await finish(await begin('/convite/TESTCODE'))).headers.get('location'), 'http://localhost:3000/cadastro?convite=TESTCODE')
  assert.equal(google.safeNext('/\\evil.example'), '/')
  assert.equal(google.safeNext('https://evil.example'), '/')
  env.GOOGLE_REDIRECT_URI = 'bad-url'; assert.equal(google.googleConfig(), null)
  env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback'
  delete env.GOOGLE_CLIENT_SECRET
  assert.ok((await start.GET(request('/api/auth/google'))).headers.get('location').includes('googleError=config'))
  console.log('Cadastro e Google: etapas, retomada, perfis, PKCE, estado, e-mail verificado e vinculação passaram.')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
