'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { BackLink } from '@/components/BackLink'

const BLOCKS = [
  { id: 'todos', label: '📚 Todos os blocos', href: '/manual-usuario.html' },
  { id: 'rebanho', label: '🐄 Rebanho', href: '/manual/bloco-rebanho.html' },
  { id: 'acesso-e-painel', label: '🏡 Acesso e Painel', href: '/manual/bloco-acesso-e-painel.html' },
  { id: 'leite-lite', label: '🥛 Anota Aí Leite', href: '/manual/bloco-leite-lite.html' },
  { id: 'leite-e-sanidade', label: '💉 Leite e Sanidade', href: '/manual/bloco-leite-e-sanidade.html' },
  { id: 'gestao', label: '📊 Gestão', href: '/manual/bloco-gestao.html' },
  { id: 'motorista-e-laticinio', label: '🚚 Motorista e Laticínio', href: '/manual/bloco-motorista-e-laticinio.html' },
  { id: 'associacao-e-fornecedor', label: '🤝 Associação e Fornecedor', href: '/manual/bloco-associacao-e-fornecedor.html' },
] as const

export function ManualViewer() {
  const router = useRouter()
  const params = useSearchParams()
  const q = params.get('bloco')
  const activeBlock = BLOCKS.find((b) => b.id === q) ?? BLOCKS[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/ajuda" label="Voltar para Ajuda e suporte" className="-ml-2" />
        <a
          href={activeBlock.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-green-700 bg-white px-4 text-sm font-semibold text-green-700 hover:bg-green-50"
        >
          Abrir bloco em tela cheia / Imprimir PDF
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {BLOCKS.map((b) => {
          const active = b.id === activeBlock.id
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => router.replace(b.id === 'todos' ? '/manual' : `/manual?bloco=${b.id}`, { scroll: false })}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-green-700 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {b.label}
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <iframe
          key={activeBlock.href}
          src={activeBlock.href}
          title={`Manual do usuário ilustrado — ${activeBlock.label}`}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 180px)', minHeight: '700px' }}
        />
      </div>
    </div>
  )
}
