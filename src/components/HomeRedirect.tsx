'use client'

import { useEffect } from 'react'

// A tela inicial de quem não usa o Painel (Anota Aí Leite, fornecedor, laticínio, associação, visitante).
// É uma página normal, e não um redirecionamento do servidor, para o service worker conseguir guardá-la:
// sem internet, o app instalado abre em "/" e daqui segue para a tela certa, que também está guardada.
export function HomeRedirect({ href }: { href: string }) {
  useEffect(() => {
    // Recarrega inteiro (não navegação interna): sem sinal, é o service worker que entrega a tela guardada
    window.location.replace(href)
  }, [href])
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 text-center text-gray-600">
      <p>
        Abrindo… <a href={href} className="font-semibold text-green-700 underline">Se não abrir, toque aqui</a>
      </p>
    </main>
  )
}
