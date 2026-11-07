// Caixas de seleção múltipla (módulos permitidos, segmentos da propriedade).
import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { styles } from '@/ui'
import { colors, font, radius, space } from '@/theme'

export interface CheckOption { key: string; label: string }

export function CheckGroup({ label, hint, options, value, onChange, disabled, allowed }: {
  label: string
  hint?: string
  options: readonly CheckOption[]
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** Opções que podem ser marcadas (undefined = todas); as outras aparecem travadas */
  allowed?: string[]
}) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {options.map(o => {
          const on = value.includes(o.key)
          const locked = !!disabled || (allowed !== undefined && !allowed.includes(o.key))
          return (
            <Pressable key={o.key} onPress={() => !locked && toggle(o.key)} disabled={locked} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: locked }}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1,
                borderColor: on ? colors.green : colors.border, backgroundColor: on ? colors.greenSoft : colors.white, opacity: locked ? 0.4 : pressed ? 0.8 : 1,
              }]}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.green : colors.muted} />
              <Text style={{ fontSize: font.sm, fontWeight: '600', color: on ? colors.greenDark : colors.text }}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}
