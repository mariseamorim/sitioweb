const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('src/app/api/contato/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
let delivery, fail = false, accepted = true, closed = 0
const env = {}
const context = { exports: {}, Request, Response, URL, Date, process: { env }, require: name => {
  if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } }
  if (name === 'nodemailer') return { createTransport: () => ({ sendMail: async message => { delivery = message; if (fail) throw new Error('secret SMTP diagnostic'); return { accepted: accepted ? ['recipient'] : [] } }, close: () => { closed++ } }) }
  throw new Error(name)
} }
vm.runInNewContext(source, context)
const payload = { name: 'Pessoa Teste', email: 'pessoa@example.com', purpose: 'demo', message: 'Gostaria de conhecer o sistema.', website: '' }
const request = (data = payload, origin = 'http://localhost:3457') => new Request('http://localhost:3457/api/contato', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(data) })
async function main() {
  assert.equal((await context.exports.POST(request(payload, 'https://other.example'))).status, 403)
  assert.equal((await context.exports.POST(request({ ...payload, email: 'inválido' }))).status, 400)
  assert.equal((await context.exports.POST(request({ ...payload, website: 'spam' }))).status, 400)
  assert.equal((await context.exports.POST(request({ ...payload, message: 'a'.repeat(3001) }))).status, 400)
  assert.equal((await context.exports.POST(request())).status, 503)
  assert.equal(delivery, undefined)
  env.CONTACT_GMAIL_USER = 'sender@gmail.com'; env.CONTACT_GMAIL_APP_PASSWORD = 'test-only'
  assert.equal((await context.exports.POST(request())).status, 200)
  assert.equal(delivery.to, 'anotaaiagro@gmail.com')
  assert.equal(delivery.replyTo.address, payload.email)
  assert.equal(delivery.from.address, env.CONTACT_GMAIL_USER)
  assert.ok(delivery.text.includes(payload.message))
  fail = true
  const failed = await context.exports.POST(request())
  assert.equal(failed.status, 502)
  assert.ok(!(await failed.text()).includes('secret'))
  fail = false; accepted = false
  assert.equal((await context.exports.POST(request())).status, 502)
  accepted = true
  for (let i = 0; i < 17; i++) assert.equal((await context.exports.POST(request())).status, 200)
  assert.equal((await context.exports.POST(request())).status, 429)
  assert.equal(closed, 20)
  console.log('Contact API: validação, configuração, destinatário, sucesso, falhas e limite aprovados (SMTP simulado).')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
