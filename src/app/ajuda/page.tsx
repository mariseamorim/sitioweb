import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/auth'
import { hasSupport } from '@/lib/support'
import { AjudaView } from './AjudaView'

export const metadata: Metadata = { title: 'Ajuda e suporte — Anota Aí Agro' }

// Aberta para todos: quem ainda não tem conta também fala com o suporte. O número fica no servidor;
// a tela só sabe se há suporte configurado.
export default async function AjudaPage() {
  const me = await getSessionUser()
  return <AjudaView support={hasSupport()} loggedIn={!!me} />
}
