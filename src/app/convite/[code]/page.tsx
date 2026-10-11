'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Invite {
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  description: string | null
  loggedIn: boolean
  canLink: boolean
  linked: boolean
}

export default function ConvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/convite/${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInvite)
      .catch(() => setInvalid(true))
  }, [code])

  async function link() {
    setLinking(true)
    setError('')
    try {
      const res = await fetch('/api/meus-fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Não foi possível adicionar o fornecedor')
        return
      }
      window.location.href = '/ofertas'
    } finally {
      setLinking(false)
    }
  }

  const next = encodeURIComponent(`/convite/${code}`)

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
        <Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" className="mx-auto h-auto w-44" />

        {invalid ? (
          <>
            <h1 className="mt-6 text-xl font-bold text-gray-900">Convite não encontrado</h1>
            <p className="mt-2 text-gray-500">Confira o link com quem enviou.</p>
          </>
        ) : !invite ? (
          <p className="mt-8 text-gray-400 text-sm">Carregando...</p>
        ) : (
          <>
            <p className="mt-6 text-sm font-medium text-green-700">Convite de fornecedor</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">{invite.companyName}</h1>
            <p className="mt-1 text-gray-500">
              {invite.contactName}
              {(invite.city || invite.state) && ` · ${[invite.city, invite.state].filter(Boolean).join('/')}`}
            </p>
            {invite.description && <p className="mt-3 text-gray-600">{invite.description}</p>}

            <p className="mt-5 text-gray-600">
              Adicione a {invite.companyName} aos seus fornecedores para ver as ofertas dela no app e chamar direto pelo WhatsApp.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              O fornecedor vê só o nome e o contato da sua propriedade. Seus animais, produção e estoque continuam privados.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {invite.linked ? (
                <Link href="/ofertas" className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                  Já é seu fornecedor. Ver ofertas
                </Link>
              ) : invite.canLink ? (
                <button onClick={link} disabled={linking} className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg">
                  {linking ? 'Adicionando...' : 'Adicionar aos meus fornecedores'}
                </button>
              ) : invite.loggedIn ? (
                <p className="text-sm text-gray-500">Entre com a conta de uma propriedade para adicionar este fornecedor.</p>
              ) : (
                <>
                  <Link href={`/cadastro?convite=${code}`} className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    Cadastrar meu sítio ou fazenda
                  </Link>
                  <Link href={`/login?next=${next}`} className="w-full border-2 border-green-700 text-green-700 font-semibold py-2.5 rounded-lg hover:bg-green-50">
                    Já tenho conta
                  </Link>
                </>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
