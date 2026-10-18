// Folha: quando a nuvem não lê, a tela diz o motivo certo (sem chave, Google recusou, rede, login)
// node tests/folha-nuvem-mensagem.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const exports_ = {}
const code = ts.transpileModule(fs.readFileSync('src/lib/ocr.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { exports: exports_, require: () => { throw new Error('não deveria carregar módulos') }, window: undefined })
const { cloudErrorMessage } = exports_
// objetos criados no vm não são iguais por referência: compara pelo JSON
const cloudErrorFrom = (status, data) => JSON.parse(JSON.stringify(exports_.cloudErrorFrom(status, data)))

assert.deepEqual(cloudErrorFrom(503, { error: 'Leitura na nuvem não configurada' }), { reason: 'sem-chave', detail: null })
assert.deepEqual(cloudErrorFrom(502, { error: 'recusou', detail: 'This API method requires billing to be enabled.' }), { reason: 'recusada', detail: 'This API method requires billing to be enabled.' })
assert.deepEqual(cloudErrorFrom(504, { error: 'não respondeu', detail: null }), { reason: 'rede', detail: null })
assert.deepEqual(cloudErrorFrom(401, { error: 'Faça login' }), { reason: 'login', detail: null })
assert.deepEqual(cloudErrorFrom(400, { error: 'Foto inválida ou grande demais' }), { reason: 'foto', detail: null })

assert.match(cloudErrorMessage(null, false), /^Sem internet/)
assert.match(cloudErrorMessage({ reason: 'sem-chave', detail: null }, true), /GOOGLE_VISION_API_KEY/)
const recusada = cloudErrorMessage({ reason: 'recusada', detail: 'billing to be enabled' }, true)
assert.match(recusada, /O Google recusou a leitura na nuvem: "billing to be enabled"/)
assert.match(recusada, /faturamento/)
assert.match(cloudErrorMessage({ reason: 'rede', detail: null }, true), /não respondeu/)
assert.match(cloudErrorMessage({ reason: 'login', detail: null }, true), /Entre de novo/)
assert.match(cloudErrorMessage({ reason: 'foto', detail: null }, true), /Tire outra/)
assert.match(cloudErrorMessage(null, true), /feita no aparelho/)
console.log('folha-nuvem-mensagem: ok')
