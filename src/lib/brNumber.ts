// Número digitado do jeito que a pessoa escreve: "1.500,00", "1500,5", "1500.50", "R$ 450" ou "1.500".
// Com vírgula, ela é o decimal e os pontos são milhar. Sem vírgula, "1.500" e "12.000.000" são milhar;
// qualquer outro ponto é decimal ("12.5"). Vazio ou inválido: NaN.
export function parseBrNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/[R$\s]/g, '')
  if (!text) return NaN
  if (text.includes(',')) return Number(text.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''))
  return Number(text)
}

/** O que o campo aceita enquanto a pessoa digita: algarismos, ponto, vírgula e espaço */
export const keepNumberChars = (value: string) => value.replace(/[^\d.,\s]/g, '')
