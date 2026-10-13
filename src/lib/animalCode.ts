// Códigos do animal: `code` é o número automático da propriedade; `customCode` é o código do produtor
// (brinco, SISBOV...), opcional. O id do banco nunca aparece na tela.

export function cleanCustomCode(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim().slice(0, 40) : ''
  return text || null
}

/** "12" ou "12 · BR-4471" */
export function animalCodes(a: { code: string; customCode?: string | null }) {
  return a.customCode ? `${a.code} · ${a.customCode}` : a.code
}

/** Texto usado na busca: nome, código e outro código */
export function animalSearchText(a: { code: string; name: string; customCode?: string | null }) {
  return `${a.name} ${a.code} ${a.customCode ?? ''}`.toLocaleLowerCase('pt-BR')
}

/** Erro de repetição: qual dos códigos já existe na propriedade */
export function duplicateCodeMessage(error: unknown): string | null {
  const e = error as { code?: string; meta?: { target?: string[] | string } }
  if (e.code !== 'P2002') return null
  const target = String(e.meta?.target ?? '')
  return target.includes('customCode')
    ? 'Já existe um animal com esse outro código nesta propriedade'
    : 'Já existe um animal com esse código nesta propriedade'
}
