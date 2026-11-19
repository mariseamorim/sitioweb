'use client'
import { LANGS, setLang, useLang } from '@/lib/i18n'

/** Troca o idioma da interface (fica guardado no aparelho). */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const lang = useLang()
  return (
    <div role="group" aria-label="Idioma / Idioma" className={`inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold ${className}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={lang === l.code}
          onClick={() => setLang(l.code)}
          className={`min-h-9 rounded-md px-3 ${lang === l.code ? 'bg-green-100 text-green-900' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
