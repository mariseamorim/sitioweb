// Busca sem acento e sem maiúscula: "perola" acha "Pérola", "EDEN" acha "Éden".
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** O texto contém o que foi buscado (sem acento e sem maiúscula) */
export const matches = (text: string, query: string) => normalize(text).includes(normalize(query.trim()))
