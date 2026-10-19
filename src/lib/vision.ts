// Resposta do Google Cloud Vision (DOCUMENT_TEXT_DETECTION) convertida para o formato do leitor da folha:
// texto com quebras de linha e palavras com confiança de 0 a 100 e a posição na foto. Sem rede e sem banco.

export interface VisionWord { text: string; confidence: number; box?: { x0: number; y0: number; x1: number; y1: number } }

export interface VisionResponse {
  responses?: VisionResult[]
}

interface Vertex { x?: number; y?: number }
interface VisionSymbol { text?: string; property?: { detectedBreak?: { type?: string } } }
interface VisionWordRaw { confidence?: number; symbols?: VisionSymbol[]; boundingBox?: { vertices?: Vertex[]; normalizedVertices?: Vertex[] } }

export interface VisionResult {
  error?: { message?: string }
  fullTextAnnotation?: {
    text?: string
    pages?: { blocks?: { paragraphs?: { words?: VisionWordRaw[] }[] }[] }[]
  }
}

export const visionEnabled = () => !!process.env.GOOGLE_VISION_API_KEY

/** Retângulo da palavra na foto (vértices podem omitir x ou y quando valem 0) */
function boxOf(word: VisionWordRaw): VisionWord['box'] | undefined {
  const vertices = word.boundingBox?.vertices?.length ? word.boundingBox.vertices : word.boundingBox?.normalizedVertices
  if (!vertices?.length) return undefined
  const xs = vertices.map((v) => v.x ?? 0), ys = vertices.map((v) => v.y ?? 0)
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Texto com quebras de linha (pelos "breaks" do Vision) e palavras com confiança de 0 a 100 e posição */
export function flattenVision(r: VisionResult | undefined): { text: string; words: VisionWord[] } {
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
          if (wordText) {
            const box = boxOf(word)
            words.push({ text: wordText, confidence: Math.round((word.confidence ?? 0) * 100), ...(box ? { box } : {}) })
          }
          text += wordText + after
        }
        if (!text.endsWith('\n')) text += '\n'
      }
    }
  }
  return { text: text || r?.fullTextAnnotation?.text || '', words }
}
