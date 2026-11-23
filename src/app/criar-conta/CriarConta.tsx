'use client'
import Image from 'next/image'
import Link from 'next/link'
import { EstoqueIcon, LeiteIcon, LojaIcon, PropriedadeIcon, SetaDireitaIcon, SincronizarIcon, TratamentoIcon } from '@/components/ModuleIcons'
import { BackLink } from '@/components/BackLink'
import { LanguagePicker } from '@/components/LanguagePicker'
import { DemoVetButton } from '@/components/DemoVet'
import { useT } from '@/lib/i18n'

const OPTIONS = [
  {
    href: '/cadastro',
    Icon: PropriedadeIcon,
    title: 'Produtor: gestão completa',
    color: 'green' as const,
    text: 'Rebanho, leite, vacinas, financeiro, estoque e relatórios da propriedade.',
  },
  {
    href: '/lite/cadastro',
    Icon: LeiteIcon,
    title: 'Produtor: só anotar o leite',
    color: 'navy' as const,
    text: 'Um campo para o leite do dia, no celular e mesmo sem internet.',
  },
  {
    href: '/lite/cadastro?perfil=motorista',
    Icon: SincronizarIcon,
    title: 'Motorista ou coletor de leite',
    color: 'amber' as const,
    text: 'Anote os litros de cada sítio e tanque comunitário da sua rota.',
  },
  {
    href: '/fornecedor/cadastro',
    Icon: LojaIcon,
    title: 'Fornecedor de insumos',
    color: 'brown' as const,
    text: 'Divulgue ofertas de ração, sal mineral e outros produtos para os produtores.',
  },
  {
    href: '/veterinario/cadastro',
    Icon: TratamentoIcon,
    title: 'Veterinário',
    color: 'teal' as const,
    text: 'Acompanhe a reprodução e o manejo das propriedades que você atende.',
  },
  {
    href: '/organizacao/cadastro?tipo=laticinio',
    Icon: EstoqueIcon,
    title: 'Laticínio',
    color: 'violet' as const,
    text: 'Organize pontos de coleta, rotas e motoristas e confira o leite recebido.',
  },
]

// Cor de cada perfil: quadrado do ícone sólido, borda e seta da mesma cor (os ícones são os de traço do site)
const COLORS = {
  green: { tile: 'bg-green-800', card: 'border-green-700/70 hover:bg-green-50', arrow: 'text-green-800' },
  navy: { tile: 'bg-blue-900', card: 'border-blue-900/60 hover:bg-blue-50', arrow: 'text-blue-900' },
  amber: { tile: 'bg-amber-500', card: 'border-amber-400 hover:bg-amber-50', arrow: 'text-amber-600' },
  brown: { tile: 'bg-orange-800', card: 'border-orange-800/60 hover:bg-orange-50', arrow: 'text-orange-800' },
  teal: { tile: 'bg-teal-600', card: 'border-teal-500 hover:bg-teal-50', arrow: 'text-teal-700' },
  violet: { tile: 'bg-violet-700', card: 'border-violet-600/70 hover:bg-violet-50', arrow: 'text-violet-700' },
}

// Tela de entrada do cadastro: a pessoa escolhe o perfil e segue para o formulário certo
export function CriarConta() {
  const t = useT()
  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <BackLink href="/inicio" label={t('Voltar ao início')} className="-ml-2" />
          <LanguagePicker />
        </div>
        <Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" priority className="mx-auto h-auto w-44" />
        <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">{t('Como você vai usar o Anota Aí?')}</h1>
        <p className="mt-1 text-center text-gray-600">{t('Escolha uma opção para criar sua conta.')}</p>

        <ul className="mt-6 space-y-3">
          {OPTIONS.map(({ href, Icon, title, text, color }) => (
            <li key={href}>
              <Link href={href}
                className={`flex items-center gap-4 rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 ${COLORS[color].card}`}>
                <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${COLORS[color].tile}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-gray-900">{t(title)}</span>
                  <span className="mt-0.5 block text-sm text-gray-600">{t(text)}</span>
                </span>
                <SetaDireitaIcon className={`h-5 w-5 shrink-0 ${COLORS[color].arrow}`} />
              </Link>
            </li>
          ))}
        </ul>

        <DemoVetButton className="mt-6" />

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('Já tem conta?')} <Link href="/login" className="font-semibold text-green-700 hover:underline">{t('Entrar')}</Link>
        </p>
        <p className="mt-3 text-center text-sm text-gray-600">
          {t('Prefere que a gente configure com você?')} <Link href="/ajuda" className="font-semibold text-green-700 hover:underline">{t('Peça ajuda')}</Link>
        </p>
      </div>
    </div>
  )
}
