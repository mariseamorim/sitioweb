// Leitura da folha de coleta a partir do texto do OCR (regra pura)
// node tests/folha-ocr.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const exports_ = {}
const code = ts.transpileModule(fs.readFileSync('src/lib/folhaOcr.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(code, { exports: exports_, Date, console, require: () => { throw new Error('sem dependências') } })
const { parseFolha, handNumber, confidenceOf, linesFromBoxes } = exports_
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
assert.equal(f.total, 149, 'sem TOTAIS DO TANQUE lido, o total é a soma dos nomes')
assert.equal(f.found, 6); assert.equal(f.expected, 6)

// linha sem volume escrito; total do tanque preenchido; data só pela coluna
const f2 = parseFolha(`TANQUE: 0475\nMês: agosto Ano: 2026\nDATA: 3\n030 005712 MANOEL RAMOS AMORIN\n031 005713 EDEUZA MARIA BORGES DE AMORIN 52\nTOTAIS DO TANQUE 152\nTemp: 5`, [], new Date('2026-08-05T12:00:00Z'))
assert.equal(f2.date, '2026-08-03')
assert.equal(f2.rows[0].liters, null)
assert.equal(f2.rows[1].liters, 52)
assert.equal(f2.total, 152)
assert.equal(f2.temperature, 5)

// nada lido
// Nuvem: os números escritos à mão vêm em outro bloco do texto, mas a posição na foto diz de que linha são
const box = (x0, y0, w, h) => ({ x0, y0, x1: x0 + w, y1: y0 + h })
const positioned = [
  { text: '030', confidence: 99, box: box(10, 100, 30, 10) }, { text: '005712', confidence: 99, box: box(50, 100, 50, 10) },
  { text: 'MANOEL', confidence: 99, box: box(110, 100, 50, 10) }, { text: 'RAMOS', confidence: 99, box: box(165, 100, 45, 10) }, { text: 'AMORIN', confidence: 99, box: box(215, 100, 50, 10) },
  { text: '100', confidence: 70, box: box(300, 96, 30, 18) },
  { text: '031', confidence: 99, box: box(10, 120, 30, 10) }, { text: '005713', confidence: 99, box: box(50, 120, 50, 10) },
  { text: 'EDEUZA', confidence: 99, box: box(110, 120, 50, 10) }, { text: 'MARIA', confidence: 99, box: box(165, 120, 45, 10) }, { text: 'BORGES', confidence: 99, box: box(215, 120, 50, 10) }, { text: 'DE', confidence: 99, box: box(270, 120, 15, 10) }, { text: 'AMORIN', confidence: 99, box: box(290, 120, 50, 10) },
  { text: '49', confidence: 85, box: box(360, 117, 25, 16) },
  { text: '149', confidence: 80, box: box(600, 200, 30, 16) },
  { text: 'Temp°:', confidence: 99, box: box(10, 300, 40, 10) }, { text: '04', confidence: 60, box: box(55, 298, 20, 14) },
  { text: 'Amostra:', confidence: 99, box: box(150, 300, 50, 10) }, { text: '93', confidence: 65, box: box(205, 299, 20, 13) },
  { text: 'Valor', confidence: 99, box: box(300, 300, 30, 10) }, { text: 'Régua:', confidence: 99, box: box(335, 300, 40, 10) }, { text: '66', confidence: 75, box: box(380, 298, 20, 14) },
]
assert.deepEqual(plain(linesFromBoxes(positioned)), [
  '030 005712 MANOEL RAMOS AMORIN 100', '031 005713 EDEUZA MARIA BORGES DE AMORIN 49', '149', 'Temp°: 04 Amostra: 93 Valor Régua: 66',
])
assert.equal(linesFromBoxes([{ text: 'x', confidence: 1 }]), null, 'sem posição não remonta')
const cloudText = 'TANQUE: 0475 MANOEL RAMOS AMORIN\nMês: julho Ano: 2026\n030 005712 MANOEL RAMOS AMORIN\n031 005713 EDEUZA MARIA BORGES DE AMORIN\n100\n49\n149\nTemp°:\nAmostra:\nValor Régua:\n04\n93\n66\nData/Hora Coleta: 10/7/26'
const g = parseFolha(cloudText, positioned, new Date('2026-07-12T12:00:00Z'))
deepRows(g.rows, [
  { sequence: '030', producerCode: '005712', name: 'MANOEL RAMOS AMORIN', liters: 100, confidence: 70 },
  { sequence: '031', producerCode: '005713', name: 'EDEUZA MARIA BORGES DE AMORIN', liters: 49, confidence: 85 },
])
assert.equal(g.temperature, 4); assert.equal(g.sample, '93'); assert.equal(g.ruler, 66)
assert.equal(g.total, 149, 'sem total do tanque lido, a soma dos nomes')
assert.equal(g.date, '2026-07-10'); assert.equal(g.tank, '0475')
assert.equal(g.found, 6)

// Linhas coladas na foto (duas fileiras dentro da tolerância) embaralham a remontagem: os volumes não são lidos,
// mas as linhas dos nomes vêm do texto do OCR e a pessoa digita
const tight = positioned.map((w) => (w.box.y0 >= 117 && w.box.y0 <= 120 ? { ...w, box: { ...w.box, y0: w.box.y0 - 14, y1: w.box.y1 - 14 } } : w))
const t = parseFolha(cloudText, tight, new Date('2026-07-12T12:00:00Z'))
assert.deepEqual(plain(t.rows.map((r) => [r.producerCode, r.liters])), [['005712', null], ['005713', null]])

// Colunas à direita na mesma linha não atrapalham o volume (vale o primeiro número depois do nome)
assert.deepEqual(plain(parseFolha('030 005712 MANOEL RAMOS AMORIN 100 149').rows.map((r) => [r.name, r.liters])), [['MANOEL RAMOS AMORIN', 100]])
assert.deepEqual(plain(parseFolha('030 005712 JOSE S SILVA').rows.map((r) => [r.name, r.liters])), [['JOSE S SILVA', null]], 'letra solta no nome não vira volume')

const f3 = parseFolha('texto qualquer sem folha')
assert.equal(f3.found, 0); assert.equal(f3.rows.length, 0); assert.equal(f3.date, null)

assert.equal(confidenceOf(words, '49', '66'), 89)
assert.equal(confidenceOf(words, 'xx'), null)

function deepRows(a, b) { assert.deepEqual(plain(a), plain(b)) }
console.log('folha-ocr: ok')
