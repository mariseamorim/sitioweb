// Ditado de números por voz para anotar o leite.
// Com internet usa o reconhecimento do navegador; sem internet usa um modelo de voz em português
// guardado no próprio celular (Vosk, ~32 MB, baixado só por quem quiser).
// Arquivos em public/voz (licença Apache-2.0): vosk-0.0.8.js = dist/vosk.js do pacote npm vosk-browser 0.0.8;
// vosk-model-small-pt-0.3.tar.gz = modelo de português de alphacephei.com/vosk/models.
import { VOICE_WORDS } from '@/lib/voiceNumber'

export const VOICE_MODEL_SIZE_MB = 32
const SCRIPT_URL = '/voz/vosk-0.0.8.js'
const MODEL_URL = '/voz/vosk-model-small-pt-0.3.tar.gz'
const CACHE = 'anota-voz-v1'
// O modelo fica guardado (descompactado) pelo Vosk no IndexedDB, com o endereço usado na primeira
// carga como chave. Guardamos esse endereço para achar a mesma cópia depois, sem baixar de novo.
const READY_KEY = 'voz_offline_v1'

export type VoiceErrorKind = 'sem-sinal' | 'sem-permissao' | 'nao-ouvi' | 'sem-suporte' | 'falhou'
export class VoiceError extends Error {
  constructor(public kind: VoiceErrorKind) { super(kind) }
}

// ── Reconhecimento do navegador (com internet) ───────────────────────────

type SpeechAlternative = { transcript: string }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<SpeechAlternative>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function hasBrowserVoice() {
  return speechRecognitionCtor() !== null
}

function listenBrowser(signal: AbortSignal): Promise<string[]> {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) return Promise.reject(new VoiceError('sem-suporte'))
  return new Promise((resolve, reject) => {
    const rec = new Ctor()
    rec.lang = 'pt-BR'
    rec.interimResults = false
    rec.maxAlternatives = 5
    rec.continuous = false
    let done = false
    const finish = (fn: () => void) => { if (!done) { done = true; fn() } }
    rec.onresult = (e) => finish(() => resolve(Array.from(e.results[0] ?? [], (a) => a.transcript)))
    rec.onerror = (e) => finish(() => reject(new VoiceError(
      e.error === 'network' ? 'sem-sinal'
        : e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'sem-permissao'
          : e.error === 'no-speech' || e.error === 'aborted' ? 'nao-ouvi' : 'falhou')))
    rec.onend = () => finish(() => reject(new VoiceError('nao-ouvi')))
    signal.addEventListener('abort', () => rec.abort())
    rec.start()
  })
}

// ── Voz no celular, sem internet (Vosk) ──────────────────────────────────

type VoskRecognizer = {
  on: (event: 'result' | 'partialresult', cb: (m: { result: { text?: string; partial?: string } }) => void) => void
  acceptWaveform: (buffer: AudioBuffer) => void
  retrieveFinalResult: () => void
  remove: () => void
}
type VoskModel = { KaldiRecognizer: new (sampleRate: number, grammar?: string) => VoskRecognizer; terminate: () => void }
type VoskLib = { createModel: (url: string, logLevel?: number) => Promise<VoskModel> }

export function offlineVoiceReady() {
  try { return !!localStorage.getItem(READY_KEY) } catch { return false }
}

async function loadScript(): Promise<VoskLib> {
  const w = window as unknown as { Vosk?: VoskLib }
  if (w.Vosk) return w.Vosk
  // O script fica no cache do aparelho para carregar sem internet
  const cache = await caches.open(CACHE)
  let response = await cache.match(SCRIPT_URL)
  if (!response) {
    response = await fetch(SCRIPT_URL)
    if (!response.ok) throw new VoiceError('falhou')
    await cache.put(SCRIPT_URL, response.clone())
  }
  const url = URL.createObjectURL(await response.blob())
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = url
    s.onload = () => resolve()
    s.onerror = () => reject(new VoiceError('falhou'))
    document.head.appendChild(s)
  })
  URL.revokeObjectURL(url)
  if (!w.Vosk) throw new VoiceError('falhou')
  return w.Vosk
}

let modelPromise: Promise<VoskModel> | null = null

function loadModel(): Promise<VoskModel> {
  const key = (() => { try { return localStorage.getItem(READY_KEY) } catch { return null } })()
  if (!key) return Promise.reject(new VoiceError('sem-sinal'))
  modelPromise ??= loadScript().then((lib) => lib.createModel(key, -2)).catch((e) => { modelPromise = null; throw e })
  return modelPromise
}

// Baixa o modelo mostrando o progresso e prepara para uso sem internet
export async function downloadOfflineVoice(onProgress: (fraction: number) => void): Promise<void> {
  await navigator.storage?.persist?.().catch(() => false)
  // Começa limpo: uma cópia antiga (de um download anterior) ocuparia o espaço em dobro
  modelPromise = null
  try { localStorage.removeItem(READY_KEY) } catch {}
  await new Promise((resolve) => { const req = indexedDB.deleteDatabase('/vosk'); req.onsuccess = req.onerror = req.onblocked = resolve })
  const lib = await loadScript()
  const response = await fetch(MODEL_URL)
  if (!response.ok || !response.body) throw new VoiceError('falhou')
  const total = Number(response.headers.get('Content-Length')) || VOICE_MODEL_SIZE_MB * 1024 * 1024
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress(Math.min(received / total, 0.99))
  }
  // O Vosk descompacta e guarda no IndexedDB; o endereço do arquivo vira a chave dessa cópia
  const blobUrl = URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'application/gzip' }))
  try {
    const model = await lib.createModel(blobUrl, -2)
    localStorage.setItem(READY_KEY, blobUrl)
    modelPromise = Promise.resolve(model)
    onProgress(1)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

async function listenOffline(signal: AbortSignal, maxMs = 8000): Promise<string[]> {
  const model = await loadModel()
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
  } catch {
    throw new VoiceError('sem-permissao')
  }
  const ctx = new AudioContext()
  const rec = new model.KaldiRecognizer(ctx.sampleRate, JSON.stringify([...VOICE_WORDS, '[unk]']))
  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor é antigo, mas funciona em todos os navegadores de celular sem arquivo extra
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  processor.onaudioprocess = (e) => { try { rec.acceptWaveform(e.inputBuffer) } catch {} }
  source.connect(processor)
  processor.connect(ctx.destination)

  try {
    return await new Promise<string[]>((resolve, reject) => {
      const clean = (t?: string) => (t ?? '').replace(/\[unk\]/g, '').replace(/\s+/g, ' ').trim()
      const said: string[] = []
      let partial = ''
      let stopping = false
      let settle: ReturnType<typeof setTimeout> | undefined
      const finish = () => {
        clearTimeout(timer); clearTimeout(giveUp); clearTimeout(settle)
        const text = clean([...said, partial].join(' '))
        if (text) resolve([text])
        else reject(new VoiceError('nao-ouvi'))
      }
      // Tempo esgotado ou toque no botão: pede o que foi ouvido até agora
      const stop = () => { if (!stopping) { stopping = true; clearTimeout(timer); rec.retrieveFinalResult() } }
      const timer = setTimeout(stop, maxMs)
      const giveUp = setTimeout(finish, maxMs + 3000)
      signal.addEventListener('abort', stop)
      // O Vosk entrega um trecho a cada pausa ("quarenta e sete" ... "vírgula cinco"):
      // junta os trechos e encerra depois de ~1 s sem fala
      rec.on('partialresult', (m) => {
        partial = clean(m.result.partial)
        if (partial) clearTimeout(settle)
      })
      rec.on('result', (m) => {
        const text = clean(m.result.text)
        partial = ''
        if (text) said.push(text)
        if (stopping) return finish()
        if (said.length) { clearTimeout(settle); settle = setTimeout(finish, 1200) }
      })
    })
  } finally {
    processor.disconnect()
    source.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
    try { rec.remove() } catch {}
  }
}

// ── Escolha do caminho ───────────────────────────────────────────────────

export async function listenForNumber(signal: AbortSignal): Promise<{ texts: string[]; offline: boolean }> {
  const ready = offlineVoiceReady()
  if (navigator.onLine && hasBrowserVoice()) {
    try {
      return { texts: await listenBrowser(signal), offline: false }
    } catch (e) {
      // Sinal fraco: o navegador não alcança o servidor de voz; tenta a voz do celular
      if (!(e instanceof VoiceError && e.kind === 'sem-sinal' && ready)) throw e
    }
  }
  if (!ready) throw new VoiceError(hasBrowserVoice() || !navigator.onLine ? 'sem-sinal' : 'sem-suporte')
  return { texts: await listenOffline(signal), offline: true }
}
