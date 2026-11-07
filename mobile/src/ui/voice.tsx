// Botão de microfone: a pessoa fala o número e ele vai para o campo.
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { brNumber } from '@/lib/format'
import { listenForNumber, prepareOfflineVoice, VoiceError, type VoiceErrorKind } from '@/lib/voice'
import { parseSpokenLiters } from '@/lib/voiceNumber'
import { colors, font, space } from '@/theme'

const ERRORS: Record<VoiceErrorKind, string> = {
  'sem-sinal': 'Sem internet para a voz. Prepare a voz sem internet (abaixo) ou digite o número.',
  'sem-permissao': 'Permita o uso do microfone para falar o número.',
  'nao-ouvi': 'Não ouvi nada. Toque no microfone e fale o número.',
  'sem-suporte': 'Este celular não reconhece voz. Digite o número.',
  falhou: 'A voz não funcionou agora. Digite o número.',
}

export function VoiceButton({ onNumber, unit = 'litros' }: { onNumber: (value: number) => void; unit?: string }) {
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean; kind?: VoiceErrorKind } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function press() {
    if (listening) { abortRef.current?.abort(); return }
    const controller = new AbortController()
    abortRef.current = controller
    setListening(true)
    setMessage({ text: 'Pode falar o número.', ok: true })
    try {
      const { texts } = await listenForNumber(controller.signal)
      const value = texts.map(parseSpokenLiters).find(v => v !== null && v >= 0)
      if (value === undefined || value === null) {
        setMessage({ text: `Não entendi "${texts[0] ?? ''}". Fale só o número, por exemplo "quarenta e sete".`, ok: false })
      } else {
        onNumber(value)
        setMessage({ text: `Ouvi: ${brNumber(value, 2).replace(/,?0+$/, '')} ${unit}. Confira o número.`, ok: true })
      }
    } catch (e) {
      const kind = e instanceof VoiceError ? e.kind : 'falhou'
      setMessage({ text: ERRORS[kind], ok: false, kind })
    } finally {
      setListening(false)
      abortRef.current = null
    }
  }

  async function prepare() {
    try { setMessage({ text: await prepareOfflineVoice(), ok: true }) }
    catch { setMessage({ text: 'Este Android não permite baixar a voz pelo app. Abra Configurações › Idiomas › Reconhecimento de fala.', ok: false }) }
  }

  const canPrepare = Platform.OS === 'android' && Number(Platform.Version) >= 33 && message?.kind === 'sem-sinal' && !listening
  return (
    <View style={{ alignItems: 'center', marginBottom: space.md }}>
      <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={listening ? 'Parar de ouvir' : 'Falar o número'}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 20, borderRadius: 999, borderWidth: 2,
          borderColor: listening ? colors.red : colors.green, backgroundColor: listening ? colors.red : colors.white, opacity: pressed ? 0.85 : 1,
        })}>
        <Ionicons name="mic-outline" size={22} color={listening ? colors.white : colors.green} />
        <Text style={{ fontSize: font.md, fontWeight: '700', color: listening ? colors.white : colors.green }}>
          {listening ? 'Ouvindo... toque para parar' : 'Falar o número'}
        </Text>
      </Pressable>
      {message ? (
        <Text style={{ marginTop: space.sm, fontSize: font.sm, textAlign: 'center', color: message.ok ? colors.green : colors.amber }}>{message.text}</Text>
      ) : null}
      {canPrepare ? (
        <Pressable onPress={prepare} hitSlop={8}>
          <Text style={{ marginTop: space.sm, fontSize: font.sm, fontWeight: '600', color: colors.green, textDecorationLine: 'underline' }}>Preparar a voz sem internet</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
