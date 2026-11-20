import type { Metadata } from 'next'
import { BackLink } from '@/components/BackLink'

export const metadata: Metadata = {
  title: 'Manual do usuário ilustrado — Anota Aí Agro',
}

// Rota oficial do Manual do Usuário Ilustrado (/manual) dentro do App Router do Next.js.
// Carrega o manual HTML completo (/manual-usuario.html) dentro da estrutura do sistema e também permite abrir em tela cheia / imprimir.
export default function ManualPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/ajuda" label="Voltar para Ajuda e suporte" className="-ml-2" />
        <a
          href="/manual-usuario.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-green-700 bg-white px-4 text-sm font-semibold text-green-700 hover:bg-green-50"
        >
          Abrir em tela cheia / Imprimir PDF
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <iframe
          src="/manual-usuario.html"
          title="Manual do usuário ilustrado — Anota Aí Agro"
          className="w-full border-0"
          style={{ height: 'calc(100vh - 140px)', minHeight: '720px' }}
        />
      </div>
    </div>
  )
}
