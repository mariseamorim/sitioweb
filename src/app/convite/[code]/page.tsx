'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'

interface Invite {
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  description: string | null
  loggedIn: boolean
  isVendor: boolean
  canLink: boolean
  linked: boolean
}

export default function ConvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')

  // Quem abre o link já logado numa propriedade fica ligado ao fornecedor na hora, sem precisar clicar
  useEffect(() => {
    fetch(`/api/convite/${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data: Invite) => {
        if (data.canLink && !data.linked) {
          setLinking(true)
          const res = await fetch('/api/meus-fornecedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          }).catch(() => null)
          if (res?.ok) data = { ...data, linked: true }
          else setError((await res?.json().catch(() => ({})))?.error || 'Não foi possível adicionar o fornecedor. Peça a quem administra a propriedade.')
          setLinking(false)
        }
        setInvite(data)
      })
      .catch(() => setInvalid(true))
  }, [code])

  const next = encodeURIComponent(`/convite/${code}`)

  // Logado numa conta sem propriedade (ex.: Anota Aí Leite): sai e entra com a conta da propriedade
  async function switchAccount() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = `/login?next=${next}`
  }

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4">
      <div className="w-full max-w-md">
        <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
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
              O fornecedor vê o nome e o contato da sua propriedade e os itens do estoque que estão abaixo do mínimo (dá para desligar em Ofertas). Seus animais e a produção continuam privados.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {linking ? (
                <p className="text-gray-500">Adicionando aos seus fornecedores...</p>
              ) : invite.linked ? (
                <>
                  <p className="rounded-lg bg-green-50 px-3 py-2 font-semibold text-green-800">Pronto! A {invite.companyName} é sua fornecedora.</p>
                  <Link href="/ofertas" className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    Ver ofertas
                  </Link>
                </>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : invite.isVendor ? (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">Este é um link de convite de fornecedor. Mande para os seus clientes pelo WhatsApp.</p>
              ) : (
                <>
                  {/* Sem conta: cadastro da gestão completa, já com o convite (a propriedade fica ligada ao fornecedor) */}
                  <Link href={`/cadastro?convite=${code}`} className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    Criar conta: gestão completa
                  </Link>
                  {invite.loggedIn ? (
                    <button type="button" onClick={switchAccount} className="w-full border-2 border-green-700 text-green-700 font-semibold py-2.5 rounded-lg hover:bg-green-50">
                      Já sou cadastrado: entrar com a conta da propriedade
                    </button>
                  ) : (
                    <Link href={`/login?next=${next}`} className="w-full border-2 border-green-700 text-green-700 font-semibold py-2.5 rounded-lg hover:bg-green-50">
                      Já sou cadastrado
                    </Link>
                  )}
                  {invite.loggedIn && <p className="text-xs text-gray-500">Você entrou com uma conta sem sítio ou fazenda. Para adicionar o fornecedor, use a conta da propriedade.</p>}
                </>
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
