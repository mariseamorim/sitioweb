import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

// POST { photo }: lê a foto da folha na nuvem (Google Cloud Vision, que lê letra à mão). Devolve o texto e as
// palavras com a confiança, no mesmo formato do leitor do aparelho; a regra de extração é a mesma (src/lib/folhaOcr.ts).
// Precisa de GOOGLE_VISION_API_KEY no servidor. Sem a chave, responde 503 e o app usa o leitor do aparelho.
// A foto não é guardada aqui; quem guarda é a folha, quando a pessoa salva.

const MAX_PHOTO = 1500 * 1024

export const visionEnabled = () => !!process.env.GOOGLE_VISION_API_KEY

interface VisionWord { text: string; confidence: number }

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key) return NextResponse.json({ error: 'Leitura na nuvem não configurada' }, { status: 503 })

  const { photo } = (await request.json().catch(() => ({}))) as { photo?: string }
  if (typeof photo !== 'string' || !photo.startsWith('data:image/jpeg;base64,') || photo.length > MAX_PHOTO) {
    return NextResponse.json({ error: 'Foto inválida ou grande demais' }, { status: 400 })
  }
  const content = photo.slice(photo.indexOf(',') + 1)

  let body: VisionResponse
  try {
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['pt'] } }] }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) return NextResponse.json({ error: 'O serviço de leitura não respondeu' }, { status: 502 })
    body = (await res.json()) as VisionResponse
  } catch {
    return NextResponse.json({ error: 'O serviço de leitura não respondeu' }, { status: 502 })
  }
  const first = body.responses?.[0]
  if (first?.error) return NextResponse.json({ error: 'O serviço de leitura recusou a foto' }, { status: 502 })
  const { text, words } = flatten(first)
  return NextResponse.json({ text, words, engine: 'nuvem' })
}

interface VisionResponse {
  responses?: {
    error?: { message?: string }
    fullTextAnnotation?: { text?: string; pages?: { blocks?: { paragraphs?: { words?: { confidence?: number; symbols?: { text?: string; property?: { detectedBreak?: { type?: string } } }[] }[] }[] }[] }[] }
  }[]
}

type VisionResult = NonNullable<VisionResponse['responses']>[number]

/** Texto com quebras de linha (pelos "breaks" do Vision) e palavras com confiança de 0 a 100 */
export function flatten(r: VisionResult | undefined): { text: string; words: VisionWord[] } {
  const words: VisionWord[] = []
  let text = ''
  for (const page of r?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          let wordText = ''
          let after = ''
          for (const symbol of word.symbols ?? []) {
            wordText += symbol.text ?? ''
            const brk = symbol.property?.detectedBreak?.type
            if (brk === 'SPACE' || brk === 'SURE_SPACE') after = ' '
            else if (brk === 'EOL_SURE_SPACE' || brk === 'LINE_BREAK') after = '\n'
          }
          if (wordText) words.push({ text: wordText, confidence: Math.round((word.confidence ?? 0) * 100) })
          text += wordText + after
        }
        if (!text.endsWith('\n')) text += '\n'
      }
    }
  }
  return { text: text || r?.fullTextAnnotation?.text || '', words }
}
