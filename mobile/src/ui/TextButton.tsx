// Ação em texto (como os links de ação do site), com área de toque mínima de 44 px.
import { Pressable, Text } from 'react-native'
import { colors, font } from '@/theme'

export function TextButton({ label, onPress, tone = 'green', disabled }: { label: string; onPress: () => void; tone?: 'green' | 'red' | 'muted'; disabled?: boolean }) {
  const color = tone === 'red' ? colors.red : tone === 'muted' ? colors.muted : colors.green
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, opacity: disabled ? 0.5 : pressed ? 0.6 : 1 })}>
      <Text style={{ color, fontSize: font.sm, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}
