// Suporte pelo WhatsApp: mensagem, nome da tela, resumo do cadastro e rota (regra pura, sem banco)
// node tests/suporte.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, Intl, console, URLSearchParams, process: { env: { SUPPORT_WHATSAPP: '(31) 99999-0000' } }, require: (name) => {
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error(`módulo inesperado: ${name}`)
  } })
  modules[path] = exports
  return exports
}

const s = load('src/lib/support.ts')

assert.equal(s.hasSupport(), true)
assert.equal(s.supportNumber(), '31999990000')
assert.equal(s.supportLink('oi'), 'https://wa.me/5531999990000?text=oi', 'DDI 55 entra sozinho')

assert.equal(s.screenLabel('/animais'), 'Animais')
assert.equal(s.screenLabel('/lite/associacao'), 'Anota Aí Leite')
assert.equal(s.screenLabel('/'), 'Painel')
assert.equal(s.screenLabel('/nada'), null)

assert.equal(s.supportMessage({ kind: 'ajuda', name: 'Marise', farmName: 'Sítio Três Irmãos', screen: 'Animais' }), 'Olá, sou Marise, de Sítio Três Irmãos. Preciso de ajuda com a tela Animais do Anota Aí Agro.')
assert.equal(s.supportMessage({ kind: 'ajuda', name: 'Marise' }), 'Olá, sou Marise. Preciso de ajuda com o Anota Aí Agro.')
assert.equal(s.supportMessage({ kind: 'entrar' }), 'Olá! Preciso de ajuda para entrar no Anota Aí Agro.')
assert.equal(s.supportMessage({ kind: 'configurar', name: 'João', farmName: 'Boa Vista', summary: 'Propriedade: Boa Vista.' }), 'Olá, sou João, de Boa Vista. Quero ajuda para configurar o Anota Aí Agro na minha propriedade. Propriedade: Boa Vista.')

assert.equal(
  s.setupSummary({ name: 'Sítio Três Irmãos', city: 'Capim Branco', state: 'MG', segments: ['leite', 'cria'] }, 48, 1),
  'Propriedade: Sítio Três Irmãos (Capim Branco, MG). Trabalha com leite, cria. Já cadastrei 48 animais. Tenho 1 dia de leite anotados.',
)
assert.equal(s.setupSummary({ name: 'Nova', segments: [] }, 0, 0), 'Propriedade: Nova. Ainda não informei o que a propriedade faz. Ainda não cadastrei animais.')

assert.equal(s.supportHref('ajuda', 'Produção de leite'), '/api/suporte?kind=ajuda&screen=Produ%C3%A7%C3%A3o+de+leite')
assert.equal(s.supportHref('configurar'), '/api/suporte?kind=configurar')
assert.equal(s.isSupportKind('ajuda'), true)
assert.equal(s.isSupportKind('x'), false)

console.log('suporte: ok')
