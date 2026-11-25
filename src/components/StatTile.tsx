// Cartão de número em cor sólida, com ícone no canto (Dashboard, Financeiro, Estoque, Leite, Consultoria...).
// A cor ajuda a achar o número; o nome do número sempre aparece escrito, a cor nunca é a única pista.
// O ícone vem do nome do número (ex.: "Leite no mês" → frasco); `icon` escolhe outro.
export type Accent = 'green' | 'blue' | 'teal' | 'amber' | 'red'

const ACCENT: Record<Accent, string> = {
  green: 'from-green-700 to-green-600 shadow-green-900/20',
  blue: 'from-blue-900 to-blue-700 shadow-blue-900/25',
  // Fim do gradiente em tons escuros: o número e o detalhe ficam ali, em texto branco (contraste ≥ 4,5:1)
  teal: 'from-teal-800 to-teal-600 shadow-teal-900/20',
  amber: 'from-orange-700 to-amber-700 shadow-orange-900/20',
  red: 'from-red-700 to-rose-600 shadow-red-900/20',
}

export type TileIcon = 'rebanho' | 'leite' | 'taxa' | 'tarefa' | 'dinheiro' | 'data' | 'vacina' | 'estoque' | 'peso' | 'grafico' | 'visita'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
const ICONS: Record<TileIcon, React.ReactNode> = {
  // Cabeça de boi
  rebanho: <><path d="M4 5c1 2 2.5 3 4 3h8c1.5 0 3-1 4-3" /><path d="M7 8v5a5 5 0 0010 0V8" /><path d="M10 15h.01M14 15h.01" /><path d="M9.5 18c1.5 1 3.5 1 5 0" /></>,
  // Frasco de leite e gota
  leite: <><path d="M7 3h6M8 3v3l-2 3v11a1 1 0 001 1h6a1 1 0 001-1V9l-2-3V3" /><path d="M6 12h8" /><path d="M19 13c-1.2 1.6-2 2.7-2 3.6a2 2 0 004 0c0-.9-.8-2-2-3.6z" /></>,
  taxa: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 15l6-6" /><circle cx="9.5" cy="9.5" r="1" /><circle cx="14.5" cy="14.5" r="1" /></>,
  tarefa: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 13.5h6M9 17h4" /></>,
  dinheiro: <><path d="M12 3v18" /><path d="M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.5 0-4 1.2-4 3s1.6 2.6 4 3.2 4 1.4 4 3.3-1.6 3-4 3c-2.2 0-3.8-.8-4.6-2.2" /></>,
  data: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  vacina: <><path d="M15 3l6 6M18 6l-9.5 9.5-3-3L15 3" /><path d="M7 14l-4 4 3 3 4-4M9 9l2 2M11 7l2 2" /></>,
  estoque: <><path d="M3.5 8L12 4l8.5 4v8L12 20l-8.5-4z" /><path d="M3.5 8L12 12l8.5-4M12 12v8" /></>,
  peso: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 10a4 4 0 018 0" /><path d="M12 10l1.5-2" /></>,
  grafico: <><path d="M4 20V4M4 20h16" /><path d="M8 16l3.5-4 3 2.5L20 8" /></>,
  visita: <><path d="M3.5 11L12 4l8.5 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
}

/** Ícone pelo nome do número, em português e em espanhol */
function iconFor(label: string): TileIcon {
  const l = label.toLocaleLowerCase('pt-BR')
  const has = (...words: string[]) => words.some((w) => l.includes(w))
  if (has('saldo', 'receita', 'despesa', 'valor', 'custo', 'preço', 'sobra', 'prejuízo', 'r$', 'ingreso', 'gasto', 'costo', 'precio', 'margen', 'pérdida', 'pagar', 'receber', 'compra')) return 'dinheiro'
  if (has('leite', 'litro', 'leche', 'tanque', 'ordenha')) return 'leite'
  if (has('concepção', 'concepción', 'taxa', 'tasa', 'prenhez', 'preñez', '%')) return 'taxa'
  if (has('vacina', 'vacuna')) return 'vacina'
  if (has('diagnos', 'pendente', 'tarefa', 'tarea', 'atrasad')) return 'tarefa'
  if (has('estoque', 'inventario', 'insumo', 'produto', 'producto', 'vencer', 'mínimo')) return 'estoque'
  if (has('peso', 'ganho', 'gmd', 'kg', 'arroba', '@', 'ganancia')) return 'peso'
  if (has('visita')) return 'visita'
  if (has('parto', 'dia', 'mes', 'mês', 'data', 'fecha', 'previs')) return 'data'
  if (has('animal', 'animais', 'animales', 'rebanho', 'rebaño', 'cabeça', 'cabeza', 'vaca', 'novilha', 'bezer', 'touro', 'boi', 'lote', 'propriedade', 'propiedad', 'fêmea')) return 'rebanho'
  return 'grafico'
}

export function StatTile({ label, value, detail, accent = 'green', icon, badge, children }: {
  label: string; value: React.ReactNode; detail?: React.ReactNode; accent?: Accent
  /** Ícone do canto; sem ele, escolhido pelo nome do número */
  icon?: TileIcon
  /** Selo ao lado do número (ex.: "Atenção") */
  badge?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md ${ACCENT[accent]}`}>
      {/* Brilho suave no canto, para o cartão não ficar chapado */}
      <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-white/95">{label}</p>
        <svg aria-hidden="true" className="h-7 w-7 shrink-0 text-white/90" {...stroke}>{ICONS[icon ?? iconFor(label)]}</svg>
      </div>
      {/* Número comprido ("11.110.565 L") em letra menor, para caber numa linha */}
      <p className="relative mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-extrabold tabular-nums ${typeof value === 'string' && value.length > 9 ? 'text-2xl' : 'text-3xl'}`}>{value}</span>
        {badge && <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-bold text-red-700">{badge}</span>}
      </p>
      {detail ? <p className="relative mt-1 text-sm text-white/90">{detail}</p> : null}
      {children ? <div className="relative text-white/95 [&_*]:!text-inherit">{children}</div> : null}
    </div>
  )
}
