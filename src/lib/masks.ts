// Máscaras dos campos enquanto a pessoa digita (telefone, CPF, CNPJ; no Paraguai, telefone +595, CI e RUC)

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

/**
 * Brasil: (35) 99999-0000 para celular, (35) 3333-0000 para fixo.
 * Paraguai: começando com +, com 595 ou com 0 → +595 981 123456 ou 0981 123456.
 */
export function maskPhone(value: string): string {
  const all = value.replace(/\D/g, '')
  if (value.trim().startsWith('+') || all.startsWith('595')) {
    const d = all.slice(0, 13)
    if (d.startsWith('595')) return ['+595', d.slice(3, 6), d.slice(6)].filter(Boolean).join(' ')
    return d ? `+${d}` : '+'
  }
  if (all.startsWith('0')) {
    const d = all.slice(0, 10)
    return [d.slice(0, 4), d.slice(4)].filter(Boolean).join(' ')
  }
  const d = digits(value, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const ddd = `(${d.slice(0, 2)}) `
  const rest = d.slice(2)
  const split = d.length === 11 ? 5 : 4
  return rest.length > split ? `${ddd}${rest.slice(0, split)}-${rest.slice(split)}` : ddd + rest
}

/** 000.000.000-00 */
export function maskCpf(value: string): string {
  const d = digits(value, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** 00.000.000/0000-00 */
export function maskCnpj(value: string): string {
  const d = digits(value, 14)
  return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** Paraguai, cédula de identidade: 1.234.567 */
export function maskCi(value: string): string {
  return digits(value, 9).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Paraguai, RUC: número + dígito verificador, 1234567-8 */
export function maskRuc(value: string): string {
  const d = digits(value, 10)
  return d.length > 1 ? `${d.slice(0, -1)}-${d.slice(-1)}` : d
}

/** CPF, CNPJ, CI ou RUC pelo tipo escolhido; sem tipo, CPF ou CNPJ pela quantidade de números */
export function maskDocument(value: string, type?: string): string {
  if (type === 'CPF') return maskCpf(value)
  if (type === 'CNPJ') return maskCnpj(value)
  if (type === 'CI') return maskCi(value)
  if (type === 'RUC') return maskRuc(value)
  return value.replace(/\D/g, '').length > 11 ? maskCnpj(value) : maskCpf(value)
}

export const DOCUMENT_PLACEHOLDER: Record<string, string> = { CPF: '000.000.000-00', CNPJ: '00.000.000/0000-00', CI: '1.234.567', RUC: '1234567-8' }
/** Tipos de documento aceitos (Brasil e Paraguai) */
export const DOCUMENT_TYPES = ['CNPJ', 'CPF', 'RUC', 'CI'] as const
