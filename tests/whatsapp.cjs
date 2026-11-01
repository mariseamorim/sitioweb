// Lançamento pelo WhatsApp: entender a mensagem, achar a conta pelo telefone, casar o animal e responder (regra pura)
// node tests/whatsapp.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const loaded = {}
function load(path) {
  if (loaded[path]) return loaded[path]
  const exports = {}
  loaded[path] = exports
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require: (name) => { if (name.startsWith('./')) return load(`src/lib/${name.slice(2)}.ts`); throw new Error(`módulo inesperado: ${name}`) } })
  return exports
}

const w = load('src/lib/whatsapp.ts')
const today = '2026-10-26'
const plain = (v) => JSON.parse(JSON.stringify(v))
const parse = (text) => plain(w.parseMessage(text, today))

// Total do dia
assert.deepEqual(parse('120 litros'), { kind: 'leite', liters: 120, date: today, animalRef: null, cowsMilked: null })
assert.deepEqual(parse('120'), { kind: 'leite', liters: 120, date: today, animalRef: null, cowsMilked: null }, 'só o número vale')
assert.deepEqual(parse('Deu 47,5 litros hoje'), { kind: 'leite', liters: 47.5, date: today, animalRef: null, cowsMilked: null })
assert.deepEqual(parse('cento e vinte litros'), { kind: 'leite', liters: 120, date: today, animalRef: null, cowsMilked: null }, 'por extenso, como na voz')
assert.deepEqual(parse('120 litros de 8 vacas'), { kind: 'leite', liters: 120, date: today, animalRef: null, cowsMilked: 8 })
assert.deepEqual(parse('8 vacas 120 litros'), { kind: 'leite', liters: 120, date: today, animalRef: null, cowsMilked: 8 }, 'ordem não importa')

// Dia
assert.equal(parse('120 litros ontem').date, '2026-10-25')
assert.equal(parse('anteontem 120 litros').date, '2026-10-24')
assert.equal(parse('120 litros 24/10').date, '2026-10-24')
assert.equal(parse('120 litros 24/10/2026').date, '2026-10-24')
assert.equal(parse('120 litros 24/10/26').date, '2026-10-24')
assert.equal(parse('120 litros 30/12').date, '2025-12-30', 'dia/mês depois de hoje é do ano passado')
assert.equal(parse('120 litros 31/02').kind, 'desconhecido', 'data impossível')
assert.equal(parse('120 litros 30/12/2026').kind, 'desconhecido', 'futuro não')

// Por animal
assert.deepEqual(parse('vaca 05 12 litros'), { kind: 'leite', liters: 12, date: today, animalRef: '05', cowsMilked: null })
assert.deepEqual(parse('12 litros da Mimosa'), { kind: 'leite', liters: 12, date: today, animalRef: 'mimosa', cowsMilked: null })
assert.deepEqual(parse('#12 deu 9,5 ontem'), { kind: 'leite', liters: 9.5, date: '2026-10-25', animalRef: '12', cowsMilked: null })
assert.deepEqual(parse('vaca 05 12 litros de 3 vacas').cowsMilked, null, 'vacas ordenhadas só no total do dia')
assert.equal(parse('12 litros da manha').animalRef, null, '"da manhã" não é animal')

// Ajuda e o que não dá para entender
assert.equal(parse('ajuda').kind, 'ajuda')
assert.equal(parse('Oi!').kind, 'ajuda')
assert.equal(parse('').kind, 'ajuda')
assert.equal(parse('bom dia, tudo bem?').kind, 'desconhecido')
assert.equal(parse('vendi a vaca').kind, 'desconhecido')
assert.equal(parse('0 litros').kind, 'desconhecido')

// Telefone da Meta (55 + DDD + número) para o que pode estar na conta
assert.deepEqual(Array.from(w.phoneCandidates('5547999887766')), ['47999887766', '4799887766'])
assert.deepEqual(Array.from(w.phoneCandidates('554799887766')), ['4799887766', '47999887766'], 'sem o nono dígito: tenta com ele também')
assert.deepEqual(Array.from(w.phoneCandidates('14155550123')), [], 'número de fora não casa com nada')

// Quem pode anotar: administrador, ou editor com o módulo Leite, sempre com propriedade
assert.equal(w.canNoteMilk({ role: 'admin', farmId: 'f' }), true)
assert.equal(w.canNoteMilk({ role: 'editor', permissions: ['leite'], farmId: 'f' }), true)
assert.equal(w.canNoteMilk({ role: 'editor', permissions: ['animais'], farmId: 'f' }), false)
assert.equal(w.canNoteMilk({ role: 'viewer', permissions: ['leite'], farmId: 'f' }), false)
assert.equal(w.canNoteMilk({ role: 'admin', farmId: null }), false)
assert.equal(w.canNoteMilk({ role: 'lite', farmId: null }), false, 'Anota Aí Leite não tem propriedade')

// Animal pelo número, outro código ou nome
const herd = [
  { id: 'a', code: '05', customCode: null, name: 'Mimosa', status: 'Vivo' },
  { id: 'b', code: '12', customCode: 'BR123', name: 'Estrela', status: 'Vivo' },
  { id: 'c', code: '13', customCode: null, name: 'Mimosa', status: 'Vendido' },
  { id: 'd', code: '14', customCode: null, name: 'Estrelinha', status: 'Vivo' },
]
assert.equal(w.matchAnimal(herd, '05').animal.id, 'a')
assert.equal(w.matchAnimal(herd, '5').animal.id, 'a', 'sem o zero também')
assert.equal(w.matchAnimal(herd, 'br123').animal.id, 'b')
assert.equal(w.matchAnimal(herd, 'mimosa').animal.id, 'a', 'a vendida não conta')
assert.equal(w.matchAnimal(herd, 'estrela').animal.id, 'b', 'nome exato ganha do começo igual')
assert.equal(w.matchAnimal(herd, 'estrelinha').animal.id, 'd')
assert.deepEqual(Array.from(w.matchAnimal(herd, 'est').candidates, (a) => a.id), ['b', 'd'], 'começo igual em duas: pede para escolher')
assert.deepEqual(Array.from(w.matchAnimal(herd, '99').candidates), [])

// O que chega da Meta
const payload = { object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: {
  metadata: { phone_number_id: '111' },
  messages: [
    { id: 'wamid.1', from: '5547999887766', type: 'text', text: { body: '120 litros' } },
    { id: 'wamid.2', from: '5547999887766', type: 'image', image: { id: 'x' } },
  ],
} }] }] }
assert.deepEqual(plain(w.incomingTexts(payload)), [{ id: 'wamid.1', from: '5547999887766', text: '120 litros', phoneNumberId: '111' }], 'só texto')
assert.deepEqual(plain(w.incomingTexts({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })), [], 'confirmação de entrega não é mensagem')
assert.deepEqual(plain(w.incomingTexts('lixo')), [])
const statusPayload = { entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.9', recipient_id: '5547999887766', status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Recipient not available' } }] }, { id: 'wamid.8', recipient_id: '5547999887766', status: 'delivered' }] } }] }] }
assert.deepEqual(plain(w.deliveryStatuses(statusPayload)), [{ id: 'wamid.9', to: '5547999887766', status: 'failed', errors: ['131026 Message undeliverable Recipient not available'] }, { id: 'wamid.8', to: '5547999887766', status: 'delivered', errors: [] }], 'avisos de entrega')
assert.deepEqual(plain(w.deliveryStatuses(payload)), [], 'mensagem não é aviso')

// Respostas
assert.equal(w.savedReply({ liters: 120, date: today, cowsMilked: 8 }, 'Sítio Boa Vista', null, today), 'Anotado: 120 litros no total do dia, hoje, 8 vacas ordenhadas. Propriedade Sítio Boa Vista. Para corrigir, abra Leite no app.')
assert.equal(w.savedReply({ liters: 9.5, date: '2026-10-25', cowsMilked: null }, 'Sítio', herd[0], today), 'Anotado: 9,5 litros da Mimosa (#05), 25/10/2026. Propriedade Sítio. Para corrigir, abra Leite no app.')
assert.match(w.notFoundReply('est', [herd[1], herd[3]]), /mais de um animal.*#BR123 Estrela, #14 Estrelinha/)
assert.match(w.notFoundReply('99', []), /Não achei o animal "99"/)
assert.match(w.HELP_REPLY, /vaca 05 12 litros/)

console.log('whatsapp: ok')
