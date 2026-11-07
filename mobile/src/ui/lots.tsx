// Peças da tela de Recria e engorda: escolher animais, pesos de cada um, produtos do lote e indicadores pequenos.
import { useState, type ReactNode } from 'react'
import { Pressable, Text, TextInput, View, type ViewStyle } from 'react-native'
import { methodLabel } from '@/lib/coverage'
import { brDate, brNumber } from '@/lib/format'
import { LOT_PHASES, decimal, parseKg, toField } from '@/lib/lots'
import type { Coverage, Lot, ProductInput, SupplyRef } from '@/repos/lots'
import { Button, Muted, Search, SelectField, styles as ui } from '@/ui'
import { colors, font, radius, space } from '@/theme'

export const kg = (n: number) => `${brNumber(n)} kg`
export const tag = (a: { code: string; customCode: string | null }) => `#${a.customCode || a.code}`
export const phaseLabel = (p: string) => LOT_PHASES.find(x => x.key === p)?.label ?? p
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const PHASE_OPTIONS = LOT_PHASES.map(p => ({ value: p.key as string, label: p.label }))

/** Última cobertura da fêmea, em uma linha */
export function coverageLine(c: Coverage | undefined) {
  if (!c) return 'Sem cobertura registrada'
  if (c.status === 'Vazia' || c.status === 'Perdida') return `${c.status} (cobertura de ${brDate(c.coverageDate)})`
  return `${methodLabel(c.method)} em ${brDate(c.coverageDate)}${c.expectedBirthDate ? ` · parto previsto ${brDate(c.expectedBirthDate)}` : ''}${c.status === 'Prenha' ? ' · prenha' : ''}`
}

/** Título de seção, com texto de ajuda e um botão à direita opcionais */
export function Section({ title, hint, right, children, style }: { title: string; hint?: string; right?: ReactNode; children?: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ marginTop: space.lg }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
          {hint ? <Muted>{hint}</Muted> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}

/** Botão de texto (como os links do site) */
export function TextButton({ label, onPress, tone = 'green', disabled }: { label: string; onPress: () => void; tone?: 'green' | 'red' | 'muted'; disabled?: boolean }) {
  const color = tone === 'red' ? colors.red : tone === 'muted' ? colors.muted : colors.green
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1, minHeight: 32, justifyContent: 'center' })}>
      <Text style={{ color, fontWeight: '700', fontSize: font.sm }}>{label}</Text>
    </Pressable>
  )
}

/** Indicador pequeno, para a grade dentro de um cartão */
export function MiniStat({ title, value, tone }: { title: string; value: string; tone?: 'green' | 'amber' }) {
  const color = tone === 'green' ? colors.green : tone === 'amber' ? colors.amber : colors.text
  const bg = tone === 'amber' ? colors.amberSoft : colors.bg
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: radius.sm, borderWidth: 1, borderColor: tone === 'amber' ? colors.amberSoft : colors.border, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: tone === 'amber' ? colors.amber : colors.muted, textTransform: 'uppercase', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: font.md, fontWeight: '700', color, marginTop: 2, textAlign: 'center' }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}

export function StatGrid({ items }: { items: { title: string; value: string; tone?: 'green' | 'amber' }[] }) {
  // Até três por linha, para caber no celular
  const rows: typeof items[] = []
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3))
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
          {row.map(it => <MiniStat key={it.title} {...it} />)}
        </View>
      ))}
    </View>
  )
}

/** Duas opções grandes lado a lado (fase do lote, como acompanhar) */
export function OptionCards<T extends string>({ options, value, onChange }: { options: { value: T; title: string; hint?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flex: 1, borderWidth: 2, borderColor: on ? colors.green : colors.border, backgroundColor: on ? colors.greenSoft : colors.white, borderRadius: radius.md, padding: space.md, minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700', color: on ? colors.greenDark : colors.text, fontSize: font.sm }}>{o.title}</Text>
            {o.hint ? <Muted>{o.hint}</Muted> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Escolher animais do rebanho ─────────────────────────────────────────

export interface PickableAnimal { id: string; code: string; customCode: string | null; name: string; species: string; lotId: string | null }

export function AnimalPicker({ herd, lotNames, exclude = [], selected, onChange }: {
  herd: PickableAnimal[]
  lotNames: Map<string, string>
  /** Animais que já estão no lote (não aparecem) */
  exclude?: string[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const available = herd.filter(a => !exclude.includes(a.id))
  const list = available.filter(a => !term || [a.code, a.customCode, a.name, a.species].some(v => v?.toLowerCase().includes(term)))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  const allIds = list.map(a => a.id)
  const allOn = allIds.length > 0 && allIds.every(id => selected.includes(id))

  if (available.length === 0) return <Muted style={{ padding: space.md, backgroundColor: colors.bg, borderRadius: radius.md }}>Nenhum animal disponível. Cadastre os animais na tela Animais.</Muted>
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Search value={q} onChange={setQ} placeholder="Buscar por brinco, nome ou categoria" /></View>
        <Button label={allOn ? 'Desmarcar' : 'Marcar todos'} variant="secondary" onPress={() => onChange(allOn ? selected.filter(id => !allIds.includes(id)) : [...new Set([...selected, ...allIds])])} />
      </View>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, overflow: 'hidden' }}>
        {list.map(a => {
          const on = selected.includes(a.id)
          const lotName = a.lotId ? lotNames.get(a.lotId) : undefined
          return (
            <Pressable key={a.id} onPress={() => toggle(a.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: on ? colors.greenSoft : pressed ? colors.bg : colors.white })}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.green : colors.muted, backgroundColor: on ? colors.green : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Text style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}>✓</Text> : null}
              </View>
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <Text style={{ color: colors.text, fontSize: font.md }}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                <Muted>{a.species}{lotName ? ` · está no lote ${lotName} (muda para este)` : ''}</Muted>
              </View>
            </Pressable>
          )
        })}
        {list.length === 0 ? <Muted style={{ padding: space.md }}>Nenhum animal encontrado.</Muted> : null}
      </View>
      <Muted style={{ marginTop: 4 }}>{plural(selected.length, 'selecionado', 'selecionados')}</Muted>
    </View>
  )
}

// ── Pesos de cada animal ────────────────────────────────────────────────

export const averageOf = (weights: Record<string, string>) => {
  const values = Object.values(weights).map(parseKg).filter((v): v is number => v !== null)
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

/** Pesos digitados → { animalId: kg } só dos preenchidos */
export const numericWeights = (weights: Record<string, string>): Record<string, number> =>
  Object.fromEntries(Object.entries(weights).flatMap(([id, v]) => { const n = parseKg(v); return n === null ? [] : [[id, n]] }))

export function WeightList({ animals, weights, onChange, previous }: {
  animals: { id: string; code: string; customCode: string | null; name: string }[]
  weights: Record<string, string>
  onChange: (w: Record<string, string>) => void
  previous?: Map<string, number>
}) {
  const done = animals.filter(a => parseKg(weights[a.id] ?? '') !== null).length
  const left = animals.length - done
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: font.sm, marginBottom: space.sm }}>
        <Text style={{ fontWeight: '700', color: colors.greenDark }}>{done} de {animals.length}</Text> pesados{left > 0 ? ` · ${plural(left, 'pendente', 'pendentes')}` : ''}
      </Text>
      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, overflow: 'hidden' }}>
        {animals.map(a => {
          const before = previous?.get(a.id)
          const now = parseKg(weights[a.id] ?? '')
          return (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: now !== null ? colors.greenSoft : colors.white }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                {before !== undefined ? <Muted>Antes: {kg(before)}{now !== null ? ` · ${now - before >= 0 ? '+' : ''}${brNumber(now - before)} kg` : ''}</Muted> : null}
              </View>
              <TextInput value={weights[a.id] ?? ''} onChangeText={v => onChange({ ...weights, [a.id]: decimal(v) })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted}
                accessibilityLabel={`Peso de ${a.name}`} style={[ui.input, { width: 88, textAlign: 'right', fontWeight: '700', minHeight: 44 }]} />
              <Muted>kg</Muted>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ── Produtos do lote (vários) ───────────────────────────────────────────

export interface ProductForm { supplyId: string; percent: string; packageKg: string; unitPrice: string }

export const productsFromLot = (lot: Lot): ProductForm[] => lot.supplies.map(s => ({ supplyId: s.supply.id, percent: toField(s.percent), packageKg: '', unitPrice: '' }))

/** Campos → entrada da API; texto do erro se algo não for número (as mesmas regras do servidor) */
export function parseProducts(value: ProductForm[]): ProductInput[] | string {
  const items: ProductInput[] = []
  for (const p of value) {
    const percent = p.percent.trim() ? Number(p.percent.replace(',', '.')) : null
    if (percent !== null && !(percent > 0 && percent <= 5)) return 'O consumo deve ser uma % do peso vivo, por exemplo 0,1'
    const packageKg = p.packageKg.trim() ? parseKg(p.packageKg) : undefined
    const unitPrice = p.unitPrice.trim() ? parseKg(p.unitPrice) : undefined
    if (packageKg === null) return 'Peso do saco inválido'
    if (unitPrice === null) return 'Preço inválido'
    items.push({ supplyId: p.supplyId, percent, packageKg, unitPrice })
  }
  return items
}

/** Escolher os produtos que o lote recebe, cada um com o consumo em % do peso vivo */
export function ProductsEditor({ supplies, value, onChange }: { supplies: SupplyRef[]; value: ProductForm[]; onChange: (v: ProductForm[]) => void }) {
  const chosen = new Set(value.map(p => p.supplyId))
  const free = supplies.filter(s => !chosen.has(s.id))
  const set = (i: number, patch: Partial<ProductForm>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  if (supplies.length === 0) {
    return <Muted style={{ padding: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: space.md }}>Cadastre os produtos (suplemento, sal, ração) no Estoque para o app calcular o consumo, dar baixa no trato e avisar antes de acabar.</Muted>
  }
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md, backgroundColor: colors.white }}>
      <Text style={ui.label}>Produtos do lote (opcional)</Text>
      {value.length === 0 ? <Muted style={{ marginBottom: space.sm }}>Nenhum produto. Adicione o que o lote recebe no cocho.</Muted> : null}
      {value.map((p, i) => {
        const supply = supplies.find(s => s.id === p.supplyId)
        const unit = supply?.unit === 'sacos' ? 'saco' : supply?.unit ?? 'unidade'
        return (
          <View key={p.supplyId} style={{ backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.md, marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.text }}>{supply?.name ?? 'Produto'} <Muted>({brNumber(supply?.currentQuantity ?? 0, 0)} {supply?.unit} no estoque)</Muted></Text>
              <TextButton label="Tirar" tone="red" onPress={() => onChange(value.filter((_, j) => j !== i))} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={ui.label}>Consumo (% do peso vivo)</Text>
                <TextInput value={p.percent} onChangeText={v => set(i, { percent: decimal(v) })} keyboardType="decimal-pad" placeholder="Ex.: 0,1" placeholderTextColor={colors.muted} style={ui.input} />
              </View>
              {supply?.unit === 'sacos' ? (
                <View style={{ flex: 1 }}>
                  <Text style={ui.label}>Peso do saco (kg)</Text>
                  <TextInput value={p.packageKg} onChangeText={v => set(i, { packageKg: decimal(v) })} keyboardType="decimal-pad" placeholder={supply.packageKg ? brNumber(supply.packageKg, 0) : 'Ex.: 25'} placeholderTextColor={colors.muted} style={ui.input} />
                </View>
              ) : null}
            </View>
            <View style={{ marginTop: space.sm }}>
              <Text style={ui.label}>Preço por {unit} (R$, opcional)</Text>
              <TextInput value={p.unitPrice} onChangeText={v => set(i, { unitPrice: decimal(v) })} keyboardType="decimal-pad" placeholder={supply?.unitPrice ? brNumber(supply.unitPrice, 2) : 'Ex.: 85,00'} placeholderTextColor={colors.muted} style={ui.input} />
            </View>
          </View>
        )
      })}
      {free.length > 0 ? (
        <SelectField label="+ Adicionar produto" value={null} placeholder="Escolha um produto do estoque" searchable
          options={free.map(s => ({ value: s.id, label: s.name, detail: `${brNumber(s.currentQuantity, 0)} ${s.unit}` }))}
          onChange={id => { if (id) onChange([...value, { supplyId: id, percent: '', packageKg: '', unitPrice: '' }]) }} />
      ) : null}
      <Muted>Exemplo: a 0,1% do peso vivo, um animal de 300 kg come 300 g por dia. O preço serve para mostrar o custo por animal.</Muted>
    </View>
  )
}
