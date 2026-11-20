// Cartão de número com cor de fundo e faixa no topo (Consultoria, Dashboard, Leite, Recria e engorda).
// A cor ajuda a achar o número; o nome do número sempre aparece escrito, a cor nunca é a única pista.
export type Accent = 'green' | 'blue' | 'teal' | 'amber' | 'red'

const ACCENT: Record<Accent, { box: string; bar: string; value: string }> = {
  green: { box: 'border-green-200 bg-green-50', bar: 'bg-green-600', value: 'text-green-900' },
  blue: { box: 'border-blue-200 bg-blue-50', bar: 'bg-blue-600', value: 'text-blue-900' },
  teal: { box: 'border-teal-200 bg-teal-50', bar: 'bg-teal-600', value: 'text-teal-900' },
  amber: { box: 'border-amber-200 bg-amber-50', bar: 'bg-amber-500', value: 'text-amber-800' },
  red: { box: 'border-red-200 bg-red-50', bar: 'bg-red-600', value: 'text-red-700' },
}

export function StatTile({ label, value, detail, accent = 'green', children }: {
  label: string; value: React.ReactNode; detail?: React.ReactNode; accent?: Accent; children?: React.ReactNode
}) {
  const a = ACCENT[accent]
  return (
    <div className={`relative overflow-hidden rounded-xl border p-4 pt-5 ${a.box}`}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${a.bar}`} />
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${a.value}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-gray-600">{detail}</p> : null}
      {children}
    </div>
  )
}
