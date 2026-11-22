import type { Metadata } from 'next'
import { CriarConta } from './CriarConta'

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Escolha como você vai usar o Anota Aí Agro: produtor, motorista, fornecedor ou laticínio.',
  alternates: { canonical: '/criar-conta' },
}

// Tela de entrada do cadastro: a pessoa escolhe o perfil e segue para o formulário certo (textos traduzidos no cliente)
export default function CriarContaPage() {
  return <CriarConta />
}
