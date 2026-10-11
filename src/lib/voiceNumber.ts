// Converte o que a pessoa falou em litros: "quarenta e sete e meio" → 47.5, "cento e vinte" → 120.
// Aceita também o que o reconhecimento do navegador já devolve em algarismos ("47,5 litros").

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
}
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 }
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}
const DECIMAL = new Set(['virgula', 'ponto'])
const HALF = new Set(['meio', 'meia'])
const IGNORED = new Set(['e', 'litro', 'litros', 'l', 'deu', 'foi', 'hoje', 'tem', 'sao', 'ficou'])

// Palavras que o reconhecimento sem internet pode ouvir (o resto vira "[unk]" e é descartado)
export const VOICE_WORDS = [
  ...Object.keys(UNITS), 'três', ...Object.keys(TENS), ...Object.keys(HUNDREDS), 'mil',
  'vírgula', 'ponto', 'meio', 'meia', 'e', 'litro', 'litros',
].filter((w) => w !== 'tres')

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function isNumberWord(w: string) {
  return w in UNITS || w in TENS || w in HUNDREDS || w === 'mil'
}

// Soma um trecho de palavras de número ("mil e duzentos e trinta" → 1230). null se não houver número.
function wordsToInt(words: string[]): number | null {
  let total = 0
  let current = 0
  let found = false
  for (const w of words) {
    if (w in UNITS) current += UNITS[w]
    else if (w in TENS) current += TENS[w]
    else if (w in HUNDREDS) current += HUNDREDS[w]
    else if (w === 'mil') { total += (current || 1) * 1000; current = 0 }
    else continue
    found = true
  }
  return found ? total + current : null
}

// Parte depois da vírgula: "cinco" → 0,5; "zero cinco" → 0,05; "vinte e cinco" → 0,25
function decimalPart(words: string[]): number | null {
  const nums = words.filter(isNumberWord)
  if (!nums.length) return null
  let zeros = 0
  while (zeros < nums.length - 1 && nums[zeros] === 'zero') zeros++
  const value = wordsToInt(nums.slice(zeros))
  if (value === null) return null
  return Number(`0.${'0'.repeat(zeros)}${value}`)
}

export function parseSpokenLiters(text: string): number | null {
  const clean = normalize(text)
    .replace(/\b(\d{1,3})\.(\d{3})\b(?!\.\d)/g, '$1$2') // "1.200" é milhar
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1,$2')

  // Algarismos ("47", "47,5", "47.5 litros")
  const digits = clean.match(/\d+(?:,\d+)?/)
  if (digits) {
    const value = Number(digits[0].replace(',', '.'))
    const half = /\d\s+e\s+(meio|meia)\b/.test(clean) ? 0.5 : 0
    return Number.isFinite(value) ? value + half : null
  }

  const words = clean.split(/[^a-z]+/).filter((w) => w && !(IGNORED.has(w) && w !== 'e'))
  const sep = words.findIndex((w) => DECIMAL.has(w))
  const intWords = sep >= 0 ? words.slice(0, sep) : words
  const intValue = wordsToInt(intWords)
  const decimal = sep >= 0 ? decimalPart(words.slice(sep + 1)) : null
  const half = sep < 0 && intWords.some((w, i) => HALF.has(w) && i > 0) ? 0.5 : 0

  if (intValue === null && decimal === null) return null
  return Math.round(((intValue ?? 0) + (decimal ?? 0) + half) * 100) / 100
}
