// Painel: resumo do mês e do ano (mês a mês) com leite, dinheiro e nascimentos. node tests/painel-periodo.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const exports_ = {}
const code = ts.transpileModule(fs.readFileSync('src/lib/periodSummary.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { exports: exports_, Date, Math, String, Number })
const plain = (v) => JSON.parse(JSON.stringify(v))
const { summarizePeriod, yearBounds } = exports_

const now = new Date(2026, 9, 18, 15) // 18/10/2026
const bounds = yearBounds(now)
assert.equal(bounds.start.toISOString(), '2026-01-01T00:00:00.000Z')
assert.equal(bounds.end.toISOString(), '2026-12-31T23:59:59.999Z')

const input = {
  transactions: [
    { type: 'Receita', amount: 1000, date: '2026-10-05T00:00:00.000Z' },
    { type: 'Despesa', amount: 250.5, date: '2026-10-10T00:00:00.000Z' },
    { type: 'Receita', amount: 800, date: '2026-09-30T00:00:00.000Z' },
    { type: 'Despesa', amount: 100, date: '2026-01-15T00:00:00.000Z' },
  ],
  milk: [
    { quantity: 120.5, date: '2026-10-01T00:00:00.000Z' },
    { quantity: 100, date: '2026-10-18T00:00:00.000Z' },
    { quantity: 90, date: '2026-09-01T00:00:00.000Z' },
  ],
  births: [{ date: '2026-10-02T00:00:00.000Z' }, { date: '2026-03-02T00:00:00.000Z' }],
  milkPrice: 2.5,
}
const s = plain(summarizePeriod(input, now))

assert.equal(s.month.label, 'outubro de 2026')
assert.deepEqual(s.month, { label: 'outubro de 2026', liters: 220.5, milkValue: 551.25, income: 1000, expense: 250.5, balance: 749.5, births: 1 })
assert.equal(s.year.label, '2026')
assert.equal(s.year.liters, 310.5)
assert.equal(s.year.milkValue, 776.25)
assert.equal(s.year.income, 1800)
assert.equal(s.year.expense, 350.5)
assert.equal(s.year.balance, 1449.5)
assert.equal(s.year.births, 2)
assert.equal(s.year.months.length, 10, 'só até o mês atual')
assert.deepEqual(s.year.months.map((m) => m.label), ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out'])
assert.deepEqual(s.year.months[0], { month: '2026-01', label: 'jan', liters: 0, milkValue: 0, income: 0, expense: 100, balance: -100, births: 0 })
assert.deepEqual(s.year.months[8], { month: '2026-09', label: 'set', liters: 90, milkValue: 225, income: 800, expense: 0, balance: 800, births: 0 })
assert.equal(s.year.months[9].liters, 220.5)

// sem preço do litro, sem valor estimado; sem nada, zeros
const empty = plain(summarizePeriod({ transactions: [], milk: [], births: [], milkPrice: null }, new Date(2026, 0, 3)))
assert.equal(empty.month.milkValue, null)
assert.deepEqual(empty.year.months.map((m) => m.label), ['jan'])
assert.equal(empty.year.balance, 0)
console.log('painel-periodo: ok')
