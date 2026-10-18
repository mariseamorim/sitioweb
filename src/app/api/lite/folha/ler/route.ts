import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { flattenVision, type VisionResponse } from '@/lib/vision'

// POST { photo }: lê a foto da folha na nuvem (Google Cloud Vision, que lê letra à mão). Devolve o texto e as
// palavras com a confiança, no mesmo formato do leitor do aparelho; a regra de extração é a mesma (src/lib/folhaOcr.ts).
// Precisa de GOOGLE_VISION_API_KEY no servidor. Sem a chave, responde 503 e o app usa o leitor do aparelho.
// Quando o Google recusa (API desligada, faturamento, chave restrita), responde 502 com o motivo em `detail`,
// que a tela mostra; sem resposta (rede, tempo), 504.
// A foto não é guardada aqui; quem guarda é a folha, quando a pessoa salva.

const MAX_PHOTO = 1500 * 1024

/** Mensagem de erro no formato do Google ({ error: { message } }) ou o começo do texto da resposta */
async function googleDetail(res: Response): Promise<string | null> {
  const text = await res.text().catch(() => '')
  try {
    const data = JSON.parse(text) as { error?: { message?: string; status?: string } }
    if (data.error?.message) return data.error.message
  } catch {}
  return text ? text.slice(0, 200) : null
}

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
    if (!res.ok) {
      const detail = await googleDetail(res)
      console.error(`[folha/ler] Vision respondeu ${res.status}: ${detail ?? 'sem detalhe'}`)
      return NextResponse.json({ error: 'O serviço de leitura recusou a chamada', detail, status: res.status }, { status: 502 })
    }
    body = (await res.json()) as VisionResponse
  } catch (e) {
    console.error('[folha/ler] Vision não respondeu:', (e as Error).message)
    return NextResponse.json({ error: 'O serviço de leitura não respondeu', detail: null }, { status: 504 })
  }
  const first = body.responses?.[0]
  if (first?.error) {
    console.error(`[folha/ler] Vision recusou a foto: ${first.error.message ?? 'sem detalhe'}`)
    return NextResponse.json({ error: 'O serviço de leitura recusou a foto', detail: first.error.message ?? null }, { status: 502 })
  }
  const { text, words } = flattenVision(first)
  return NextResponse.json({ text, words, engine: 'nuvem' })
}
