// Suporte pelo WhatsApp. O número fica só no servidor (SUPPORT_WHATSAPP, só números com DDD; o DDI 55 entra sozinho)
// e não vai para o HTML nem para o JavaScript: a rota /api/suporte monta a mensagem para quem está logado e redireciona.
// Sem a variável, as telas escondem as opções de suporte (o /api/auth/me informa `support: false`).

import { whatsappLink } from '@/lib/utils'

export const SUPPORT_KINDS = ['ajuda', 'entrar', 'conhecer', 'configurar'] as const
export type SupportKind = (typeof SUPPORT_KINDS)[number]
export const isSupportKind = (v: unknown): v is SupportKind => typeof v === 'string' && (SUPPORT_KINDS as readonly string[]).includes(v)

export const supportNumber = () => (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '')
export const hasSupport = () => supportNumber().length >= 10

/** Nome da tela para a mensagem, pelo endereço */
const SCREENS: Record<string, string> = {
  '/': 'Painel',
  '/animais': 'Animais',
  '/engorda': 'Recria e engorda',
  '/milk-production': 'Produção de leite',
  '/veterinary-treatment': 'Tratamentos',
  '/vacinacao': 'Vacinação',
  '/reproducao': 'Reprodução',
  '/financeiro': 'Financeiro',
  '/estoque': 'Estoque',
  '/relatorios': 'Relatórios',
  '/usuarios': 'Usuários',
  '/fazendas': 'Propriedades',
  '/ofertas': 'Ofertas',
  '/lite': 'Anota Aí Leite',
  '/associacao': 'Associação',
  '/laticinio': 'Laticínio',
  '/fornecedor': 'Fornecedor',
  '/perfil': 'Meu cadastro',
  '/ajuda': 'Ajuda',
}

export function screenLabel(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  if (SCREENS[pathname]) return SCREENS[pathname]
  const base = Object.keys(SCREENS).find((p) => p !== '/' && pathname.startsWith(p + '/'))
  return base ? SCREENS[base] : null
}

export interface SupportContext {
  kind?: SupportKind
  name?: string | null
  farmName?: string | null
  screen?: string | null
  /** Texto extra, por exemplo o resumo do cadastro na configuração inicial */
  summary?: string | null
}

export function supportMessage({ kind = 'ajuda', name, farmName, screen, summary }: SupportContext): string {
  const who = name ? `Olá, sou ${name}${farmName ? `, de ${farmName}` : ''}.` : 'Olá!'
  const ask = {
    ajuda: screen ? `Preciso de ajuda com a tela ${screen} do Anota Aí Agro.` : 'Preciso de ajuda com o Anota Aí Agro.',
    entrar: 'Preciso de ajuda para entrar no Anota Aí Agro.',
    conhecer: 'Quero conhecer o Anota Aí Agro e tirar algumas dúvidas.',
    configurar: 'Quero ajuda para configurar o Anota Aí Agro na minha propriedade.',
  }[kind]
  return [who, ask, summary].filter(Boolean).join(' ')
}

/** Resumo do cadastro que vai junto no pedido de configuração inicial */
export function setupSummary(farm: { name: string; city?: string | null; state?: string | null; segments: string[] }, animals: number, milkDays: number): string {
  const labels: Record<string, string> = { leite: 'leite', cria: 'cria', recria: 'recria', engorda: 'engorda' }
  const does = farm.segments.map((s) => labels[s] ?? s).join(', ')
  const place = [farm.city, farm.state].filter(Boolean).join(', ')
  return [
    `Propriedade: ${farm.name}${place ? ` (${place})` : ''}.`,
    does ? `Trabalha com ${does}.` : 'Ainda não informei o que a propriedade faz.',
    animals ? `Já cadastrei ${animals} ${animals === 1 ? 'animal' : 'animais'}.` : 'Ainda não cadastrei animais.',
    milkDays ? `Tenho ${milkDays} ${milkDays === 1 ? 'dia' : 'dias'} de leite anotados.` : '',
  ].filter(Boolean).join(' ')
}

export const supportLink = (text: string) => whatsappLink(supportNumber(), text)

/** Endereço da rota que abre o WhatsApp (usado nas telas; o número nunca sai do servidor) */
export function supportHref(kind: SupportKind, screen?: string | null): string {
  const params = new URLSearchParams({ kind })
  if (screen) params.set('screen', screen)
  return `/api/suporte?${params}`
}
