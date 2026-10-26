// Cobertura: tipos, o que "repetir para outra fêmea" mantém, gestação e o que o servidor aceita (regra pura, sem banco)
// node tests/cobertura.cjs
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

const c = load('src/lib/coverage.ts')

// Tipos: os quatro do mercado (IA, IATF, monta natural, repasse)
assert.deepEqual(Array.from(c.COVERAGE_METHODS, (m) => m.key), ['ia', 'iatf', 'natural', 'repasse'])
assert.equal(c.isCoverageMethod('iatf'), true)
assert.equal(c.isCoverageMethod('te'), false)
assert.equal(c.methodLabel('iatf'), 'IATF')
assert.equal(c.methodLabel(null), 'Cobertura', 'sem tipo informado continua "Cobertura"')
assert.equal(c.isInsemination('ia'), true)
assert.equal(c.isInsemination('iatf'), true)
assert.equal(c.isInsemination('repasse'), false, 'repasse é o touro, não tem sêmen')

// Repetir para outra fêmea: data, tipo, touro, partida e inseminador ficam; fêmea, cio e observação saem
const form = { femaleId: 'v1', coverageDate: '2026-10-20', method: 'iatf', maleName: 'Trovão', bullRegistry: 'RGD 1', semenBatch: '2412-A', inseminator: 'João', heatDate: '2026-10-18', status: 'Coberta', observations: 'cio forte' }
const next = c.repeatCoverage(form)
assert.deepEqual({ ...next }, { ...form, femaleId: '', heatDate: '', observations: '' }) // cópia: o objeto vem do sandbox
assert.deepEqual(Array.from(c.repeatedFields(form)), ['data', 'iatf', 'touro Trovão', 'partida 2412-A', 'inseminador João'])
assert.deepEqual(Array.from(c.repeatedFields({ ...form, method: 'natural' })), ['data', 'monta natural', 'touro Trovão'], 'na monta não há partida nem inseminador')
assert.deepEqual(Array.from(c.repeatedFields({ ...c.EMPTY_COVERAGE, coverageDate: '2026-10-20' })), ['data'])

// Gestação: dias desde a cobertura e quanto falta
assert.equal(c.GESTATION_DAYS, 280)
assert.equal(c.plusDays('2026-10-20', 280), '2027-07-27')
const g = c.gestation('2026-01-01', '2026-10-08', '2026-04-11')
assert.deepEqual({ ...g }, { days: 100, toBirth: 180, percent: 36 })
assert.equal(c.gestation('2026-01-01', '2026-10-08', '2026-10-20').toBirth, -12, 'parto atrasado fica negativo')
assert.equal(c.gestation('2026-01-01', '2026-10-08', '2026-10-20').percent, 100)
assert.equal(c.gestation('2026-01-01', null, '2026-04-11'), null, 'vazia ou perdida não tem gestação')
assert.equal(c.gestation('2026-01-01T00:00:00.000Z', '2026-10-08T00:00:00.000Z', '2026-01-01').days, 0, 'datas do banco (ISO completo) também valem')

// O que o servidor aceita
assert.deepEqual({ ...c.parseCoverageDetails({ method: 'iatf', heatDate: '2026-10-18', semenBatch: ' 2412-A ', bullRegistry: 'RGD 1', inseminator: 'João' }) },
  { method: 'iatf', heatDate: '2026-10-18', semenBatch: '2412-A', bullRegistry: 'RGD 1', inseminator: 'João' })
assert.deepEqual({ ...c.parseCoverageDetails({ method: 'repasse', semenBatch: '2412-A', inseminator: 'João', bullRegistry: 'RGD 1' }) },
  { method: 'repasse', heatDate: null, semenBatch: null, bullRegistry: 'RGD 1', inseminator: null }, 'repasse e monta descartam partida e inseminador')
assert.deepEqual({ ...c.parseCoverageDetails({ method: 'te', heatDate: '18/10/2026', semenBatch: '', inseminator: 42 }) },
  { method: null, heatDate: null, semenBatch: null, bullRegistry: null, inseminator: null }, 'tipo desconhecido, data fora do padrão e campos vazios viram null')
assert.equal(c.parseCoverageDetails({ inseminator: 'x'.repeat(200) }).inseminator.length, 80, 'texto cortado no tamanho máximo')

console.log('cobertura: ok')
