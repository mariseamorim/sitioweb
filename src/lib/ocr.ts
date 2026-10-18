// OCR no aparelho com Tesseract (worker e núcleo servidos de /ocr, idioma português).
// Depois da primeira leitura com internet, o service worker guarda esses arquivos e a leitura funciona sem sinal.
import type { OcrWord } from '@/lib/folhaOcr'

export interface OcrResult {
  text: string
  words: OcrWord[]
  confidence: number
  /** Foto reduzida (JPEG) para guardar junto da coleta, como prova */
  photo: string
}

type Worker = {
  recognize: (image: HTMLCanvasElement, options?: object, output?: object) => Promise<{ data: { text: string; confidence: number; blocks?: { paragraphs: { lines: { words: { text: string; confidence: number }[] }[] }[] }[] | null } }>
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

/** Reduz a foto e realça o contraste: a folha lê melhor em preto e branco. Devolve o canvas e um JPEG pequeno para guardar. */
async function prepare(file: Blob, maxSide = 1800): Promise<{ canvas: HTMLCanvasElement; photo: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  // Cópia pequena para guardar (antes do contraste, para a pessoa ver a foto como tirou)
  const small = document.createElement('canvas')
  const s = Math.min(1, 1200 / Math.max(canvas.width, canvas.height))
  small.width = Math.round(canvas.width * s)
  small.height = Math.round(canvas.height * s)
  small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height)
  const photo = small.toDataURL('image/jpeg', 0.7)
  // Cinza com contraste
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const c = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128))
    d[i] = d[i + 1] = d[i + 2] = c
  }
  ctx.putImageData(img, 0, 0)
  bitmap.close()
  return { canvas, photo }
}

/** Lê a foto da folha. onProgress recebe 0 a 1 e o que está fazendo (carregando, lendo). */
export async function readFolha(file: Blob, onProgress: (fraction: number, status: string) => void): Promise<OcrResult> {
  const { canvas, photo } = await prepare(file)
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(canvas, {}, { blocks: true })
  const words: OcrWord[] = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, confidence: w.confidence })
  return { text: data.text, words, confidence: data.confidence, photo }
}

export const canReadFolha = () => typeof window !== 'undefined' && typeof createImageBitmap === 'function' && typeof Worker !== 'undefined'
