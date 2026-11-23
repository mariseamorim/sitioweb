'use client'

// Modal padrão do sistema (todos os modais seguem este desenho):
// - fundo escurecido com desfoque; cartão com cantos de 16 px e sombra funda;
// - tamanhos: sm 400 px (confirmações e alertas), md 560 px (formulários comuns), lg 800 px (tabelas e formulários grandes);
// - cabeçalho: ícone num círculo na cor da função, título em negrito, subtítulo com o contexto e o "X";
// - corpo rola sozinho; rodapé fixo com os botões à direita e uma frase de apoio opcional embaixo.
// No celular o modal sobe de baixo, ocupando a largura toda.
import { useEffect, useId, useRef } from 'react'
import { FecharIcon } from '@/components/ModuleIcons'
import { useT } from '@/lib/i18n'

export type ModalTone = 'green' | 'blue' | 'red' | 'amber' | 'teal' | 'violet' | 'gray'
export type ModalSize = 'sm' | 'md' | 'lg'

const TONE: Record<ModalTone, string> = {
  green: 'bg-green-50 text-green-700 ring-green-100',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  teal: 'bg-teal-50 text-teal-700 ring-teal-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  gray: 'bg-gray-100 text-gray-700 ring-gray-200',
}
// Modais abertos, do de baixo para o de cima: o Esc fecha só o de cima, e o aberto por último fica na frente
const openStack: string[] = []

const SIZE: Record<ModalSize, string> = { sm: 'sm:max-w-[400px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[800px]' }

/** Classes dos botões do rodapé, para todos os modais ficarem iguais */
export const modalButton = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-green-600 disabled:bg-gray-300 disabled:shadow-none',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-red-700 disabled:bg-gray-300',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-green-700 bg-white px-5 py-2.5 text-base font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50',
  ghost: 'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50',
}

export function AppModal({ title, subtitle, icon, tone = 'green', size = 'md', onClose, footer, note, children, role = 'dialog', labelledBy }: {
  title: string
  /** Contexto: a propriedade, o animal, o lote... */
  subtitle?: React.ReactNode
  /** Ícone de traço do assunto (vai no círculo colorido) */
  icon?: React.ReactNode
  tone?: ModalTone
  size?: ModalSize
  onClose: () => void
  /** Botões do rodapé (ficam fixos embaixo, à direita) */
  footer?: React.ReactNode
  /** Frase de apoio, miúda e cinza, embaixo dos botões */
  note?: React.ReactNode
  children?: React.ReactNode
  role?: 'dialog' | 'alertdialog'
  labelledBy?: string
}) {
  const t = useT()
  const id = useId()
  const titleId = labelledBy ?? `${id}-title`
  const box = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  // Camada do modal: o z-index sobe com a posição na pilha (acima dos que já estavam abertos)
  const overlay = useRef<HTMLDivElement>(null)

  // Entra na pilha ao abrir; o foco vai para o primeiro campo
  useEffect(() => {
    openStack.push(id)
    if (overlay.current) overlay.current.style.zIndex = String(50 + openStack.length)
    box.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([aria-label])')?.focus()
    return () => { const i = openStack.lastIndexOf(id); if (i >= 0) openStack.splice(i, 1) }
  }, [id])

  // Esc fecha só o modal de cima
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== id) return
      e.stopImmediatePropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])

  return (
    <div ref={overlay} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[4px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} role={role} aria-modal="true" aria-labelledby={titleId}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${SIZE[size]}`}>
        <header className="flex items-start gap-3 px-5 pb-3 pt-5 sm:px-6">
          {icon && <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 ${TONE[tone]}`}>{icon}</span>}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-xl font-bold leading-tight text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t('Fechar')} className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700">
            <FecharIcon className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {(footer || note) && (
          <footer className="border-t border-gray-100 bg-white px-5 py-4 sm:px-6">
            {footer && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
            {note && <p className="mt-2 text-xs leading-relaxed text-gray-500">{note}</p>}
          </footer>
        )}
      </div>
    </div>
  )
}
