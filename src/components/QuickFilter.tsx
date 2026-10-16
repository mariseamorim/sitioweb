'use client'

import { useEffect, useState } from 'react'

// Filtro vindo de um cartão do Painel (?filtro=...): a tela abre já filtrada e mostra uma etiqueta para limpar

/** Lê ?filtro= uma vez ao abrir a tela (só valores conhecidos). Lido depois da montagem para o HTML do servidor e o do navegador serem iguais. */
export function useQuickFilter<T extends string>(allowed: readonly T[]): [T | null, (v: T | null) => void] {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('filtro')
    if (wanted && (allowed as readonly string[]).includes(wanted)) void Promise.resolve().then(() => setValue(wanted as T))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const set = (v: T | null) => {
    setValue(v)
    // Limpar o filtro tira o ?filtro do endereço (voltar não reaplica)
    if (!v && window.location.search.includes('filtro=')) window.history.replaceState(null, '', window.location.pathname)
  }
  return [value, set]
}

export function QuickFilterChip({ label, count, onClear }: { label: string; count?: number; onClear: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 py-1 pl-3 pr-1 text-sm font-semibold text-green-900">
        Mostrando: {label}{count !== undefined ? ` (${count})` : ''}
        <button type="button" onClick={onClear} aria-label={`Limpar filtro ${label}`} className="flex h-7 w-7 items-center justify-center rounded-full text-green-800 hover:bg-green-100">✕</button>
      </span>
      <button type="button" onClick={onClear} className="text-sm font-medium text-gray-600 underline">Ver todos</button>
    </div>
  )
}
