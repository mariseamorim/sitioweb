import { Pressable, Text, View } from 'react-native'
import { LANGS, setLang, useLang } from '@/lib/i18n'
import { colors, font, space } from '@/theme'

/** Troca o idioma do app (fica guardado no aparelho, vale sem internet). */
export function LanguagePicker({ dark = false }: { dark?: boolean }) {
  const lang = useLang()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Idioma" style={{ flexDirection: 'row', alignSelf: 'center', borderRadius: 10, borderWidth: 1, borderColor: dark ? colors.cream : colors.border, padding: 2 }}>
      {LANGS.map((l) => {
        const on = lang === l.code
        return (
          <Pressable
            key={l.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => setLang(l.code)}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: 8, backgroundColor: on ? (dark ? colors.cream : colors.greenSoft) : 'transparent' }}
          >
            <Text style={{ fontSize: font.sm, fontWeight: '700', color: on ? colors.greenDark : dark ? colors.cream : colors.muted }}>{l.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
