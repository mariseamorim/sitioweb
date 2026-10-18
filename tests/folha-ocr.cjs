// Leitura da folha de coleta a partir do texto do OCR (regra pura)
// node tests/folha-ocr.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const exports_ = {}
const code = ts.transpileModule(fs.readFileSync('src/lib/folhaOcr.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { exports: exports_, Date, console, require: () => { throw new Error('sem dependências') } })
const { parseFolha, handNumber, confidenceOf } = exports_
const plain = (v) => JSON.parse(JSON.stringify(v))

// trocas comuns do OCR em número escrito à mão
assert.equal(handNumber('1OO'), 100)
assert.equal(handNumber('49'), 49)
assert.equal(handNumber('l49'), 149)
assert.equal(handNumber('66,5'), 66.5)
assert.equal(handNumber('abc'), null)
assert.equal(handNumber(''), null)

// texto parecido com o que o OCR devolve da folha enviada
const text = `
LATICINIOS DANY LTDA                       Página: 01 / 01
ROTA.....: 0025 BR 421                     Seq. Coleta: 01
TANQUE: 0475 MANOEL RAMOS AMORIN           Mês: julho   Ano: 2026
Seq Produtor Nome              DATA: 10      Hora    Aliz.  Hig.
030 005712 MANOEL RAMOS AMORIN  1OO
031 005713 EDEUZA MARIA BORGES DE AMORIN 49
                                                        TOTAL  l49
TOTAIS DO TANQUE
Data/Hora Coleta: 10/6/26  __:__   Total de Leite Coletado:
Temp°: 04   Amostra: 23   Alizarol:          Valor Régua: 66
Carreteiro: Joel                   Ass.:
`
const words = [{ text: '1OO', confidence: 71 }, { text: '49', confidence: 88 }, { text: '66', confidence: 90 }]
const f = parseFolha(text, words, new Date('2026-07-12T12:00:00Z'))
assert.match(f.dairy, /LATICINIOS DANY LTDA/)
assert.equal(f.route, '0025 BR 421')
assert.equal(f.tank, '0475')
// rodapé diz 10/6 mas a folha é de julho: vale o mês impresso
assert.equal(f.date, '2026-07-10')
deepRows(f.rows, [
  { sequence: '030', producerCode: '005712', name: 'MANOEL RAMOS AMORIN', liters: 100, confidence: 71 },
  { sequence: '031', producerCode: '005713', name: 'EDEUZA MARIA BORGES DE AMORIN', liters: 49, confidence: 88 },
])
assert.equal(f.temperature, 4)
assert.equal(f.sample, '23')
assert.equal(f.ruler, 66)
assert.equal(f.alizarol, null)
assert.equal(f.total, null, 'o total escrito na coluna TOTAL não é o "TOTAIS DO TANQUE"')
assert.equal(f.found, 5); assert.equal(f.expected, 6)

// linha sem volume escrito; total do tanque preenchido; data só pela coluna
const f2 = parseFolha(`TANQUE: 0475\nMês: agosto Ano: 2026\nDATA: 3\n030 005712 MANOEL RAMOS AMORIN\n031 005713 EDEUZA MARIA BORGES DE AMORIN 52\nTOTAIS DO TANQUE 152\nTemp: 5`, [], new Date('2026-08-05T12:00:00Z'))
assert.equal(f2.date, '2026-08-03')
assert.equal(f2.rows[0].liters, null)
assert.equal(f2.rows[1].liters, 52)
assert.equal(f2.total, 152)
assert.equal(f2.temperature, 5)

// nada lido
const f3 = parseFolha('texto qualquer sem folha')
assert.equal(f3.found, 0); assert.equal(f3.rows.length, 0); assert.equal(f3.date, null)

assert.equal(confidenceOf(words, '49', '66'), 89)
assert.equal(confidenceOf(words, 'xx'), null)

function deepRows(a, b) { assert.deepEqual(plain(a), plain(b)) }
console.log('folha-ocr: ok')
