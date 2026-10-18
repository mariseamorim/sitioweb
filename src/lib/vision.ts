// Resposta do Google Cloud Vision (DOCUMENT_TEXT_DETECTION) convertida para o formato do leitor da folha:
// texto com quebras de linha e palavras com confiança de 0 a 100. Sem rede e sem banco.

export interface VisionWord { text: string; confidence: number }

export interface VisionResponse {
  responses?: VisionResult[]
}

export interface VisionResult {
  error?: { message?: string }
  fullTextAnnotation?: {
    text?: string
    pages?: { blocks?: { paragraphs?: { words?: { confidence?: number; symbols?: { text?: string; property?: { detectedBreak?: { type?: string } } }[] }[] }[] }[] }[]
  }
}

export const visionEnabled = () => !!process.env.GOOGLE_VISION_API_KEY

/** Texto com quebras de linha (pelos "breaks" do Vision) e palavras com confiança de 0 a 100 */
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
          if (wordText) words.push({ text: wordText, confidence: Math.round((word.confidence ?? 0) * 100) })
          text += wordText + after
        }
        if (!text.endsWith('\n')) text += '\n'
      }
    }
  }
  return { text: text || r?.fullTextAnnotation?.text || '', words }
}
