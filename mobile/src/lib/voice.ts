// Falar o número de litros. Usa o reconhecimento de voz do Android (o do Google, com internet) e, quando o
// aparelho tem o pacote de português instalado, o reconhecimento no próprio celular, sem internet.
import NetInfo from '@react-native-community/netinfo'
import { ExpoSpeechRecognitionModule, type ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition'
import { Platform } from 'react-native'
import { VOICE_WORDS } from '@/lib/voiceNumber'

const LOCALE = 'pt-BR'

export type VoiceErrorKind = 'sem-sinal' | 'sem-permissao' | 'nao-ouvi' | 'sem-suporte' | 'falhou'
export class VoiceError extends Error {
  constructor(public kind: VoiceErrorKind) { super(kind) }
}

function mapError(code: ExpoSpeechRecognitionErrorCode): VoiceErrorKind {
  switch (code) {
    case 'network': return 'sem-sinal'
    case 'not-allowed': case 'service-not-allowed': return 'sem-permissao'
    case 'no-speech': case 'speech-timeout': case 'aborted': return 'nao-ouvi'
    case 'language-not-supported': return 'sem-suporte'
    default: return 'falhou'
  }
}

/** Ouve uma vez e devolve as alternativas do que foi dito. */
function listenOnce(signal: AbortSignal, onDevice: boolean): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let done = false
    const subs: { remove: () => void }[] = []
    const finish = (fn: () => void) => { if (done) return; done = true; subs.forEach(s => s.remove()); fn() }
    subs.push(ExpoSpeechRecognitionModule.addListener('result', e => {
      if (e.isFinal) finish(() => resolve(e.results.map(r => r.transcript).filter(Boolean)))
    }))
    subs.push(ExpoSpeechRecognitionModule.addListener('error', e => finish(() => reject(new VoiceError(mapError(e.error))))))
    subs.push(ExpoSpeechRecognitionModule.addListener('end', () => finish(() => reject(new VoiceError('nao-ouvi')))))
    // Toque no botão enquanto ouve: encerra e aproveita o que já foi dito
    signal.addEventListener('abort', () => ExpoSpeechRecognitionModule.stop())
    ExpoSpeechRecognitionModule.start({
      lang: LOCALE, interimResults: false, maxAlternatives: 5, continuous: false,
      requiresOnDeviceRecognition: onDevice, contextualStrings: VOICE_WORDS,
    })
  })
}

export function offlineVoiceSupported(): boolean {
  try { return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() } catch { return false }
}

/** Android 13+: pede ao sistema para baixar o pacote de português para reconhecer sem internet. */
export async function prepareOfflineVoice(): Promise<string> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) throw new VoiceError('sem-suporte')
  const r = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: LOCALE })
  return r.status === 'download_success' ? 'Voz sem internet pronta neste celular.'
    : r.status === 'download_scheduled' ? 'Download agendado pelo Android (espera o Wi-Fi).'
      : 'Confirme o download na janela do Android.'
}

export async function listenForNumber(signal: AbortSignal): Promise<{ texts: string[]; offline: boolean }> {
  if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new VoiceError('sem-suporte')
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
  if (!perm.granted) throw new VoiceError('sem-permissao')
  const onDevice = offlineVoiceSupported()
  const online = (await NetInfo.fetch()).isConnected !== false
  if (online) {
    try {
      return { texts: await listenOnce(signal, false), offline: false }
    } catch (e) {
      // Sinal fraco: o Google não respondeu; tenta a voz do próprio celular
      if (!(e instanceof VoiceError && e.kind === 'sem-sinal' && onDevice)) throw e
    }
  }
  if (!onDevice) throw new VoiceError('sem-sinal')
  try {
    return { texts: await listenOnce(signal, true), offline: true }
  } catch (e) {
    // Sem o pacote de português no aparelho
    if (e instanceof VoiceError && e.kind === 'sem-suporte') throw new VoiceError('sem-sinal')
    throw e
  }
}
