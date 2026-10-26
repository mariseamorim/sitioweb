// Rebanho guardado no aparelho, para as telas abrirem a ficha, escolher a fêmea e anotar sem internet.
// Quem carrega /api/animals com sinal grava; quem abre sem sinal lê. A foto fica de fora (pesa).

const cacheKey = (farmId: string) => `animais_cache_${farmId}`

export function readHerdCache<T = Record<string, unknown>>(farmId: string): T[] {
  try {
    const list = JSON.parse(localStorage.getItem(cacheKey(farmId)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function writeHerdCache(farmId: string, list: { imageUrl?: string | null }[]) {
  try {
    localStorage.setItem(cacheKey(farmId), JSON.stringify(list.map((a) => ({ ...a, imageUrl: undefined }))))
  } catch {
    // Sem espaço ou sem localStorage: a tela continua funcionando com internet
  }
}
