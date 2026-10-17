'use client'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { SupportWhatsApp } from '@/components/SupportWhatsApp'
export const PAGE_HELP: Record<string, { module: string; title: string; steps: string[] }> = {
  '/animais': { title: 'Animais', module: 'animais', steps: ['Use “Cadastrar animal” para adicionar um animal ao rebanho.', 'Busque pelo nome ou número do animal. Toque no nome para ver a ficha.', 'Editar muda os dados. Excluir pede sua confirmação antes de continuar.'] },
  '/milk-production': { title: 'Produção de leite', module: 'leite', steps: ['Use “Anotar leite” e confira a data da ordenha.', 'Escolha “Total do dia” para informar o leite da propriedade, ou “Por vaca” para anotar cada animal.', 'Confira os litros antes de salvar. Uma nova anotação na mesma data é somada às anteriores.'] },
  '/financeiro': { title: 'Financeiro', module: 'financeiro', steps: ['Use “Anotar entrada ou saída” para registrar uma movimentação.', 'Receita é o dinheiro que entrou. Despesa é o dinheiro que saiu.', 'Confira a data e o valor. Os filtros mostram apenas o período escolhido.'] },
  '/estoque': { title: 'Estoque', module: 'estoque', steps: ['Cadastre os produtos usados na propriedade, como ração, sal e medicamentos.', 'Abra um produto para registrar uma entrada ou um uso.', 'O estoque mínimo é a quantidade que avisa quando está na hora de repor.'] },
  '/fazendas': { title: 'Propriedades', module: 'fazendas', steps: ['Uma propriedade pode ser um sítio ou uma fazenda.', 'Use “Cadastrar propriedade” para preencher os dados. Campos com * são obrigatórios.', 'Excluir pede confirmação. Uma propriedade com registros é desativada para preservar seu histórico.'] },
  '/vacinacao': { title: 'Vacinação', module: 'vacinacao', steps: ['Escolha o animal, a vacina e a data prevista.', 'Depois da aplicação, registre a data em que o animal foi vacinado.'] },
  '/veterinary-treatment': { title: 'Tratamentos', module: 'veterinario', steps: ['Escolha o animal que recebeu o tratamento.', 'Anote a data, o medicamento e os cuidados realizados para consultar depois.'] },
  '/reproducao': { title: 'Reprodução', module: 'reproducao', steps: ['Registre a cobertura ou inseminação do animal.', 'Acompanhe a previsão do parto e registre a data quando ele acontecer.'] },
}
export function PageHelp() {
  const pathname = usePathname()
  const { canAccess } = useUser()
  const item = PAGE_HELP[pathname]
  if (!item || !canAccess(item.module)) return null
  return <details key={pathname} className="mb-5 rounded-xl border border-green-100 bg-green-50/60 px-4">
    <summary className="cursor-pointer py-3 text-sm font-semibold text-green-900">Como usar esta tela</summary>
    <ol className="list-decimal space-y-2 pb-4 pl-5 text-sm leading-relaxed text-gray-700">{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
    <p className="border-t border-green-100 py-3 text-sm text-gray-600">Não resolveu? <SupportWhatsApp /></p>
  </details>
}
