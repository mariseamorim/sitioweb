// Componentes de interface do app: poucos, consistentes, com toque mínimo de 44 px.
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, type TextInputProps, type ViewStyle,
} from 'react-native'
import { useSegments } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, font, radius, space } from '@/theme'
import { brDate } from '@/lib/format'
import { matches } from '@/lib/search'
import { Ionicons } from '@expo/vector-icons'
import { useLocale, useT } from '@/lib/i18n'

// Rótulos, botões, avisos e títulos passam por t(): o texto em português vira o do idioma escolhido. Quem chama já pode
// mandar traduzido (t de um texto que não é chave devolve o próprio texto).
const asText = (t: (s: string) => string, node: ReactNode) => (typeof node === 'string' ? t(node) : node)

/** Tela com rolagem. `header`: há cabeçalho de navegação acima (para calcular o espaço do teclado). */
export function Screen({ children, scroll = true, style, background, header = true }: { children: ReactNode; scroll?: boolean; style?: ViewStyle; background?: string; header?: boolean }) {
  const bottom = useBottomInset()
  const insets = useSafeAreaInsets()
  const inner = <View style={[styles.screenInner, { paddingBottom: 96 + bottom }, style]}>{children}</View>
  // "padding" também no Android: com a tela até a borda (edge-to-edge) o sistema não encolhe a janela quando o teclado
  // abre, e o campo em edição ficava escondido. O recuo é a altura do cabeçalho (56) mais a barra de status.
  return (
    <KeyboardAvoidingView style={[styles.screen, background ? { backgroundColor: background } : null]} behavior="padding"
      keyboardVerticalOffset={header ? insets.top + 56 : 0}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{inner}</ScrollView> : inner}
    </KeyboardAvoidingView>
  )
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  const t = useT()
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={styles.title}>{asText(t, children)}</Text>
      {sub ? <Text style={styles.muted}>{asText(t, sub)}</Text> : null}
    </View>
  )
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>{children}</Pressable>
  return <View style={[styles.card, style]}>{children}</View>
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, style, icon }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent' | 'destructive'; loading?: boolean; disabled?: boolean; style?: ViewStyle
  /** Ícone (Ionicons) à esquerda do texto */
  icon?: keyof typeof Ionicons.glyphMap
}) {
  // destructive: apagar/excluir discreto (texto e borda vermelhos), para não parecer uma ação neutra
  const bg = variant === 'primary' ? colors.green : variant === 'danger' ? colors.red : variant === 'accent' ? colors.amber : variant === 'secondary' || variant === 'destructive' ? colors.white : 'transparent'
  const fg = variant === 'primary' || variant === 'danger' || variant === 'accent' ? colors.white : variant === 'destructive' ? colors.red : colors.green
  const t = useT()
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: variant === 'secondary' ? colors.green : variant === 'destructive' ? colors.red : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{t(label)}</Text>
        </View>
      )}
    </Pressable>
  )
}

/** Campo de texto. Com secureTextEntry (senha) ganha o olho para mostrar ou esconder; noReveal tira o olho. */
export function Field({ label, hint, error, style, noReveal, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null; noReveal?: boolean }) {
  const t = useT()
  const [show, setShow] = useState(false)
  const reveal = !!props.secureTextEntry && !noReveal
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{t(label)}</Text>
      <View>
        <TextInput placeholderTextColor={colors.muted} {...props} placeholder={props.placeholder ? t(props.placeholder) : props.placeholder} secureTextEntry={reveal ? !show : props.secureTextEntry} style={[styles.input, props.multiline && { minHeight: 88, textAlignVertical: 'top' }, reveal && { paddingRight: 52 }]} />
        {reveal ? (
          <Pressable onPress={() => setShow(s => !s)} accessibilityRole="button" accessibilityLabel={t(show ? 'Esconder senha' : 'Mostrar senha')} accessibilityState={{ selected: show }}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 52, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{t(error)}</Text> : hint ? <Text style={styles.hint}>{t(hint)}</Text> : null}
    </View>
  )
}

export interface Option { value: string; label: string; detail?: string }

export function SelectField({ label, value, options, onChange, placeholder = 'Escolher', searchable, allowEmpty }: {
  label: string; value: string | null; options: Option[]; onChange: (value: string | null) => void; placeholder?: string; searchable?: boolean; allowEmpty?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = options.find(o => o.value === value)
  const shown = q ? options.filter(o => matches(o.label + ' ' + (o.detail ?? ''), q)) : options
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t(label)}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.input} accessibilityRole="button">
        <Text style={{ fontSize: font.md, color: current ? colors.text : colors.muted }}>{current ? t(current.label) : t(placeholder)}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t(label)}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}><Text style={styles.link}>{t('Fechar')}</Text></Pressable>
          </View>
          {searchable ? <TextInput value={q} onChangeText={setQ} placeholder={t('Buscar')} placeholderTextColor={colors.muted} style={[styles.input, { margin: space.lg, marginTop: 0 }]} autoFocus /> : null}
          <FlatList
            data={allowEmpty ? [{ value: '', label: t('Nenhum') }, ...shown] : shown}
            keyExtractor={o => o.value || '__none'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => { onChange(item.value || null); setOpen(false); setQ('') }} style={[styles.option, item.value === (value ?? '') && { backgroundColor: colors.greenSoft }]}>
                <Text style={{ fontSize: font.md, color: colors.text }}>{t(item.label)}</Text>
                {item.detail ? <Text style={styles.muted}>{t(item.detail)}</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.muted, { padding: space.lg }]}>{t('Nada encontrado')}</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}

/** Data no formato AAAA-MM-DD; vazio = sem data. */
export function DateField({ label, value, onChange, allowEmpty }: { label: string; value: string; onChange: (iso: string) => void; allowEmpty?: boolean }) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const date = value ? new Date(value + 'T12:00:00') : new Date()
  const onPick = (e: DateTimePickerEvent, d?: Date) => {
    setOpen(false)
    if (e.type !== 'set' || !d) return
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t(label)}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable onPress={() => setOpen(true)} style={[styles.input, { flex: 1 }]} accessibilityRole="button">
          <Text style={{ fontSize: font.md, color: value ? colors.text : colors.muted }}>{value ? brDate(value) : t('Escolher data')}</Text>
        </Pressable>
        {allowEmpty && value ? <Button label="Limpar" variant="ghost" onPress={() => onChange('')} /> : null}
      </View>
      {open ? <DateTimePicker value={date} mode="date" display="default" onChange={onPick} locale={locale} /> : null}
    </View>
  )
}

/** Escolha única entre poucas opções (até ~5), lado a lado. Com `label`, fica como um campo do formulário. */
export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; label?: string }) {
  const t = useT()
  const chips = (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: label ? 0 : space.sm }}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ checked: value === o.value }}
          style={({ pressed }) => [styles.chip, value === o.value && styles.chipOn, pressed && { opacity: 0.85 }]}>
          <Text style={[styles.chipText, value === o.value && { color: colors.white }]}>{t(o.label)}</Text>
        </Pressable>
      ))}
    </View>
  )
  if (!label) return chips
  return <View style={styles.field}><Text style={styles.label}>{t(label)}</Text>{chips}</View>
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'muted' }) {
  const map = { green: [colors.greenSoft, colors.green], amber: [colors.amberSoft, colors.amber], red: [colors.redSoft, colors.red], blue: [colors.blueSoft, colors.blue], purple: [colors.purpleSoft, colors.purple], muted: [colors.border, colors.muted] } as const
  const [bg, fg] = map[tone]
  const t = useT()
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: font.sm, fontWeight: '600' }}>{t(label)}</Text></View>
}

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'muted'
const TONE: Record<Tone, readonly [string, string]> = {
  green: [colors.greenSoft, colors.green], amber: [colors.amberSoft, colors.amber], red: [colors.redSoft, colors.red],
  blue: [colors.blueSoft, colors.blue], purple: [colors.purpleSoft, colors.purple], muted: [colors.border, colors.muted],
}

/** Ícone num círculo de fundo claro colorido, para o `left` do Row e cartões de lista. */
export function IconCircle({ icon, tone = 'green', size = 40 }: { icon: keyof typeof Ionicons.glyphMap; tone?: Tone; size?: number }) {
  const [bg, fg] = TONE[tone]
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={Math.round(size / 2)} color={fg} />
    </View>
  )
}

export function Row({ title, detail, right, onPress, badge, left }: { title: string; detail?: string; right?: ReactNode; onPress?: () => void; badge?: ReactNode; left?: ReactNode }) {
  const t = useT()
  const body = (
    <View style={styles.row}>
      {left ? <View style={{ marginRight: space.md }}>{left}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{t(title)}</Text>
        {detail ? <Text style={styles.muted} numberOfLines={2}>{t(detail)}</Text> : null}
        {badge ? <View style={{ marginTop: 4, flexDirection: 'row' }}>{badge}</View> : null}
      </View>
      {right ? <View style={{ alignItems: 'flex-end', marginLeft: space.md }}>{right}</View> : null}
    </View>
  )
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>{body}</Pressable> : body
}

export function Empty({ title, text }: { title: string; text?: string }) {
  const t = useT()
  return (
    <View style={{ padding: space.xl, alignItems: 'center' }}>
      <Text style={{ fontSize: font.lg, color: colors.text, fontWeight: '600', textAlign: 'center' }}>{t(title)}</Text>
      {text ? <Text style={[styles.muted, { textAlign: 'center', marginTop: space.sm }]}>{t(text)}</Text> : null}
    </View>
  )
}

export function Search({ value, onChange, placeholder = 'Buscar' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const t = useT()
  return <TextInput value={value} onChangeText={onChange} placeholder={t(placeholder)} placeholderTextColor={colors.muted} style={[styles.input, { marginBottom: space.sm }]} clearButtonMode="while-editing" />
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' | 'amber' }) {
  const color = tone === 'green' ? colors.green : tone === 'red' ? colors.red : tone === 'amber' ? colors.amber : colors.text
  const t = useT()
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.muted}>{t(label)}</Text>
    </View>
  )
}

/** `plain`: sem cor própria; com `color`, o cartão usa essa cor de fundo */
export type Accent = 'green' | 'blue' | 'teal' | 'amber' | 'red' | 'plain'
/** Cores sólidas dos cartões (como os cartões do site: verde, azul-marinho, verde-água, laranja e vermelho) */
// Laranja e vermelho escurecidos para o texto branco passar de 4,5:1 (leitura ao sol)
const SOLID: Record<Exclude<Accent, 'plain'>, string> = { green: '#15803d', blue: '#1e3a8a', teal: '#0f766e', amber: '#c2410c', red: '#b91c1c' }

type TileIconName = keyof typeof Ionicons.glyphMap
/** Ícone pelo nome do número, em português e em espanhol (a mesma ideia de src/components/StatTile.tsx do site) */
export function tileIcon(label: string): TileIconName {
  const l = label.toLocaleLowerCase('pt-BR')
  const has = (...words: string[]) => words.some(w => l.includes(w))
  if (has('saldo', 'receita', 'despesa', 'valor', 'custo', 'preço', 'sobra', 'prejuízo', 'r$', 'ingreso', 'gasto', 'costo', 'precio', 'margen', 'pérdida', 'pagar', 'receber', 'compra')) return 'cash-outline'
  if (has('leite', 'litro', 'leche', 'tanque', 'ordenha')) return 'water-outline'
  if (has('concepção', 'concepción', 'taxa', 'tasa', 'prenhez', 'preñez', '%')) return 'pie-chart-outline'
  if (has('vacina', 'vacuna')) return 'medkit-outline'
  if (has('diagnos', 'pendente', 'tarefa', 'tarea', 'atrasad')) return 'clipboard-outline'
  if (has('estoque', 'inventario', 'insumo', 'produto', 'producto', 'vencer', 'mínimo')) return 'cube-outline'
  if (has('peso', 'ganho', 'gmd', 'kg', 'arroba', '@', 'ganancia')) return 'scale-outline'
  if (has('visita')) return 'home-outline'
  if (has('parto', 'dia', 'mes', 'mês', 'data', 'fecha', 'previs')) return 'calendar-outline'
  if (has('animal', 'animais', 'animales', 'rebanho', 'rebaño', 'cabeça', 'cabeza', 'vaca', 'novilha', 'bezer', 'touro', 'boi', 'lote', 'propriedade', 'propiedad', 'fêmea')) return 'paw-outline'
  return 'stats-chart-outline'
}

/** Cartão de número em cor sólida com ícone (como src/components/StatTile.tsx do site). Dois por linha: use dentro de <TileGrid>. */
export function Tile({ label, value, detail, accent = 'green', color, icon }: { label: string; value: string; detail?: string; accent?: Accent; color?: string; icon?: TileIconName }) {
  const bg = accent === 'plain' ? color ?? colors.green : SOLID[accent]
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: bg, borderRadius: radius.lg, padding: space.md, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
      {/* Brilho suave no canto, para o cartão não ficar chapado */}
      <View style={{ position: 'absolute', right: -22, top: -26, width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}>
        <Text style={{ flex: 1, color: '#ffffff', fontSize: font.md, fontWeight: '700' }}>{label}</Text>
        <Ionicons name={icon ?? tileIcon(label)} size={22} color="rgba(255,255,255,0.92)" />
      </View>
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {detail ? <Text style={{ color: '#ffffff', fontSize: font.sm }}>{detail}</Text> : null}
    </View>
  )
}

/** Atalho colorido com ícone (Painel: "O que você quer fazer?"). Dois por linha, dentro de <TileGrid>. */
export function ActionCard({ title, detail, icon, accent, onPress }: { title: string; detail?: string; icon: keyof typeof Ionicons.glyphMap; accent: Accent; onPress: () => void }) {
  const bg = accent === 'plain' ? colors.green : SOLID[accent]
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: bg, borderRadius: radius.lg, padding: space.md, overflow: 'hidden', opacity: pressed ? 0.85 : 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color="#ffffff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#ffffff', fontSize: font.md, fontWeight: '700' }}>{title}</Text>
        {detail ? <Text style={{ color: '#ffffff', fontSize: font.sm }}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ffffff" />
    </Pressable>
  )
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>{children}</View>
}

export function Notice({ text, tone = 'amber' }: { text: string; tone?: 'amber' | 'red' | 'green' | 'blue' }) {
  const map = { amber: [colors.amberSoft, colors.amber], red: [colors.redSoft, colors.red], green: [colors.greenSoft, colors.green], blue: [colors.blueSoft, colors.blue] } as const
  const [bg, fg] = map[tone]
  const t = useT()
  return <View style={[styles.notice, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: font.sm }}>{t(text)}</Text></View>
}

/** Recuo inferior da tela (botões de navegação do Android). Dentro das abas a barra de abas já ocupa esse espaço. */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  return segments[0] === '(tabs)' ? 0 : insets.bottom
}

export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const bottom = useBottomInset()
  const t = useT()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, { bottom: space.lg + bottom }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: font.md }}>{t(label)}</Text>
    </Pressable>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  screenInner: { flex: 1, padding: space.lg, paddingBottom: 96 },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  muted: { fontSize: font.sm, color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md },
  button: { minHeight: 48, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: font.md, fontWeight: '700' },
  field: { marginBottom: space.md },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: space.md, paddingVertical: 10, fontSize: font.md, color: colors.text, justifyContent: 'center' },
  hint: { fontSize: font.sm, color: colors.muted, marginTop: 4 },
  error: { fontSize: font.sm, color: colors.red, marginTop: 4 },
  link: { color: colors.green, fontWeight: '700', fontSize: font.md },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  option: { paddingVertical: 14, paddingHorizontal: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.white },
  chip: { paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md },
  statValue: { fontSize: font.xl, fontWeight: '700' },
  notice: { borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  fab: { position: 'absolute', right: space.lg, bottom: space.lg, backgroundColor: colors.green, borderRadius: 999, paddingHorizontal: 20, minHeight: 52, justifyContent: 'center', elevation: 4 },
})
