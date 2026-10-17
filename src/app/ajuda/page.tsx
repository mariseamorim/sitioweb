'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { SupportWhatsApp, WhatsAppIcon } from '@/components/SupportWhatsApp'
import { PAGE_HELP } from '@/components/PageHelp'

// Ajuda e suporte, só para quem está logado: falar com o suporte, pedir a configuração inicial e como usar cada tela.

const CONTACT_EMAIL = 'anotaaiagro@gmail.com'

export default function AjudaPage() {
  const { user, loading, canAccess } = useUser()
  const screens = Object.entries(PAGE_HELP).filter(([, item]) => canAccess(item.module))

  if (loading) return <p className="text-gray-400 text-sm mt-8">Carregando...</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajuda e suporte</h1>
        <p className="mt-1 text-sm text-gray-500">Dúvida, erro ou ajuda para começar: fale com a gente.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="ajuda-suporte" className="rounded-xl border border-gray-200 bg-white p-5">
          <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><WhatsAppIcon className="h-6 w-6" /></span>
          <h2 id="ajuda-suporte" className="text-lg font-bold text-gray-900">Falar com o suporte</h2>
          <p className="mt-1 text-sm text-gray-600">Abre o WhatsApp com a mensagem pronta, já com o seu nome e a propriedade. Conte o que aconteceu e em qual tela.</p>
          <div className="mt-4">
            {user?.support
              ? <SupportWhatsApp kind="ajuda" variant="button" label="Chamar no WhatsApp" />
              : <p className="text-sm text-gray-500">O suporte pelo WhatsApp ainda não está configurado. Escreva para <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 hover:underline">{CONTACT_EMAIL}</a>.</p>}
          </div>
        </section>

        <section aria-labelledby="ajuda-config" className="rounded-xl border border-gray-200 bg-white p-5">
          <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700 text-xl font-bold">1</span>
          <h2 id="ajuda-config" className="text-lg font-bold text-gray-900">Configuração inicial</h2>
          <p className="mt-1 text-sm text-gray-600">A gente configura com você: propriedade, animais, leite e quem vai usar. O resumo do seu cadastro vai junto na mensagem, para o atendimento já saber por onde começar.</p>
          <div className="mt-4">
            {user?.support
              ? <SupportWhatsApp kind="configurar" variant="button" label="Pedir configuração inicial" />
              : <p className="text-sm text-gray-500">Peça pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 hover:underline">{CONTACT_EMAIL}</a>.</p>}
          </div>
        </section>
      </div>

      {screens.length > 0 && (
        <section aria-labelledby="ajuda-telas" className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 id="ajuda-telas" className="text-lg font-bold text-gray-900">Como usar cada tela</h2>
          <p className="mt-1 text-sm text-gray-600">O mesmo passo a passo que aparece em &ldquo;Como usar esta tela&rdquo; dentro de cada módulo.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {screens.map(([href, item]) => (
              <details key={href} className="rounded-lg border border-gray-100 bg-gray-50 px-4">
                <summary className="cursor-pointer py-3 text-sm font-semibold text-gray-800">{item.title}</summary>
                <ol className="list-decimal space-y-2 pb-3 pl-5 text-sm leading-relaxed text-gray-700">{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <p className="pb-3"><Link href={href} className="text-sm font-semibold text-green-700 hover:underline">Abrir {item.title}</Link></p>
              </details>
            ))}
          </div>
        </section>
      )}

      <p className="mt-6 text-sm text-gray-500">Também atendemos por e-mail: <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 hover:underline">{CONTACT_EMAIL}</a>.</p>
    </div>
  )
}
