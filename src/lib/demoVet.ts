// Demonstração do veterinário consultor no site: cada visitante ganha uma conta própria de veterinário, sem login,
// com três propriedades fictícias (animais, coberturas, leite de 12 meses, vacinas), agenda, recibos e estoque.
// Tudo fica marcado com isDemo, não aparece nas listas do administrador e é apagado depois de 24 horas.
// O app Android tem a sua própria demonstração, só no aparelho (mobile/src/demo).
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { newInviteCode } from '@/lib/vendors'
import { VET_MODULES } from '@/lib/vets'

const DAY = 86_400_000
const GESTATION = 283
/** Quanto tempo a demonstração dura */
export const DEMO_HOURS = 24
/** Limite de demonstrações ao mesmo tempo: acima disso as mais antigas saem antes do prazo */
const MAX_ACTIVE = 300

const FARMS = [
  { name: 'Estancia San José', owner: 'Ramón Benítez', city: 'Caaguazú', state: 'Caaguazú', cows: 14 },
  { name: 'Sítio Boa Vista', owner: 'João Pereira', city: 'Patos de Minas', state: 'MG', cows: 9 },
  { name: 'Fazenda Santa Luzia', owner: 'Maria Aparecida Souza', city: 'Uberlândia', state: 'MG', cows: 12 },
]
const COW_NAMES = ['Mimosa', 'Estrela', 'Princesa', 'Jóia', 'Pintada', 'Malhada', 'Serena', 'Bonita', 'Flor', 'Graúna', 'Lua', 'Pérola', 'Cigana', 'Duquesa', 'Morena', 'Faceira', 'Brisa', 'Canela']
const CALF_NAMES = ['Aurora', 'Bela', 'Chica', 'Dalila', 'Esmeralda', 'Fofa', 'Gaia', 'Hortência']
const BULLS = ['Gir Leiteiro — Sansão', 'Holandês — Atlas', 'Girolando — Trovão']

/** Meia-noite UTC do dia (as datas do sistema são gravadas assim). */
const dayStart = (ms: number) => new Date(Math.floor(ms / DAY) * DAY)

/** Gerador simples e repetível (todas as demonstrações começam iguais). */
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

/** Apaga demonstrações vencidas (e as mais antigas, se passar do limite). Falha aqui não impede a nova demonstração. */
export async function cleanupDemos() {
  try {
    const cutoff = new Date(Date.now() - DEMO_HOURS * 3600_000)
    const extra = await prisma.user.findMany({ where: { isDemo: true, createdAt: { gte: cutoff } }, orderBy: { createdAt: 'desc' }, skip: MAX_ACTIVE, select: { id: true } })
    const users = await prisma.user.findMany({ where: { isDemo: true, OR: [{ createdAt: { lt: cutoff } }, { id: { in: extra.map((u) => u.id) } }] }, select: { id: true } })
    if (!users.length) {
      await prisma.farm.deleteMany({ where: { isDemo: true, createdAt: { lt: cutoff } } })
      return
    }
    const ids = users.map((u) => u.id)
    // As propriedades da demonstração são só desses veterinários; apagar a propriedade apaga animais, leite e coberturas
    await prisma.farm.deleteMany({ where: { isDemo: true, OR: [{ members: { some: { userId: { in: ids } } } }, { createdAt: { lt: cutoff } }] } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  } catch (e) {
    console.error('[demo] limpeza falhou', e)
  }
}

/** Cria a conta de demonstração e devolve o id da pessoa. */
export async function createDemoVet(): Promise<string> {
  const now = Date.now()
  const ago = (days: number) => dayStart(now - days * DAY)
  const ahead = (days: number) => dayStart(now + days * DAY)
  const rand = rng(42)

  const userId = randomUUID()
  const farmIds = FARMS.map(() => randomUUID())
  await prisma.user.create({
    data: {
      id: userId, name: 'Dra. Ana Demonstração', role: 'editor', permissions: [...VET_MODULES], isDemo: true, farmId: null,
      vetProfile: { create: { crmv: 'CRMV-DEMO 0000', city: 'Patos de Minas', state: 'MG', inviteCode: newInviteCode() } },
    },
  })
  const vet = await prisma.vetProfile.findUniqueOrThrow({ where: { userId } })

  const animals: Prisma.AnimalCreateManyInput[] = []
  const reproductions: Prisma.ReproductionCreateManyInput[] = []
  const milk: Prisma.MilkProductionCreateManyInput[] = []
  const vaccinations: Prisma.VaccinationCreateManyInput[] = []

  FARMS.forEach((farm, fi) => {
    const farmId = farmIds[fi]
    let code = 100
    const animal = (row: Omit<Prisma.AnimalCreateManyInput, 'id' | 'code' | 'farmId' | 'status'> & { status?: string }) => {
      const id = randomUUID()
      animals.push({ id, code: String(++code), farmId, status: 'Vivo', acquisitionType: 'nascimento', ...row })
      return id
    }
    const coverage = (row: Omit<Prisma.ReproductionCreateManyInput, 'farmId'>) => {
      const diagnosed = row.status === 'Prenha' || row.status === 'Vazia'
      reproductions.push({
        farmId, method: 'iatf', maleName: BULLS[fi % BULLS.length], semenBatch: `L${2400 + fi}`, inseminator: 'Dra. Ana',
        createdById: userId, ...(diagnosed ? { diagnosedById: userId, diagnosedAt: dayStart(Date.parse(String(row.coverageDate)) + 35 * DAY) } : {}), ...row,
      })
    }

    animal({ name: 'Touro Sultão', species: 'Touro', gender: 'Macho', birthDate: ago(6 * 365) })
    for (let i = 0; i < farm.cows; i++) {
      const name = COW_NAMES[(i + fi * 5) % COW_NAMES.length]
      const cow = animal({ name, species: 'Vaca', gender: 'Fêmea', birthDate: ago((4 + Math.floor(rand() * 5)) * 365 + Math.floor(rand() * 200)) })
      // Dois partos anotados (intervalo entre partos e idade ao primeiro parto)
      const lastCalving = 60 + Math.floor(rand() * 340)
      const interval = 380 + Math.floor(rand() * 120)
      const firstFemale = rand() > 0.5
      animal({ name: `Cria de ${name}`, species: firstFemale ? 'Bezerra' : 'Bezerro', gender: firstFemale ? 'Fêmea' : 'Macho', birthDate: ago(lastCalving + interval), motherId: cow, status: 'Vendido', lowDate: ago(lastCalving), lowReason: 'Venda' })
      const female = rand() > 0.45
      const calf = animal({ name: female ? CALF_NAMES[(i + fi) % CALF_NAMES.length] : `Bezerro ${code + 1}`, species: female ? 'Bezerra' : 'Bezerro', gender: female ? 'Fêmea' : 'Macho', birthDate: ago(lastCalving), motherId: cow })
      coverage({ femaleId: cow, coverageDate: ago(lastCalving + GESTATION), expectedBirthDate: ago(lastCalving), actualBirthDate: ago(lastCalving), status: 'Parida', calfId: calf })

      // Situação atual: uma de cada tipo, para todas as telas terem o que mostrar
      switch (i % 6) {
        case 0:
          coverage({ femaleId: cow, coverageDate: ago(225), expectedBirthDate: ago(225 - GESTATION), status: 'Vazia' })
          coverage({ femaleId: cow, coverageDate: ago(200), expectedBirthDate: ahead(GESTATION - 200), status: 'Prenha' })
          break
        case 1: { // parto em menos de 30 dias
          const d = 262 + (i % 3) * 4
          coverage({ femaleId: cow, coverageDate: ago(d), expectedBirthDate: ahead(GESTATION - d), status: 'Prenha' })
          break
        }
        case 2: { // coberta há mais de 28 dias: falta o diagnóstico
          const d = 32 + (i % 4) * 5
          coverage({ femaleId: cow, coverageDate: ago(d), expectedBirthDate: ahead(GESTATION - d), status: 'Coberta' })
          break
        }
        case 3: { // coberta há poucos dias
          const d = 8 + (i % 3)
          coverage({ femaleId: cow, coverageDate: ago(d), expectedBirthDate: ahead(GESTATION - d), status: 'Coberta', method: 'natural', maleName: 'Touro Sultão', semenBatch: null, inseminator: null })
          break
        }
        case 4:
          coverage({ femaleId: cow, coverageDate: ago(75), expectedBirthDate: ahead(GESTATION - 75), status: 'Vazia', method: 'ia' })
          break
        default:
          coverage({ femaleId: cow, coverageDate: ago(120), expectedBirthDate: ahead(GESTATION - 120), status: 'Prenha', method: 'ia' })
      }

      vaccinations.push({ animalId: cow, vaccineName: 'Febre aftosa', scheduledDate: ago(150), appliedDate: ago(150), batch: 'AF-2291', manufacturer: 'Ourofino' })
      if (i % 3 === 0) vaccinations.push({ animalId: cow, vaccineName: 'Brucelose (reforço)', scheduledDate: ahead(10 + i) })
    }
    for (let i = 0; i < 3; i++) {
      const heifer = animal({ name: `${CALF_NAMES[(i + 3 + fi) % CALF_NAMES.length]} II`, species: 'Bezerra', gender: 'Fêmea', birthDate: ago(480 + i * 40) })
      if (i === 0) coverage({ femaleId: heifer, coverageDate: ago(40), expectedBirthDate: ahead(GESTATION - 40), status: 'Coberta' })
    }
    // Leite do rebanho, todo dia nos últimos 12 meses (seca e águas)
    const cows = Math.round(farm.cows * 0.7)
    for (let d = 1; d <= 365; d++) {
      const date = ago(d)
      const season = 1 + 0.18 * Math.cos(((date.getUTCMonth() - 1) / 12) * 2 * Math.PI)
      milk.push({ farmId, date, quantity: Math.round(cows * (11 + fi * 2) * season * (0.92 + rand() * 0.16)), cowsMilked: cows, pricePerLiter: 2.6 })
    }
  })

  const clientIds = FARMS.map(() => randomUUID())
  await prisma.$transaction([
    prisma.farm.createMany({ data: FARMS.map((f, i) => ({ id: farmIds[i], name: f.name, propertyType: 'Fazenda', owner: f.owner, city: f.city, state: f.state, segments: ['leite'], isDemo: true, milkPrice: 2.6 })) }),
    prisma.farmMember.createMany({ data: farmIds.map((farmId) => ({ userId, farmId })) }),
    prisma.vetClient.createMany({ data: FARMS.map((f, i) => ({ id: clientIds[i], vetId: vet.id, farmId: farmIds[i], farmName: f.name, createdByVet: true })) }),
    prisma.animal.createMany({ data: animals }),
    prisma.reproduction.createMany({ data: reproductions }),
    prisma.vaccination.createMany({ data: vaccinations }),
    prisma.milkProduction.createMany({ data: milk }),
    prisma.vetVisit.createMany({
      data: [
        { vetId: vet.id, clientId: clientIds[0], farmName: FARMS[0].name, date: ahead(2), time: '07:30', purpose: 'Diagnóstico de gestação' },
        { vetId: vet.id, clientId: clientIds[2], farmName: FARMS[2].name, date: ahead(6), time: '08:00', purpose: 'IATF — lote de vacas paridas' },
        { vetId: vet.id, clientId: clientIds[1], farmName: FARMS[1].name, date: ahead(13), time: '14:00', purpose: 'Exame de novilhas' },
        { vetId: vet.id, clientId: clientIds[0], farmName: FARMS[0].name, date: ago(14), time: '07:00', purpose: 'Diagnóstico de gestação', status: 'realizada', notes: 'Separar as vazias para o protocolo de IATF da próxima semana. Reforçar mineral no lote de paridas.' },
      ],
    }),
    prisma.vetReceipt.createMany({
      data: [
        { vetId: vet.id, number: 1, payer: FARMS[0].owner, farmName: FARMS[0].name, date: ago(14), description: 'Visita técnica e diagnóstico de gestação (14 vacas)', amount: 450 },
        { vetId: vet.id, number: 2, payer: FARMS[2].owner, farmName: FARMS[2].name, date: ago(5), description: 'Protocolo de IATF — 6 vacas', amount: 780 },
      ],
    }),
    prisma.user.update({ where: { id: userId }, data: { farmId: farmIds[0] } }),
  ])

  // Estoque do veterinário, com entradas e saídas
  const supplies = [
    { name: 'Sêmen Gir Leiteiro — Sansão', unit: 'dose', quantity: 18, minimum: 10, expiry: null as Date | null },
    { name: 'Implante de progesterona', unit: 'un', quantity: 4, minimum: 6, expiry: ahead(120) },
    { name: 'Benzoato de estradiol', unit: 'ml', quantity: 60, minimum: 20, expiry: ahead(20) },
    { name: 'Luvas de palpação', unit: 'cx', quantity: 3, minimum: 1, expiry: null },
  ]
  for (const s of supplies) {
    await prisma.vetSupply.create({
      data: {
        vetId: vet.id, ...s,
        moves: { create: [
          { type: 'entrada', quantity: s.quantity + 6, date: ago(30), note: 'Compra' },
          { type: 'saida', quantity: 6, date: ago(5), farmName: FARMS[2].name, note: 'IATF' },
        ] },
      },
    })
  }
  return userId
}
