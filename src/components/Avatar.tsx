'use client'

// Avatar do usuário: a foto, ou um círculo colorido com as iniciais ("Marise Amorim" → "MA") quando não há foto.

/** Iniciais do nome: primeira e última palavra (ignora "de", "da", "dos"...) */
export function initials(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/)
    .filter((p) => !/^(dr|dra|sr|sra|prof|profa|eng|vet)\.?$/i.test(p))
    .filter((p) => p.length > 2 || p === p.toUpperCase())
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

// A cor do círculo vem do nome: cada pessoa sempre com a mesma cor
const COLORS = ['from-green-600 to-teal-500', 'from-blue-700 to-sky-500', 'from-orange-500 to-amber-400', 'from-violet-600 to-fuchsia-500', 'from-rose-600 to-pink-400', 'from-teal-600 to-cyan-500']
const colorOf = (name: string) => COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length]

export function Avatar({ name, src, size = 36, className = '' }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden="true" style={style} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`} />
  }
  return (
    <span aria-hidden="true" style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ${colorOf(name)} ${className}`}>
      {initials(name)}
    </span>
  )
}

/** Foto escolhida → quadrado de 256 px, cortado no centro, em JPEG (fica leve para guardar no cadastro) */
export function squareAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir essa foto')) }
    img.src = url
  })
}
