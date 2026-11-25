// Formato do Dashboard (tela para deixar numa TV ou monitor): números grandes no topo e gráficos.
// O servidor monta o quadro de cada perfil (src/lib/dashboard.ts) e a tela só desenha (src/app/dashboard).
// Textos em português; a tela traduz com t(). Meses vêm como "AAAA-MM" e dias como "AAAA-MM-DD".

/** Texto para traduzir, com variáveis opcionais: t(text, vars) */
export type Txt = string | { text: string; vars: Record<string, string | number> }
export type Unit = '' | '%' | 'L' | 'R$'
export type Axis = 'month' | 'day'
/** Cor do cartão de número (src/components/StatTile.tsx) */
export type Accent = 'green' | 'blue' | 'teal' | 'amber' | 'red'
export type Tone = 'good' | 'warn' | 'bad'

export interface Tile {
  label: string
  value: number | null
  unit?: Unit
  detail?: Txt
  /** Palavra depois do número, menor: "82 animais" */
  suffix?: string
  /** Situação: atenção (amber) ou problema (red) pintam o cartão; sem situação, a cor vem de `accent` */
  tone?: Tone
  accent?: Accent
}

/** Célula da tabela: texto, número ou dia ("AAAA-MM-DD"); com `badge`, aparece como etiqueta colorida pela `tone` */
export type Cell = ({ text: Txt } | { value: number | null; unit?: Unit } | { date: string | null }) & { tone?: Tone; badge?: Txt }

interface ChartBase {
  title: string
  subtitle?: Txt
  /** Ocupa a largura de dois gráficos (séries de 30 dias) */
  wide?: boolean
  /** Ocupa a linha inteira (tabelas) */
  full?: boolean
}

export type Chart = ChartBase & (
  | { kind: 'columns' | 'line'; axis: Axis; unit?: Unit; max?: number; points: { x: string; value: number | null }[] }
  | { kind: 'stacked'; axis: Axis; unit?: Unit; xs: string[]; series: { name: string; values: number[] }[] }
  | {
    kind: 'bars'; unit?: Unit; max?: number; rows: { label: string; value: number | null; translate?: boolean }[]
    color?: 'green' | 'blue'
    /** Linha tracejada de referência (ex.: a média de todas as propriedades) */
    reference?: { value: number; label: Txt }
  }
  | { kind: 'table'; columns: { label: string; numeric?: boolean }[]; rows: Cell[][] }
  | { kind: 'list'; empty: string; rows: { title: Txt; detail?: Txt; tone?: 'warn' | 'bad' }[] }
)

export interface Board {
  /** produtor | veterinario | laticinio | associacao | fornecedor */
  profile: string
  /** Nome da propriedade, do veterinário, do laticínio ou da empresa */
  name: string
  tiles: Tile[]
  charts: Chart[]
  /** Período escolhido (meses) e as opções, nos quadros que têm filtro de período */
  period?: { months: number; options: number[] }
  generatedAt: string
}
