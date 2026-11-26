// Consanguinidade: o touro não pode ser o pai nem um avô da fêmea (regra pura, sem banco)
// node tests/consanguinidade.cjs
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

const site = load('src/lib/inbreeding.ts')
// O app tem uma cópia: tem de ser a mesma regra
// (o cabeçalho de comentário muda: compara a partir do primeiro export)
const code = (path) => { const src = fs.readFileSync(path, 'utf8').replace(/\r/g, ''); return src.slice(src.indexOf('\nexport ')) }
assert.equal(
  code('src/lib/inbreeding.ts'),
  code('mobile/src/lib/inbreeding.ts'),
  'mobile/src/lib/inbreeding.ts diferente do site',
)

const a = (id, name, gender, motherId = null, code = id, customCode = null) => ({ id, name, code, customCode, gender, motherId })
// Família: Sultão (touro do rebanho, filho de Atlas) cobriu Mimosa (filha de Trovão) e nasceu Estrela
const animals = [
  a('sultao', 'Sultão', 'Macho', null, '101', 'BR-77'),
  a('vovo', 'Vovó', 'Fêmea'),
  a('mimosa', 'Mimosa', 'Fêmea', 'vovo'),
  a('estrela', 'Estrela', 'Fêmea', 'mimosa'),
  a('outra', 'Outra', 'Fêmea'),
]
const births = [
  { calfId: 'estrela', maleName: 'Sultão', bullRegistry: null },
  { calfId: 'mimosa', maleName: 'Girolando — Trovão', bullRegistry: 'RGD 555' },
  { calfId: 'sultao', maleName: 'Atlas', bullRegistry: null },
]
const check = (femaleId, bull) => site.inbreedingConflict(femaleId, bull, animals, births)

// Pai: pelo nome (sem acento e sem maiúscula), pelo número e pelo brinco do touro do rebanho
assert.equal(check('estrela', { maleName: 'Sultão' })?.kinship, 'pai')
assert.equal(check('estrela', { maleName: ' sultao ' })?.kinship, 'pai')
assert.equal(check('estrela', { maleName: '101' })?.kinship, 'pai', 'número do touro no rebanho')
assert.equal(check('estrela', { maleName: 'x', bullRegistry: 'br-77' })?.kinship, 'pai', 'brinco no campo de registro')
// Avô por parte de mãe: pelo registro do sêmen, mesmo com outro nome escrito
assert.equal(check('estrela', { maleName: 'Trovão', bullRegistry: 'RGD 555' })?.kinship, 'avô materno')
assert.equal(check('estrela', { maleName: 'girolando — trovão' })?.kinship, 'avô materno')
// Avô por parte de pai: o pai é touro do rebanho e a cobertura que gerou ele está anotada
assert.equal(check('estrela', { maleName: 'Atlas' })?.kinship, 'avô paterno')
// Pode: outro touro, fêmea sem parentesco, nada informado
assert.equal(check('estrela', { maleName: 'Netuno' }), null)
assert.equal(check('outra', { maleName: 'Sultão' }), null)
assert.equal(check('estrela', { maleName: '', bullRegistry: '' }), null)
assert.equal(check('mimosa', { maleName: 'Sultão' }), null, 'Sultão não é pai nem avô de Mimosa')

// Pai digitado no cadastro (sem a cobertura que gerou o animal): vale o nome ou o registro
const bought = [
  a('comprada', 'Comprada', 'Fêmea', 'mae', 'c1'),
  { ...a('mae', 'Mãe', 'Fêmea'), fatherName: 'RGD 999' },
  { ...a('touro', 'Netuno', 'Macho'), fatherName: 'Zeus' },
]
bought[0].fatherName = 'Netuno'
const byField = (bull) => site.inbreedingConflict('comprada', bull, bought, [])
assert.equal(byField({ maleName: 'netuno' })?.kinship, 'pai')
assert.equal(byField({ maleName: 'Outro', bullRegistry: 'rgd 999' })?.kinship, 'avô materno', 'pai da mãe digitado como registro')
assert.equal(byField({ maleName: 'Zeus' })?.kinship, 'avô paterno', 'pai do touro do rebanho, digitado')
assert.equal(byField({ maleName: 'Apolo' }), null)
// A cobertura anotada vale mais que o campo digitado
assert.equal(site.inbreedingConflict('comprada', { maleName: 'Netuno' }, bought, [{ calfId: 'comprada', maleName: 'Hércules', bullRegistry: null }]), null)
assert.equal(site.cleanFatherName('  RGD   12 '), 'RGD 12')
assert.equal(site.cleanFatherName(''), null)
assert.equal(site.cleanFatherName(5), null)

// Mensagem
assert.equal(site.inbreedingMessage({ kinship: 'avô materno', bull: 'Trovão' }), 'Cruzamento bloqueado: Trovão é o avô por parte de mãe desta fêmea. Escolha outro touro ou sêmen.')

console.log('consanguinidade: ok')
