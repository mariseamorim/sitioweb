// Estrutura comum de relatório: a API monta, a tela mostra e exporta (PDF/planilha)

export interface ReportSection {
  title?: string
  columns: string[]
  /** Colunas numéricas, alinhadas à direita */
  numeric?: number[]
  rows: (string | number)[][]
  footer?: (string | number)[]
}

export interface Report {
  title: string
  subtitle: string
  sections: ReportSection[]
}

export interface ReportType {
  key: string
  label: string
  description: string
  module: string
  needsPeriod: boolean
  needsAnimal?: boolean
}

export const REPORT_TYPES: ReportType[] = [
  { key: 'leite', label: 'Produção de leite', description: 'Total por dia e, se houver lançamento por vaca, o total de cada uma.', module: 'leite', needsPeriod: true },
  { key: 'ficha-animal', label: 'Ficha do animal', description: 'Dados, vacinas, tratamentos, partos e leite de um animal.', module: 'animais', needsPeriod: false, needsAnimal: true },
  { key: 'vacinacao', label: 'Vacinação do rebanho', description: 'Vacinas aplicadas e pendentes no período, com lote e fabricante.', module: 'vacinacao', needsPeriod: true },
  { key: 'financeiro', label: 'Fluxo de caixa', description: 'Receitas e despesas por categoria e lançamentos do período.', module: 'financeiro', needsPeriod: true },
  { key: 'partos', label: 'Crias e partos', description: 'Crias de cada vaca, intervalo entre partos e vacas demorando para criar.', module: 'animais', needsPeriod: false },
  { key: 'rebanho', label: 'Inventário do rebanho', description: 'Animais por espécie e situação, com lista completa.', module: 'animais', needsPeriod: false },
  { key: 'estoque', label: 'Movimentação de estoque', description: 'Entradas e saídas no período e saldo atual de cada item.', module: 'estoque', needsPeriod: true },
]

export function fmtNumber(v: number, decimals = 1) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Datas são gravadas como meia-noite UTC do dia escolhido */
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
