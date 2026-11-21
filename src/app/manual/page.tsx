import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ManualViewer } from './ManualViewer'

export const metadata: Metadata = {
  title: 'Manual do usuário ilustrado — Anota Aí Agro',
}

// Rota oficial do Manual do Usuário Ilustrado (/manual) dentro do App Router do Next.js.
// Carrega somente o bloco escolhido (/manual/bloco-*.html) ou o índice de blocos (/manual-usuario.html).
export default function ManualPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Carregando manual...</div>}>
      <ManualViewer />
    </Suspense>
  )
}
