// Login por telefone e e-mail opcional: regras puras, cadastro e login (banco simulado)
// node tests/login-telefone.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

let users = [], sequence = 0, session = null
const matches = (r, where) => Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && 'equals' in v) ? (r[k] ?? '').toLowerCase() === v.equals.toLowerCase() : r[k] === v)
const prisma = {
  user: {
    findFirst: async ({ where }) => users.find((u) => matches(u, where)) ?? null,
    findUnique: async ({ where }) => users.find((u) => matches(u, where)) ?? null,
    create: async ({ data }) => { const u = { id: `u${++sequence}`, farm: null, farmId: null, googleId: null, ...data }; users.push(u); return u },
    update: async ({ where, data }) => Object.assign(users.find((u) => matches(u, where)), data),
  },
}
function response(body, status, headers) {
  const res = new Response(body, { status, headers })
  res.savedCookies = {}
  res.cookies = { set: (key, value) => { res.savedCookies[key] = value } }
  return res
}
const NextResponse = { json: (body, options = {}) => response(JSON.stringify(body), options.status || 200, { 'content-type': 'application/json' }) }
const auth = {
  getSessionUser: async () => session,
  hashPassword: async (p) => `hash:${p}`,
  verifyPassword: async (p, stored) => stored === `hash:${p}`,
  isLegacyPassword: () => false,
  setSessionCookie: (res, id) => res.cookies.set('session', id),
}
const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, console, Response, require: (name) => {
    if (name === 'next/server') return { NextResponse }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return auth
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  modules[path] = exports
  return exports
}
const req = (data) => ({ json: async () => data })
// Objetos criados dentro do vm têm outro protótipo: compara a forma
const plain = (v) => JSON.parse(JSON.stringify(v))
const deep = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg)

const id = load('src/lib/identity.ts')
// telefone: só números, DDD + número, com ou sem 55
assert.equal(id.normalizePhone('(35) 99999-0000'), '35999990000')
assert.equal(id.normalizePhone('+55 35 99999-0000'), '35999990000')
assert.equal(id.normalizePhone('3533330000'), '3533330000')
assert.equal(id.normalizePhone('99999-0000'), null, 'sem DDD')
assert.equal(id.normalizePhone('abc'), null)
assert.equal(id.normalizePhone(''), null)
// e-mail
assert.equal(id.normalizeEmail(' PESSOA@Example.com '), 'pessoa@example.com')
assert.equal(id.normalizeEmail(''), null)
assert.equal(id.normalizeEmail('x'), 'invalid')
// o que a pessoa digita no login
deep(id.parseLogin('pessoa@example.com'), { email: 'pessoa@example.com' })
deep(id.parseLogin('(35) 99999-0000'), { phone: '35999990000' })
assert.equal(id.parseLogin('35'), null)
// pelo menos um contato
deep(id.validateContact({ phone: '(35) 99999-0000' }), { email: null, phone: '35999990000' })
deep(id.validateContact({ email: 'a@b.co', phone: '' }), { email: 'a@b.co', phone: null })
deep(id.validateContact({}), { error: 'Informe um telefone ou um e-mail para entrar' })
deep(id.validateContact({ phone: '123' }).error.startsWith('Telefone inválido'), true)
assert.equal(id.contactLabel({ email: null, phone: '35999990000' }), '(35) 99999-0000')
assert.equal(id.contactLabel({ email: 'a@b.co', phone: '35999990000' }), 'a@b.co')

;(async () => {
  const reg = load('src/lib/registration.ts')
  const login = load('src/app/api/auth/login/route.ts')

  // cadastro só com telefone
  let r = await reg.registrationIdentity({ name: 'Manoel', phone: '(35) 99999-0000', password: 'segredo1' })
  assert.equal(r.error, undefined)
  deep({ email: r.identity.email, phone: r.identity.phone }, { email: null, phone: '35999990000' })
  users.push({ id: 'u1', name: 'Manoel', email: null, phone: '35999990000', password: 'hash:segredo1', role: 'lite' })
  // o mesmo telefone não cadastra de novo, mesmo escrito diferente
  r = await reg.registrationIdentity({ name: 'Outro', phone: '35 99999 0000', password: 'segredo1' })
  assert.equal((await r.error.json()).error, 'Este telefone já tem uma conta. Entre para continuar seu cadastro.')
  // sem nenhum contato
  r = await reg.registrationIdentity({ name: 'Sem', password: 'segredo1' })
  assert.equal((await r.error.json()).error, 'Informe um telefone ou um e-mail para entrar')
  // só e-mail continua valendo
  r = await reg.registrationIdentity({ name: 'Edeuza', email: 'EDEUZA@example.com', password: 'segredo1' })
  deep({ email: r.identity.email, phone: r.identity.phone }, { email: 'edeuza@example.com', phone: null })
  users.push({ id: 'u2', name: 'Edeuza', email: 'edeuza@example.com', phone: null, password: 'hash:segredo1', role: 'lite' })

  // login pelo telefone, com máscara ou sem, e pelo e-mail; o campo antigo `email` ainda funciona
  let res = await login.POST(req({ login: '(35) 99999-0000', password: 'segredo1' }))
  assert.equal(res.status, 200); assert.equal(res.savedCookies.session, 'u1')
  res = await login.POST(req({ login: '35999990000', password: 'errada' }))
  assert.equal(res.status, 401); assert.equal((await res.json()).error, 'Telefone ou senha incorretos')
  res = await login.POST(req({ login: 'Edeuza@Example.com', password: 'segredo1' }))
  assert.equal(res.status, 200); assert.equal(res.savedCookies.session, 'u2')
  res = await login.POST(req({ email: 'edeuza@example.com', password: 'segredo1' }))
  assert.equal(res.status, 200)
  res = await login.POST(req({ login: '35', password: 'segredo1' }))
  assert.equal(res.status, 400)
  console.log('login-telefone: ok')
})().catch((e) => { console.error(e); process.exit(1) })
