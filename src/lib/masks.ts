// Máscaras dos campos enquanto a pessoa digita (telefone, CPF e CNPJ)

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

/** (35) 99999-0000 para celular, (35) 3333-0000 para fixo */
export function maskPhone(value: string): string {
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

/** CPF ou CNPJ: pelo tipo escolhido ou, sem tipo, pela quantidade de números */
export function maskDocument(value: string, type?: string): string {
  if (type === 'CPF') return maskCpf(value)
  if (type === 'CNPJ') return maskCnpj(value)
  return value.replace(/\D/g, '').length > 11 ? maskCnpj(value) : maskCpf(value)
}

export const DOCUMENT_PLACEHOLDER: Record<string, string> = { CPF: '000.000.000-00', CNPJ: '00.000.000/0000-00' }
