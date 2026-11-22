// Estrutura comum de relatório: a API monta, a tela mostra e exporta (PDF/planilha)

/** Tom de um cartão ou pílula: bom (verde), atenção (âmbar), ruim (vermelho) */
export type ReportTone = 'good' | 'warn' | 'bad'

// Os campos opcionais abaixo só mudam a aparência na tela; o PDF e a planilha continuam usando columns/rows/footer.
// Mantenha este tipo igual ao de mobile/src/lib/reports.ts.
export interface ReportSection {
  title?: string
  columns: string[]
  /** Colunas numéricas, alinhadas à direita */
  numeric?: number[]
  rows: (string | number)[][]
  /** Linha totalizadora (aparece em negrito, com fundo verde-claro) */
  footer?: (string | number)[]
  /** 'cards': resumo em cartões; cada linha é [rótulo, valor] (no PDF sai como tabela de 2 colunas) */
  kind?: 'table' | 'cards'
  /** Tom de cada linha dos cartões; sem tom, cores neutras */
  tones?: (ReportTone | null)[]
  /** Coluna mostrada como pílula colorida pela palavra (veja badgeTone) */
  badgeColumn?: number
  /** Coluna de valor com sinal: verde se positivo, vermelho se negativo */
  signedColumn?: number
  /** Seção de alerta: fundo âmbar ou vermelho suave, com borda (só quando há linhas) */
  alert?: 'warn' | 'bad'
  /** Pago/recebido de cada linha (lançamentos do caixa); o app mostra o ícone */
  paid?: (boolean | null)[]
}

const GOOD_WORDS = ['Vivo', 'Viva', 'Aplicada', 'OK', 'Em dia', 'Entrada', 'Receita', 'Prenha', 'Parida', 'Pago', 'Recebido']
const WARN_WORDS = ['Atenção', 'Pendente', 'Repor', 'Saída', 'Coberta', 'Vazia']
const BAD_WORDS = ['Atrasada', 'Vencida', 'Crítico', 'Despesa', 'Perdida']

/**
 * Cor da pílula pela palavra em português (antes da tradução). Morto, Vendido e o que não estiver
 * nas listas ficam em cinza. "18 meses sem parir" (alerta de Crias e partos) é vermelho.
 */
export function badgeTone(text: string | number | undefined): ReportTone | null {
  const s = String(text ?? '').trim()
  if (GOOD_WORDS.includes(s)) return 'good'
  if (WARN_WORDS.includes(s)) return 'warn'
  if (BAD_WORDS.includes(s) || /^\d+ meses sem parir$/.test(s)) return 'bad'
  return null
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
