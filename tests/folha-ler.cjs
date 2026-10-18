// Leitura na nuvem: a rota monta o texto e as palavras a partir da resposta do Vision e falha de forma clara sem chave
// node tests/folha-ler.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

let env = { GOOGLE_VISION_API_KEY: 'chave-teste' }
let visionReply = null, calls = []
const NextResponse = { json: (data, options) => Response.json(data, options) }
function load(path) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, console, Response, AbortSignal, encodeURIComponent, process: { env }, fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return visionReply }, require: (name) => {
    if (name === 'next/server') return { NextResponse }
    if (name === '@/lib/auth') return { requireUser: async () => ({ user: { id: 'u1', role: 'lite' } }) }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  return exports
}
const req = (data) => ({ json: async () => data })
const sym = (t, brk) => ({ text: t, ...(brk ? { property: { detectedBreak: { type: brk } } } : {}) })
const word = (t, confidence, brk) => ({ confidence, symbols: [...t.slice(0, -1)].map((c) => sym(c)).concat([sym(t.slice(-1), brk)]) })

;(async () => {
  const api = load('src/app/api/lite/folha/ler/route.ts')
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(100)

  // resposta do Vision vira texto com linhas e palavras com confiança de 0 a 100
  visionReply = Response.json({ responses: [{ fullTextAnnotation: { text: 'x', pages: [{ blocks: [{ paragraphs: [
    { words: [word('030', 0.99, 'SPACE'), word('005712', 0.98, 'SPACE'), word('MANOEL', 0.97, 'SPACE'), word('100', 0.71, 'LINE_BREAK')] },
    { words: [word('Temp:', 0.9, 'SPACE'), word('04', 0.66, 'EOL_SURE_SPACE')] },
  ] }] }] } }] })
  let res = await api.POST(req({ photo }))
  assert.equal(res.status, 200)
  let body = await res.json()
  assert.equal(body.engine, 'nuvem')
  assert.equal(body.text, '030 005712 MANOEL 100\nTemp: 04\n')
  assert.deepEqual(body.words.map((w) => [w.text, w.confidence]), [['030', 99], ['005712', 98], ['MANOEL', 97], ['100', 71], ['Temp:', 90], ['04', 66]])
  assert.ok(calls[0].url.startsWith('https://vision.googleapis.com/v1/images:annotate?key=chave-teste'))
  assert.equal(calls[0].body.requests[0].features[0].type, 'DOCUMENT_TEXT_DETECTION')
  assert.deepEqual(calls[0].body.requests[0].imageContext.languageHints, ['pt'])
  assert.equal(calls[0].body.requests[0].image.content, 'A'.repeat(100), 'manda só o conteúdo em base64')

  // foto inválida
  assert.equal((await api.POST(req({ photo: 'data:image/png;base64,xx' }))).status, 400)
  // o serviço falhou
  visionReply = new Response('erro', { status: 500 })
  assert.equal((await api.POST(req({ photo }))).status, 502)
  visionReply = Response.json({ responses: [{ error: { message: 'bad' } }] })
  assert.equal((await api.POST(req({ photo }))).status, 502)
  // sem chave: 503, e o app usa o leitor do aparelho
  env = {}
  const semChave = load('src/app/api/lite/folha/ler/route.ts')
  res = await semChave.POST(req({ photo }))
  assert.equal(res.status, 503)
  console.log('folha-ler: ok')
})().catch((e) => { console.error(e); process.exit(1) })
