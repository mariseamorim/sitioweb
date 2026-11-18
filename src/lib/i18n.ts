'use client'
// Idioma da interface. O texto em português do próprio código é a chave: t('Animais') devolve a tradução do
// dicionário do idioma escolhido ou, se ainda não houver, o próprio português. Assim uma tela pode ser traduzida aos
// poucos sem quebrar. Variáveis entre chaves: t('{n} animais', { n: 3 }).
// A escolha fica no aparelho (localStorage); sem escolha, segue o idioma do navegador.
import { useCallback, useSyncExternalStore } from 'react'
import { es } from '@/i18n/es'

export type Lang = 'pt' | 'es'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
]
const KEY = 'lang'
const DICTS: Record<Lang, Record<string, string> | null> = { pt: null, es }
const listeners = new Set<() => void>()

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'pt'
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved === 'pt' || saved === 'es') return saved
  } catch {}
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'pt'
}

export function setLang(lang: Lang) {
  try { window.localStorage.setItem(KEY, lang) } catch {}
  document.documentElement.lang = lang === 'es' ? 'es' : 'pt-BR'
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) listener() }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

/** Idioma atual. No servidor e na primeira pintura é português; troca logo depois de hidratar. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'pt')
}

export type Vars = Record<string, string | number>

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const out = DICTS[lang]?.[text] ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** t(textoEmPortugues, variáveis?) no idioma atual. */
export function useT() {
  const lang = useLang()
  return useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang])
}

/** Locale para datas e números (toLocaleDateString, toLocaleString). */
export function useLocale(): string {
  return useLang() === 'es' ? 'es-PY' : 'pt-BR'
}
