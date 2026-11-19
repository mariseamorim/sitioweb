// Formato do Dashboard (tela para deixar numa TV ou monitor): números grandes no topo e gráficos.
// O servidor monta o quadro de cada perfil (src/lib/dashboard.ts) e a tela só desenha (src/app/dashboard).
// Textos em português; a tela traduz com t(). Meses vêm como "AAAA-MM" e dias como "AAAA-MM-DD".

/** Texto para traduzir, com variáveis opcionais: t(text, vars) */
export type Txt = string | { text: string; vars: Record<string, string | number> }
export type Unit = '' | '%' | 'L' | 'R$'
export type Axis = 'month' | 'day'

export interface Tile {
  label: string
  value: number | null
  unit?: Unit
  detail?: Txt
  /** Cor do número: atenção (amber) ou problema (red) */
  tone?: 'warn' | 'bad' | 'good'
}

interface ChartBase {
  title: string
  subtitle?: string
  /** Ocupa a largura de dois gráficos (séries de 30 dias) */
  wide?: boolean
}

export type Chart = ChartBase & (
  | { kind: 'columns' | 'line'; axis: Axis; unit?: Unit; max?: number; points: { x: string; value: number | null }[] }
  | { kind: 'stacked'; axis: Axis; unit?: Unit; xs: string[]; series: { name: string; values: number[] }[] }
  | { kind: 'bars'; unit?: Unit; max?: number; rows: { label: string; value: number | null; translate?: boolean }[] }
  | { kind: 'list'; empty: string; rows: { title: Txt; detail?: Txt; tone?: 'warn' | 'bad' }[] }
)

export interface Board {
  /** produtor | veterinario | laticinio | associacao | fornecedor */
  profile: string
  /** Nome da propriedade, do veterinário, do laticínio ou da empresa */
  name: string
  tiles: Tile[]
  charts: Chart[]
  generatedAt: string
}
