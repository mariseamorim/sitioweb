// Leitura da folha de coleta do laticínio a partir do texto que o OCR devolve.
// A folha é impressa (cabeçalho, códigos e nomes) com os volumes e o rodapé escritos à mão.
// O impresso lê bem; o manuscrito é sugestão, e a pessoa confere cada número antes de salvar.
// Sem banco e sem navegador: testável com um texto de exemplo.

export interface OcrWord { text: string; confidence: number }

export interface FolhaRow {
  /** Sequência na folha (030) */
  sequence: string | null
  /** Código do produtor no laticínio (005712) */
  producerCode: string | null
  name: string
  /** Volume escrito à mão; null se não leu */
  liters: number | null
  confidence: number | null
}

export interface FolhaParsed {
  dairy: string | null
  route: string | null
  tank: string | null
  /** yyyy-mm-dd, montado com o ano e o mês da folha quando o rodapé só tem dia e mês */
  date: string | null
  rows: FolhaRow[]
  total: number | null
  temperature: number | null
  sample: string | null
  ruler: number | null
  alizarol: string | null
  /** Quantos campos esperados foram lidos (para a tela dizer "li 6 de 8") */
  found: number
  expected: number
}

const MONTHS = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Número escrito à mão lido com trocas comuns do OCR (O por 0, l/I por 1, S por 5, B por 8) */
export function handNumber(token: string | null | undefined): number | null {
  if (!token) return null
  const fixed = token.trim().replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/[^\d.,]/g, '').replace(',', '.')
  if (!fixed || !/\d/.test(fixed)) return null
  const n = parseFloat(fixed)
  return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 10) / 10 : null
}

const num = (re: RegExp, text: string) => { const m = text.match(re); return m ? handNumber(m[1]) : null }
const str = (re: RegExp, text: string) => { const m = text.match(re); return m ? m[1].trim() : null }

/** Confiança média (0 a 100) das palavras que compõem um trecho; null sem palavras */
export function confidenceOf(words: OcrWord[], ...tokens: (string | null)[]): number | null {
  const wanted = tokens.filter((t): t is string => !!t).map((t) => t.toLowerCase())
  const hits = words.filter((w) => wanted.includes(w.text.toLowerCase().replace(/[^\w.,/]/g, '')))
  if (!hits.length) return null
  return Math.round(hits.reduce((s, w) => s + w.confidence, 0) / hits.length)
}

export function parseFolha(text: string, words: OcrWord[] = [], today = new Date()): FolhaParsed {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const flat = lines.join('\n')
  const upper = fold(flat).toUpperCase()

  const dairy = str(/^(.*LATIC[IÍ]NIOS?.*)$/im, flat)
  // A rota termina onde começa a próxima coluna impressa (Seq. Coleta, Tanque) ou a linha
  const route = str(/ROTA[.\s:]*([A-Z0-9][A-Z0-9 \-]{1,30}?)\s*(?:\n|SEQ|TANQUE|P[AÁ]GINA|$)/i, flat)
  const tankMatch = flat.match(/TANQUE[.\s:]*(\d{2,6})/i)
  const tank = tankMatch ? tankMatch[1] : null

  // Mês e ano da folha ("Mês: julho  Ano: 2026")
  const monthWord = str(/M[EÊ]S[.\s:]*([A-Za-zçÇ]+)/i, flat)
  const monthIndex = monthWord ? MONTHS.indexOf(fold(monthWord.toLowerCase())) : -1
  const yearMatch = flat.match(/ANO[.\s:]*(\d{2,4})/i)
  const baseYear = yearMatch ? (yearMatch[1].length === 2 ? 2000 + Number(yearMatch[1]) : Number(yearMatch[1])) : today.getFullYear()

  // Data da coleta no rodapé (10/6/26) ou só o dia na coluna ("DATA: 10")
  let date: string | null = null
  const footer = flat.match(/COLETA[^\n\d]{0,12}(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?/i)
  const column = flat.match(/DATA[.\s:]*(\d{1,2})\b/i)
  const build = (d: number, m: number, y: number) => {
    if (d < 1 || d > 31 || m < 1 || m > 12) return null
    const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return Number.isNaN(Date.parse(iso)) ? null : iso
  }
  if (footer) {
    const y = footer[3] ? (footer[3].length === 2 ? 2000 + Number(footer[3]) : Number(footer[3])) : baseYear
    // Mês do rodapé diferente do mês impresso na folha: vale o impresso (o manuscrito confunde 6 e 7)
    const m = monthIndex >= 0 && monthIndex + 1 !== Number(footer[2]) ? monthIndex + 1 : Number(footer[2])
    date = build(Number(footer[1]), m, y)
  } else if (column && monthIndex >= 0) {
    date = build(Number(column[1]), monthIndex + 1, baseYear)
  }

  // Linhas dos produtores: seq, código, nome e o volume escrito à mão (pode faltar)
  const rows: FolhaRow[] = []
  for (const line of lines) {
    const m = fold(line).match(/^(\d{3})\s+(\d{5,7})\s+([A-Z][A-Z .]{2,}?)(?:\s+([0-9OolIS|B]{1,4}(?:[.,]\d)?))?\s*$/i)
    if (!m) continue
    const volume = m[4] ?? null
    rows.push({
      sequence: m[1], producerCode: m[2], name: m[3].trim().replace(/\s+/g, ' '),
      liters: handNumber(volume), confidence: volume ? confidenceOf(words, volume) : null,
    })
  }

  // Números do rodapé: o primeiro caractere tem que ser dígito de verdade (as letras O, I, S e B do texto impresso
  // não podem virar número). O total fica na mesma linha; os outros podem cair na linha seguinte.
  const total = num(/TOTAIS? DO TANQUE[^\S\n]{0,12}([0-9][0-9OolIS|B]{0,4}(?:[.,]\d)?)\b/i, upper) ?? num(/TOTAL DE LEITE COLETADO[^\S\n:]{0,3}:?[^\S\n]{0,12}([0-9][0-9OolIS|B]{0,4}(?:[.,]\d)?)\b/i, upper)
  const temperature = num(/TEMP[^0-9\n]{0,8}([0-9][0-9O]?(?:[.,]\d)?)\b/i, upper)
  const sampleRaw = str(/AMOSTRA[^0-9\n]{0,8}([0-9][0-9OolIS|B]{0,4})\b/i, upper)
  const sample = sampleRaw ? String(handNumber(sampleRaw) ?? sampleRaw) : null
  const ruler = num(/R[EÉ]GUA[^0-9]{0,24}([0-9][0-9OolIS|B]{0,2}(?:[.,]\d)?)\b/i, upper)
  // Alizarol: só o resultado escrito (negativo, positivo, ok); "Valor Régua" vem logo depois e não conta
  const alizarol = str(/ALIZAROL[.\s:]{0,4}(NEG[A-Z]*|POS[A-Z]*|OK|NORMAL)\b/i, upper)

  const fields = [date, rows.length ? rows : null, total, temperature, sample, ruler]
  return {
    dairy, route, tank, date, rows, total, temperature, sample, ruler, alizarol,
    found: fields.filter((f) => f !== null).length, expected: fields.length,
  }
}
