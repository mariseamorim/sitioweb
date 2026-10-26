// Lançamento pelo WhatsApp: a pessoa manda "12 litros" (ou "vaca 05 deu 12 litros ontem") e o app anota.
// Regra pura: entender a mensagem, achar a conta pelo telefone, casar o animal e montar a resposta. Sem banco.

import { parseSpokenLiters } from './voiceNumber'

export const normalizeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const DAY = 86_400_000
const shiftDay = (isoDay: string, days: number) => new Date(Date.parse(`${isoDay}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
const validDay = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null
}

export type ParsedMessage =
  | { kind: 'ajuda' }
  | { kind: 'leite'; liters: number; date: string; animalRef: string | null; cowsMilked: number | null }
  | { kind: 'desconhecido' }

const HELP_WORDS = new Set(['ajuda', 'help', 'oi', 'ola', 'menu', 'bom dia', 'boa tarde', 'boa noite', 'comandos', '?'])
const ANIMAL_RE = /\b(?:vaca|animal|brinco|bezerra|novilha|da|do)\s+#?([a-z0-9]+)\b|#([a-z0-9]+)/
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
const COWS_RE = /\b(\d{1,3})\s+vacas?\b/

/** Interpreta a mensagem. `today` é yyyy-mm-dd no fuso da fazenda. */
export function parseMessage(text: string, today: string): ParsedMessage {
  let clean = normalizeText(text)
  if (!clean || HELP_WORDS.has(clean.replace(/[!.]+$/, ''))) return { kind: 'ajuda' }

  // Dia: hoje (padrão), ontem, anteontem ou dd/mm[/aaaa]
  let date = today
  const explicit = clean.match(DATE_RE)
  if (explicit) {
    const [, d, m, y] = explicit
    const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : Number(today.slice(0, 4))
    const day = validDay(year, Number(m), Number(d))
    if (!day) return { kind: 'desconhecido' }
    date = !y && day > today ? validDay(year - 1, Number(m), Number(d)) ?? day : day
    clean = clean.replace(DATE_RE, ' ')
  } else if (/\banteontem\b/.test(clean)) date = shiftDay(today, -2)
  else if (/\bontem\b/.test(clean)) date = shiftDay(today, -1)
  clean = clean.replace(/\b(hoje|ontem|anteontem)\b/g, ' ')
  if (date > today) return { kind: 'desconhecido' }

  // Vacas ordenhadas no total do dia: "12 litros de 3 vacas"
  let cowsMilked: number | null = null
  const cows = clean.match(COWS_RE)
  if (cows) {
    cowsMilked = Number(cows[1])
    clean = clean.replace(COWS_RE, ' ')
  }

  // Animal: "vaca 05", "vaca mimosa", "#05", "da mimosa"
  let animalRef: string | null = null
  const animal = clean.match(ANIMAL_RE)
  if (animal) {
    const ref = animal[1] ?? animal[2]
    // "da manhã", "do dia" não são animais
    if (!['manha', 'tarde', 'noite', 'dia', 'ordenha', 'leite', 'total'].includes(ref)) {
      animalRef = ref
      clean = clean.replace(animal[0], ' ')
    }
  }

  const liters = parseSpokenLiters(clean)
  if (liters === null || !(liters > 0) || liters > 100000) return { kind: 'desconhecido' }
  return { kind: 'leite', liters: Math.round(liters * 100) / 100, date, animalRef, cowsMilked: animalRef ? null : cowsMilked }
}

/**
 * Telefones que podem estar na conta a partir do wa_id da Meta (55 + DDD + número).
 * Celulares antigos vêm sem o nono dígito; a conta pode ter sido gravada com ou sem ele.
 */
export function phoneCandidates(waId: string): string[] {
  // O wa_id vem sempre com o DDI; só atendemos números do Brasil
  const all = waId.replace(/\D/g, '')
  if (!all.startsWith('55')) return []
  const digits = all.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return []
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  const list = [digits]
  if (rest.length === 8) list.push(`${ddd}9${rest}`)
  if (rest.length === 9 && rest.startsWith('9')) list.push(`${ddd}${rest.slice(1)}`)
  return [...new Set(list)]
}

/** Pode anotar leite pelo WhatsApp: mesma regra de canAccessModule + canEdit (src/lib/auth.ts) */
export function canNoteMilk(user: { role: string; permissions?: unknown; farmId?: string | null }) {
  if (!user.farmId) return false
  if (user.role === 'admin') return true
  return user.role === 'editor' && Array.isArray(user.permissions) && user.permissions.includes('leite')
}

export interface MatchableAnimal { id: string; code: string; customCode?: string | null; name: string; status?: string }

const digitsOf = (v: string) => v.replace(/\D/g, '').replace(/^0+/, '')

/** Casa "05", "5", o outro código ou o nome (sem acento). Devolve o animal, ou a lista de parecidos quando há mais de um. */
export function matchAnimal(animals: MatchableAnimal[], ref: string): { animal: MatchableAnimal } | { candidates: MatchableAnimal[] } {
  const alive = animals.filter((a) => !a.status || a.status === 'Vivo')
  const key = normalizeText(ref)
  const byCode = alive.filter((a) => normalizeText(a.code) === key || (a.customCode && normalizeText(a.customCode) === key))
  if (byCode.length === 1) return { animal: byCode[0] }
  if (/^\d+$/.test(key)) {
    const num = alive.filter((a) => digitsOf(a.code) === digitsOf(key) || (a.customCode && digitsOf(a.customCode) === digitsOf(key) && /^\d+$/.test(a.customCode)))
    if (num.length === 1) return { animal: num[0] }
    return { candidates: num }
  }
  const exact = alive.filter((a) => normalizeText(a.name) === key)
  if (exact.length === 1) return { animal: exact[0] }
  if (exact.length > 1) return { candidates: exact }
  const starts = alive.filter((a) => normalizeText(a.name).startsWith(key))
  return starts.length === 1 ? { animal: starts[0] } : { candidates: starts }
}

// ── O que chega da Meta ─────────────────────────────────────────────────

export interface IncomingText { id: string; from: string; text: string; phoneNumberId: string | null }

/** Mensagens de texto do webhook da Meta (entry[].changes[].value.messages[]); outros tipos são ignorados */
export function incomingTexts(payload: unknown): IncomingText[] {
  const out: IncomingText[] = []
  const entries = (payload as { entry?: unknown[] })?.entry
  if (!Array.isArray(entries)) return out
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const value = (change as { value?: { metadata?: { phone_number_id?: string }; messages?: unknown[] } })?.value
      for (const m of value?.messages ?? []) {
        const msg = m as { id?: string; from?: string; type?: string; text?: { body?: string } }
        if (msg.type === 'text' && typeof msg.text?.body === 'string' && msg.from && msg.id) {
          out.push({ id: msg.id, from: msg.from, text: msg.text.body, phoneNumberId: value?.metadata?.phone_number_id ?? null })
        }
      }
    }
  }
  return out
}

// ── Respostas ───────────────────────────────────────────────────────────

const fmtDay = (isoDay: string) => `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}/${isoDay.slice(0, 4)}`
const fmtLiters = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} litro${n === 1 ? '' : 's'}`

export const HELP_REPLY = [
  'Anota Aí Agro. Mande o leite do dia e eu anoto na sua propriedade:',
  '• "120 litros" (total de hoje)',
  '• "120 litros ontem" ou "120 litros 24/10"',
  '• "120 litros de 8 vacas"',
  '• "vaca 05 12 litros" ou "da Mimosa 12 litros" (por animal)',
  'Para corrigir ou apagar, use a tela Leite no app.',
].join('\n')

export const UNKNOWN_REPLY = `Não entendi. Exemplos: "120 litros", "120 litros ontem", "vaca 05 12 litros". Mande "ajuda" para ver todos.`

export const NO_ACCOUNT_REPLY = 'Não achei uma conta do Anota Aí Agro com este número. Entre no app e, em Meu cadastro, confira o telefone (com DDD). Depois mande de novo.'

export const NO_FARM_REPLY = 'Esta conta não pode anotar leite pelo WhatsApp: precisa ser administrador ou editor de uma propriedade com o módulo Leite liberado.'

export const notFoundReply = (ref: string, candidates: MatchableAnimal[]) =>
  candidates.length
    ? `Achei mais de um animal para "${ref}": ${candidates.slice(0, 5).map((a) => `#${a.customCode || a.code} ${a.name}`).join(', ')}. Mande o número do brinco, por exemplo "vaca ${candidates[0].code} 12 litros".`
    : `Não achei o animal "${ref}" na sua propriedade. Use o número ou o nome como está no app, por exemplo "vaca 05 12 litros". Sem animal, anoto como total do dia.`

export function savedReply(p: { liters: number; date: string; cowsMilked: number | null }, farmName: string, animal: MatchableAnimal | null, today: string) {
  const when = p.date === today ? 'hoje' : fmtDay(p.date)
  const who = animal ? `da ${animal.name} (#${animal.customCode || animal.code})` : 'no total do dia'
  const cows = p.cowsMilked ? `, ${p.cowsMilked} vaca${p.cowsMilked === 1 ? '' : 's'} ordenhada${p.cowsMilked === 1 ? '' : 's'}` : ''
  return `Anotado: ${fmtLiters(p.liters)} ${who}, ${when}${cows}. Propriedade ${farmName}. Para corrigir, abra Leite no app.`
}

export const ERROR_REPLY = 'Não consegui anotar agora. Tente de novo em instantes ou use o app.'
