'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { SupportWhatsApp, WhatsAppIcon } from '@/components/SupportWhatsApp'
import { PAGE_HELP } from '@/components/PageHelp'
import { BackLink } from '@/components/BackLink'

// Ajuda e suporte: falar com o suporte, pedir a configuração inicial e, para quem está logado, como usar cada tela.

const CONTACT_EMAIL = 'anotaaiagro@gmail.com'

export function AjudaView({ support, loggedIn }: { support: boolean; loggedIn: boolean }) {
  const { user, canAccess } = useUser()
  const screens = Object.entries(PAGE_HELP).filter(([, item]) => canAccess(item.module))
  const email = <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 hover:underline">{CONTACT_EMAIL}</a>

  return (
    <div>
      {!loggedIn && <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajuda e suporte</h1>
        <p className="mt-1 text-sm text-gray-500">
          {loggedIn ? 'Dúvida, erro ou ajuda para começar: fale com a gente.' : 'Antes de criar a conta, para entrar ou para começar a usar: fale com a gente.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-labelledby="ajuda-suporte" className="rounded-xl border border-gray-200 bg-white p-5">
          <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700"><WhatsAppIcon className="h-6 w-6" /></span>
          <h2 id="ajuda-suporte" className="text-lg font-bold text-gray-900">{loggedIn ? 'Falar com o suporte' : 'Tirar dúvidas'}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {loggedIn
              ? 'Abre o WhatsApp com a mensagem pronta, já com o seu nome e a propriedade. Conte o que aconteceu e em qual tela.'
              : 'Quer saber se o sistema serve para a sua propriedade, quanto custa ou como funciona? Abre o WhatsApp com a mensagem pronta.'}
          </p>
          <div className="mt-4">
            {support
              ? <SupportWhatsApp enabled kind={loggedIn ? 'ajuda' : 'conhecer'} variant="button" label="Chamar no WhatsApp" />
              : <p className="text-sm text-gray-500">O suporte pelo WhatsApp ainda não está configurado. Escreva para {email}.</p>}
          </div>
        </section>

        {!loggedIn && (
          <section aria-labelledby="ajuda-entrar" className="rounded-xl border border-gray-200 bg-white p-5">
            <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700 text-xl font-bold">?</span>
            <h2 id="ajuda-entrar" className="text-lg font-bold text-gray-900">Não consigo entrar</h2>
            <p className="mt-1 text-sm text-gray-600">Esqueceu a senha, o e-mail não funciona ou o app não abre? A gente resolve com você.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {support && <SupportWhatsApp enabled kind="entrar" variant="button" label="Pedir ajuda para entrar" />}
              <Link href="/login" className="text-sm font-semibold text-green-700 hover:underline">Ir para o login</Link>
            </div>
          </section>
        )}

        <section aria-labelledby="ajuda-config" className="rounded-xl border border-gray-200 bg-white p-5">
          <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700 text-xl font-bold">1</span>
          <h2 id="ajuda-config" className="text-lg font-bold text-gray-900">Configuração inicial</h2>
          <p className="mt-1 text-sm text-gray-600">
            {loggedIn
              ? 'A gente configura com você: propriedade, animais, leite e quem vai usar. O resumo do seu cadastro vai junto na mensagem, para o atendimento já saber por onde começar.'
              : 'A gente cria a conta e configura com você: propriedade, animais, leite e quem vai usar. Pode chamar antes mesmo de se cadastrar.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {support
              ? <SupportWhatsApp enabled kind="configurar" variant="button" label="Pedir configuração inicial" />
              : <p className="text-sm text-gray-500">Peça pelo e-mail {email}.</p>}
            {!loggedIn && <Link href="/criar-conta" className="text-sm font-semibold text-green-700 hover:underline">Criar conta sozinho</Link>}
          </div>
        </section>
      </div>

      {user && screens.length > 0 && (
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

      <p className="mt-6 text-sm text-gray-500">Também atendemos por e-mail: {email}.</p>
    </div>
  )
}
