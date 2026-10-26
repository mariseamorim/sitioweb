// Passo a passo de cada tela: aparece em "Como usar esta tela" (dentro do módulo) e na lista da página Ajuda.
// Regra pura, sem banco: quem vê cada ajuda depende do módulo liberado ou do perfil.

export interface HelpItem {
  title: string
  /** Módulo da propriedade que a pessoa precisa ter liberado */
  module?: string
  /** Perfis que veem esta ajuda (fornecedor, laticinio, associacao...). Sem módulo nem perfis: todo mundo logado */
  roles?: string[]
  steps: string[]
}

export const PAGE_HELP: Record<string, HelpItem> = {
  '/animais': { title: 'Animais', module: 'animais', steps: ['Use “Cadastrar animal” para adicionar um animal ao rebanho.', 'Busque pelo nome ou número do animal. Toque no nome para ver a ficha.', 'Editar muda os dados. Excluir pede sua confirmação antes de continuar.'] },
  '/milk-production': { title: 'Produção de leite', module: 'leite', steps: ['Use “Anotar leite” e confira a data da ordenha.', 'Escolha “Total do dia” para informar o leite da propriedade, ou “Por vaca” para anotar cada animal.', 'Confira os litros antes de salvar. Uma nova anotação na mesma data é somada às anteriores.'] },
  '/financeiro': { title: 'Financeiro', module: 'financeiro', steps: ['Use “Anotar entrada ou saída” para registrar uma movimentação.', 'Receita é o dinheiro que entrou. Despesa é o dinheiro que saiu.', 'Confira a data e o valor. Os filtros mostram apenas o período escolhido.'] },
  '/estoque': { title: 'Estoque', module: 'estoque', steps: ['Cadastre os produtos usados na propriedade, como ração, sal e medicamentos.', 'Abra um produto para registrar uma entrada ou um uso.', 'O estoque mínimo é a quantidade que avisa quando está na hora de repor.'] },
  '/fazendas': { title: 'Propriedades', module: 'fazendas', steps: ['Uma propriedade pode ser um sítio ou uma fazenda.', 'Use “Cadastrar propriedade” para preencher os dados. Campos com * são obrigatórios.', 'Excluir pede confirmação. Uma propriedade com registros é desativada para preservar seu histórico.'] },
  '/vacinacao': { title: 'Vacinação', module: 'vacinacao', steps: ['Escolha o animal, a vacina e a data prevista.', 'Depois da aplicação, registre a data em que o animal foi vacinado.'] },
  '/veterinary-treatment': { title: 'Tratamentos', module: 'veterinario', steps: ['Escolha o animal que recebeu o tratamento.', 'Anote a data, o medicamento e os cuidados realizados para consultar depois.'] },
  '/reproducao': { title: 'Reprodução', module: 'reproducao', steps: ['Em + Registrar, escolha a fêmea, como foi (inseminação, IATF, monta ou repasse), o touro e a data. Partida do sêmen e inseminador ficam em Mais detalhes.', 'No dia de inseminação, use "Salvar e repetir para outra fêmea": tudo fica preenchido e só a fêmea muda.', 'Acompanhe a previsão do parto, confirme a prenhez e registre a cria quando ela nascer.'] },
  // Fornecedor: não tem módulos da propriedade; a ajuda é pelo perfil
  '/fornecedor': { title: 'Painel do fornecedor', roles: ['fornecedor'], steps: [
    'Os cartões do topo são o menu: toque em um para abrir a seção. “Pedidos novos” são os orçamentos que os clientes pediram pelo app.',
    'Em “Ofertas ativas”, use “Nova oferta” para publicar produto, preço e validade. As ofertas aparecem para os clientes depois que o cadastro é aprovado.',
    'Em “Convidar clientes”, envie o link pelo WhatsApp: quem se cadastrar por ele vira seu cliente e passa a ver suas ofertas.',
    'Seu nome, telefone, e-mail, senha e os dados da empresa ficam em “Meu cadastro”, no menu e no rodapé do celular.',
  ] },
  '/perfil': { title: 'Meu cadastro', steps: [
    'Altere o nome, o telefone e o e-mail e toque em “Salvar alterações”. Você entra com o telefone ou com o e-mail.',
    'Para trocar a senha, informe a senha atual, a nova senha e a confirmação. Deixe a nova senha vazia para manter a atual.',
    'Esqueceu a senha? Fale com o suporte: o administrador define uma senha nova para você entrar e trocar depois.',
  ] },
}

/** Perfis com painel próprio, sem os módulos da propriedade */
export const PANEL_ROLES = ['fornecedor', 'laticinio', 'associacao'] as const
export const isPanelRole = (role: string | null | undefined) => !!role && (PANEL_ROLES as readonly string[]).includes(role)

/** A pessoa vê esta ajuda? Pelo módulo liberado, pelo perfil, ou todo mundo logado. */
export function canSeeHelp(item: HelpItem, user: { role: string } | null | undefined, canAccess: (module: string) => boolean): boolean {
  if (!user) return false
  if (item.module) return canAccess(item.module)
  if (item.roles) return item.roles.includes(user.role)
  return true
}

/** As ajudas que a pessoa pode ver, na ordem da lista */
export function visibleHelp(user: { role: string } | null | undefined, canAccess: (module: string) => boolean): [string, HelpItem][] {
  return Object.entries(PAGE_HELP).filter(([, item]) => canSeeHelp(item, user, canAccess))
}
