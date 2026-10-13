import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { EstoqueIcon, LeiteIcon, LojaIcon, PropriedadeIcon, SetaDireitaIcon, SincronizarIcon, UsuariosIcon } from '@/components/ModuleIcons'
import { BackLink } from '@/components/BackLink'

export const metadata: Metadata = {
  title: 'Criar conta - Anota Aí Agro',
  description: 'Escolha como você vai usar o Anota Aí Agro: produtor, motorista, fornecedor, laticínio ou associação.',
}

const OPTIONS = [
  {
    href: '/cadastro',
    Icon: PropriedadeIcon,
    title: 'Produtor: gestão completa',
    text: 'Rebanho, leite, vacinas, financeiro, estoque e relatórios da propriedade.',
  },
  {
    href: '/lite/cadastro',
    Icon: LeiteIcon,
    title: 'Produtor: só anotar o leite',
    text: 'Um campo para o leite do dia, no celular e mesmo sem internet.',
  },
  {
    href: '/lite/cadastro?perfil=motorista',
    Icon: SincronizarIcon,
    title: 'Motorista ou coletor de leite',
    text: 'Anote os litros de cada sítio e tanque comunitário da sua rota.',
  },
  {
    href: '/fornecedor/cadastro',
    Icon: LojaIcon,
    title: 'Fornecedor de insumos',
    text: 'Divulgue ofertas de ração, sal mineral e outros produtos para os produtores.',
  },
  {
    href: '/organizacao/cadastro?tipo=laticinio',
    Icon: EstoqueIcon,
    title: 'Laticínio',
    text: 'Organize pontos de coleta, rotas e motoristas e confira o leite recebido.',
  },
  {
    href: '/organizacao/cadastro?tipo=associacao',
    Icon: UsuariosIcon,
    title: 'Associação de produtores',
    text: 'Acompanhe os associados, a produção compartilhada e faça compras coletivas.',
  },
]

// Tela de entrada do cadastro: a pessoa escolhe o perfil e segue para o formulário certo
export default function CriarContaPage() {
  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />
        <Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" priority className="mx-auto h-auto w-44" />
        <h1 className="mt-6 text-center text-2xl font-bold text-gray-900">Como você vai usar o Anota Aí?</h1>
        <p className="mt-1 text-center text-gray-600">Escolha uma opção para criar sua conta.</p>

        <ul className="mt-6 space-y-3">
          {OPTIONS.map(({ href, Icon, title, text }) => (
            <li key={href}>
              <Link href={href}
                className="flex items-center gap-4 rounded-2xl border-2 border-gray-200 bg-white p-4 transition-colors hover:border-green-600 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-gray-900">{title}</span>
                  <span className="mt-0.5 block text-sm text-gray-600">{text}</span>
                </span>
                <SetaDireitaIcon className="h-5 w-5 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-sm text-gray-600">
          Já tem conta? <Link href="/login" className="font-semibold text-green-700 hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
