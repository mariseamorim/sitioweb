'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import type { Task, TaskTone } from '@/lib/tasks'
import { FecharIcon, SinoIcon } from '@/components/ModuleIcons'

const CACHE_KEY = 'cached_tasks'
const TONE_DOT: Record<TaskTone, string> = { red: 'bg-red-600', amber: 'bg-amber-500', blue: 'bg-blue-600' }

// Sino da barra do topo: mostra as tarefas do dia (vacinas, partos, ordenha, estoque)
export function TaskBell() {
  const pathname = usePathname()
  const [tasks, setTasks] = useState<Task[]>([])
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  // Recarrega a cada troca de página, pois lançamentos mudam as tarefas
  useEffect(() => {
    let cancelled = false
    fetch('/api/tarefas')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Task[]) => {
        if (cancelled) return
        setTasks(list)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)) } catch {}
      })
      .catch(() => {
        // Sem conexão: mostra a última lista conhecida
        try {
          const cached = localStorage.getItem(CACHE_KEY)
          if (!cancelled && cached) setTasks(JSON.parse(cached))
        } catch {}
      })
    return () => { cancelled = true }
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    // Fecha a janela do computador ao clicar fora; o painel do celular fecha pelo fundo escuro
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest('[data-task-sheet]')) return
      if (wrapper.current && !wrapper.current.contains(target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const urgent = tasks.some((t) => t.tone === 'red')

  const list = tasks.length === 0 ? (
    <p className="px-4 py-6 text-center text-gray-500">Nada pendente por enquanto.</p>
  ) : (
    <ul className="divide-y divide-gray-100">
      {tasks.map((t, i) => (
        <li key={i}>
          <Link href={t.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
            <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-full ${TONE_DOT[t.tone]}`} />
            <span className="flex-1 min-w-0">
              <span className="block text-base font-medium text-gray-800">{t.title}</span>
              {t.detail && <span className="block text-sm text-gray-500">{t.detail}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={tasks.length ? `Tarefas de hoje: ${tasks.length}` : 'Tarefas de hoje'}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
      >
        <SinoIcon className="w-6 h-6" />
        {tasks.length > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold leading-[18px] text-center text-white ${
              urgent ? 'bg-red-600' : 'bg-amber-500'
            }`}
          >
            {tasks.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Computador: janela suspensa */}
          <div className="hidden md:block absolute right-0 mt-2 w-96 max-h-[70vh] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-50">
            <p className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-900">O que fazer hoje</p>
            {list}
          </div>

          {/* Celular: painel de baixo, no <body> para ficar acima da barra de abas */}
          {createPortal(
          <div data-task-sheet className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
            <div
              className="fixed bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-base font-semibold text-gray-900">O que fazer hoje</p>
                <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
                  <FecharIcon />
                </button>
              </div>
              {list}
            </div>
          </div>,
          document.body,
          )}
        </>
      )}
    </div>
  )
}
