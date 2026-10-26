import { prisma } from '@/lib/prisma'

// Recria por animal: o que a tela recebe de cada animal acompanhado

export const REARING_SELECT = {
  id: true, code: true, customCode: true, name: true, gender: true, species: true, birthDate: true, status: true, lotId: true,
  isCastrated: true, rearingStart: true, rearingEnd: true, rearingTarget: true,
  weighings: { select: { id: true, date: true, weight: true, lotWeighingId: true }, orderBy: { date: 'asc' as const } },
  reproductions: {
    select: { id: true, heatDate: true, method: true, coverageDate: true, expectedBirthDate: true, semenBatch: true, bullRegistry: true, inseminator: true, maleName: true, status: true },
    orderBy: { coverageDate: 'desc' as const }, take: 1,
  },
}

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

export function serializeRearing(a: {
  birthDate: Date; rearingStart: Date | null; rearingEnd: Date | null
  weighings: { date: Date }[]
  reproductions: { heatDate: Date | null; coverageDate: Date; expectedBirthDate: Date | null }[]
}) {
  return {
    ...a,
    birthDate: isoDay(a.birthDate),
    rearingStart: isoDay(a.rearingStart),
    rearingEnd: isoDay(a.rearingEnd),
    weighings: a.weighings.map((w) => ({ ...w, date: isoDay(w.date) })),
    reproductions: a.reproductions.map((r) => ({ ...r, heatDate: isoDay(r.heatDate), coverageDate: isoDay(r.coverageDate), expectedBirthDate: isoDay(r.expectedBirthDate) })),
  }
}

export async function rearingAnimal(id: string) {
  return serializeRearing(await prisma.animal.findUniqueOrThrow({ where: { id }, select: REARING_SELECT }))
}

/** kg opcional (vírgula ou ponto): undefined se vazio, null se inválido */
export function optionalKg(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 2000 ? Math.round(n * 10) / 10 : null
}
