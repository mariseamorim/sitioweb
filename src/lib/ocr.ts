// Leitura da foto da folha.
// Com internet: na nuvem (Google Vision, pela rota /api/lite/folha/ler), que lê letra à mão.
// Sem internet, ou sem a nuvem configurada: Tesseract no aparelho (worker e núcleo servidos de /ocr, português),
// que lê bem o impresso (nomes e códigos) mas quase nunca os números escritos à mão.
import type { OcrWord } from '@/lib/folhaOcr'

export type OcrEngine = 'nuvem' | 'aparelho'

/** Por que a leitura na nuvem não aconteceu, para a tela dizer o que fazer */
export type CloudErrorReason = 'sem-chave' | 'recusada' | 'rede' | 'login' | 'foto'
export interface CloudError { reason: CloudErrorReason; detail: string | null }

export interface OcrResult {
  text: string
  words: OcrWord[]
  confidence: number
  engine: OcrEngine
  /** Preenchido quando a leitura caiu para o aparelho por falha da nuvem (com internet) */
  cloudError: CloudError | null
  /** Foto reduzida (JPEG) para guardar junto da coleta, como prova */
  photo: string
}

type Worker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>
  recognize: (image: HTMLCanvasElement | string, options?: object, output?: object) => Promise<{ data: { text: string; confidence: number; blocks?: { paragraphs: { lines: { words: { text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] | null } }>
  terminate: () => Promise<void>
}

let workerPromise: Promise<Worker> | null = null

async function getWorker(onProgress: (fraction: number, status: string) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('por', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr',
        logger: (m: { status: string; progress: number }) => onProgress(m.progress ?? 0, m.status ?? ''),
      })
      return worker as unknown as Worker
    })().catch((e) => { workerPromise = null; throw e })
  }
  return workerPromise
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  // imageOrientation: respeita a rotação que o celular grava na foto
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions) } catch { return createImageBitmap(file) }
}

function draw(bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Foto para guardar e mandar à nuvem (JPEG, lado maior 1600 px) e, se precisar, a versão para o leitor do aparelho */
export async function preparePhoto(file: Blob): Promise<{ photo: string; bitmap: ImageBitmap }> {
  const bitmap = await loadBitmap(file)
  const photo = draw(bitmap, 1600).toDataURL('image/jpeg', 0.8)
  return { photo, bitmap }
}

/** Leitor do aparelho: cinza com contraste, lado maior 2600 px */
function prepareLocal(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = draw(bitmap, 2600)
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (g < min) min = g; if (g > max) max = g }
  const range = Math.max(1, max - min)
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const c = Math.max(0, Math.min(255, ((g - min) / range) * 255))
    d[i] = d[i + 1] = d[i + 2] = c
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** O que a rota de leitura respondeu, traduzido para a tela */
export function cloudErrorFrom(status: number, data: { error?: string; detail?: string | null }): CloudError {
  const reason: CloudErrorReason = status === 503 ? 'sem-chave' : status === 401 ? 'login' : status === 400 ? 'foto' : status === 504 ? 'rede' : 'recusada'
  return { reason, detail: data.detail ?? null }
}

/** Mensagem para quem está na tela quando a leitura caiu para o aparelho */
export function cloudErrorMessage(err: CloudError | null, online: boolean): string {
  const aparelho = 'O aparelho lê o impresso, mas quase nunca os números escritos à mão.'
  if (!online) return `Sem internet: o aparelho lê o impresso, mas quase nunca os números escritos à mão. Com sinal, a leitura é feita na nuvem e acerta a letra à mão.`
  switch (err?.reason) {
    case 'sem-chave': return `A leitura na nuvem não está configurada neste sistema (falta a chave GOOGLE_VISION_API_KEY no servidor). ${aparelho}`
    case 'recusada': return `O Google recusou a leitura na nuvem${err.detail ? `: "${err.detail}"` : ''}. Confira no Google Cloud se a Cloud Vision API está ativada, se o faturamento do projeto está ligado e se a chave não tem restrição de site. ${aparelho}`
    case 'rede': return `A leitura na nuvem não respondeu (sinal fraco ou tempo esgotado). Tente de novo. ${aparelho}`
    case 'login': return `Entre de novo no app para usar a leitura na nuvem. ${aparelho}`
    case 'foto': return `A foto não serviu para a leitura na nuvem${err.detail ? ` (${err.detail})` : ''}. Tire outra, mais de perto. ${aparelho}`
    default: return `A leitura foi feita no aparelho. ${aparelho}`
  }
}

async function readCloud(photo: string): Promise<{ text: string; words: OcrWord[] } | CloudError> {
  try {
    const res = await fetch('/api/lite/folha/ler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photo }) })
    const data = (await res.json().catch(() => ({}))) as { text?: string; words?: OcrWord[]; error?: string; detail?: string | null }
    if (!res.ok) return cloudErrorFrom(res.status, data)
    return typeof data.text === 'string' ? { text: data.text, words: data.words ?? [] } : { reason: 'recusada', detail: 'resposta sem texto' }
  } catch {
    return { reason: 'rede', detail: null }
  }
}

/** Lê a foto da folha. onProgress recebe 0 a 1 e o que está fazendo. Tenta a nuvem com internet; senão, o aparelho. */
export async function readFolha(file: Blob, onProgress: (fraction: number, status: string) => void, { cloud = true } = {}): Promise<OcrResult> {
  const { photo, bitmap } = await preparePhoto(file)
  let cloudError: CloudError | null = null
  if (cloud && navigator.onLine) {
    onProgress(0.3, 'nuvem')
    const result = await readCloud(photo)
    if ('text' in result) { bitmap.close(); return { ...result, confidence: 0, engine: 'nuvem', cloudError: null, photo } }
    cloudError = result
  }
  const canvas = prepareLocal(bitmap)
  bitmap.close()
  const worker = await getWorker(onProgress)
  await worker.setParameters({ tessedit_pageseg_mode: '3' })
  const { data } = await worker.recognize(canvas, {}, { blocks: true })
  const words: OcrWord[] = []
  // A posição (bbox) deixa a regra da folha remontar as linhas: número à mão ao lado do nome
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, confidence: w.confidence, ...(w.bbox ? { box: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } } : {}) })
  return { text: data.text, words, confidence: data.confidence, engine: 'aparelho', cloudError, photo }
}

export const canReadFolha = () => typeof window !== 'undefined' && typeof createImageBitmap === 'function' && typeof Worker !== 'undefined'
