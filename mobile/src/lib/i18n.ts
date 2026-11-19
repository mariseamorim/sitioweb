// Idioma da interface do app. O texto em português do próprio código é a chave: t('Animais') devolve a tradução do
// dicionário do idioma escolhido ou, se ainda não houver, o próprio português (uma tela pode ser traduzida aos poucos).
// Variáveis entre chaves: t('{n} animais', { n: 3 }). A escolha fica no banco local (tabela meta), então vale sem
// internet; sem escolha, segue o idioma do celular.
import { useCallback, useSyncExternalStore } from 'react'
import { getMeta, setMeta } from '@/db'
import { es } from '@/i18n/es'

export type Lang = 'pt' | 'es'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
]
const KEY = 'lang'
const DICTS: Record<Lang, Record<string, string> | null> = { pt: null, es }
const listeners = new Set<() => void>()
let current: Lang | null = null

function deviceLang(): Lang {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('es') ? 'es' : 'pt'
  } catch {
    return 'pt'
  }
}

export function getLang(): Lang {
  if (current) return current
  let saved: string | null = null
  try { saved = getMeta(KEY) } catch {}
  current = saved === 'pt' || saved === 'es' ? saved : deviceLang()
  return current
}

export function setLang(lang: Lang) {
  current = lang
  setMeta(KEY, lang)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

export type Vars = Record<string, string | number>

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const out = DICTS[lang]?.[text] ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** t(textoEmPortugues, variáveis?) no idioma atual; fora de componente, use tr(). */
export function useT() {
  const lang = useLang()
  return useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang])
}

/** Tradução fora de componente (alertas, textos montados em funções). */
export function tr(text: string, vars?: Vars) {
  return translate(getLang(), text, vars)
}

/** Locale para datas e números. */
export function useLocale(): string {
  return useLang() === 'es' ? 'es-PY' : 'pt-BR'
}
