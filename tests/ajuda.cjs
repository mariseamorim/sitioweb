// Ajuda por tela: quem vê cada passo a passo (módulo liberado, perfil ou todo mundo) e os nomes dos perfis (regra pura, sem banco)
// node tests/ajuda.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(path) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: (name) => { throw new Error(`módulo inesperado: ${name}`) } })
  return exports
}

const help = load('src/lib/pageHelp.ts')
const roles = load('src/lib/roles.ts')

const none = () => false
const all = () => true
const only = (...mods) => (m) => mods.includes(m)

// Módulo da propriedade: depende do que foi liberado, não do perfil
assert.equal(help.canSeeHelp(help.PAGE_HELP['/animais'], { role: 'viewer' }, only('animais')), true)
assert.equal(help.canSeeHelp(help.PAGE_HELP['/animais'], { role: 'viewer' }, only('leite')), false)
assert.equal(help.canSeeHelp(help.PAGE_HELP['/animais'], { role: 'fornecedor' }, none), false, 'fornecedor não tem módulos')

// Painel do fornecedor: pelo perfil
assert.equal(help.canSeeHelp(help.PAGE_HELP['/fornecedor'], { role: 'fornecedor' }, none), true)
assert.equal(help.canSeeHelp(help.PAGE_HELP['/fornecedor'], { role: 'editor' }, all), false, 'produtor não vê o painel do fornecedor')
assert.equal(help.canSeeHelp(help.PAGE_HELP['/fornecedor'], { role: 'admin' }, all), false, 'admin também não: a ajuda é do perfil')

// Meu cadastro: todo mundo logado
assert.equal(help.canSeeHelp(help.PAGE_HELP['/perfil'], { role: 'fornecedor' }, none), true)
assert.equal(help.canSeeHelp(help.PAGE_HELP['/perfil'], { role: 'viewer' }, none), true)
assert.equal(help.canSeeHelp(help.PAGE_HELP['/perfil'], null, all), false, 'sem login não há ajuda por tela')

// A lista da página Ajuda
// Array.from no contexto do teste: a lista vem do sandbox e deepEqual compara o protótipo
assert.deepEqual(Array.from(help.visibleHelp({ role: 'fornecedor' }, none), ([href]) => href), ['/fornecedor', '/perfil'], 'fornecedor vê o painel e o cadastro')
assert.deepEqual(Array.from(help.visibleHelp(null, all)), [])
const producer = Array.from(help.visibleHelp({ role: 'editor' }, only('animais', 'leite')), ([href]) => href)
assert.deepEqual(producer, ['/animais', '/milk-production', '/perfil'])
assert.ok(help.PAGE_HELP['/fornecedor'].steps.some((s) => s.includes('Meu cadastro')), 'a ajuda do fornecedor diz onde editar nome, telefone e senha')

assert.equal(help.isPanelRole('fornecedor'), true)
assert.equal(help.isPanelRole('laticinio'), true)
assert.equal(help.isPanelRole('editor'), false)
assert.equal(help.isPanelRole(undefined), false)

assert.equal(roles.roleLabel('fornecedor'), 'Fornecedor')
assert.equal(roles.roleLabel('viewer'), 'Leitor')
assert.equal(roles.roleLabel('lite'), 'Anota Aí Leite')
assert.equal(roles.roleLabel('desconhecido'), 'desconhecido', 'perfil fora da lista aparece como está')

console.log('ajuda: ok')
