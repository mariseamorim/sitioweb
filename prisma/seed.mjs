// Dados de demonstração.
// Uso: SEED_DEMO=1 DATABASE_URL="postgres://..." node prisma/seed.mjs
// Pode rodar mais de uma vez: contas que já existem são mantidas como estão.
//
// Opções:
//   SEED_PASSWORD=...  senha de todas as contas (obrigatória fora de um banco local de teste)
//   SEED_ADMIN=1       cria também admin@demo.com (por padrão não cria)
import { PrismaClient } from '@prisma/client'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'

if (process.env.SEED_DEMO !== '1') {
  console.error('Seed de demonstração bloqueado. Rode com SEED_DEMO=1 e apontando para um banco de teste.')
  process.exit(1)
}

const prisma = new PrismaClient()
const scryptAsync = promisify(scrypt)
const ALL_MODULES = ['animais', 'leite', 'veterinario', 'vacinacao', 'reproducao', 'financeiro', 'estoque', 'fazendas', 'usuarios']
const PASSWORD = process.env.SEED_PASSWORD || 'demo1234'
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')
if (!process.env.SEED_PASSWORD && !isLocal) {
  console.error('Banco remoto: defina SEED_PASSWORD com uma senha forte (as contas de demonstração não podem usar senha conhecida).')
  process.exit(1)
}
if (PASSWORD.length < 8) {
  console.error('SEED_PASSWORD precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

/** Mesmo formato de src/lib/auth.ts (scrypt$salt$hash) */
async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Dia N em relação a hoje (horário de Brasília), como meia-noite UTC: o formato em que as datas são gravadas */
function day(offset) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

const exists = async (email) => !!(await prisma.user.findUnique({ where: { email }, select: { id: true } }))

async function createUser(data) {
  const user = await prisma.user.create({ data: { ...data, password: await hashPassword(data.password ?? PASSWORD) } })
  // Quem tem propriedade também a tem na lista de propriedades (várias por conta)
  if (data.farmId && data.role !== 'admin') await prisma.farmMember.create({ data: { userId: user.id, farmId: data.farmId } })
  return user
}

// ── Admin ───────────────────────────────────────────────────────────────

async function seedAdmin() {
  if (process.env.SEED_ADMIN !== '1' || (await exists('admin@demo.com'))) return
  await createUser({ name: 'Administrador', email: 'admin@demo.com', role: 'admin', password: process.env.SEED_PASSWORD ? PASSWORD : 'admin1234' })
}

// ── Produtor da versão completa (Sítio Boa Vista) ───────────────────────

async function seedProdutor() {
  if (await exists('produtor@demo.com')) return prisma.user.findUnique({ where: { email: 'produtor@demo.com' } })

  const farm = await prisma.farm.create({
    data: { name: 'Sítio Boa Vista', propertyType: 'Sítio', owner: 'João Produtor', phone: '(35) 99999-1111', city: 'Lavras', state: 'MG', milkPrice: 2.5 },
  })
  const owner = await createUser({ name: 'João Produtor', email: 'produtor@demo.com', role: 'editor', permissions: ALL_MODULES, farmId: farm.id })
  await createUser({ name: 'Carlos Gerente', email: 'gerente@demo.com', role: 'editor', permissions: ['usuarios', 'leite', 'animais'], farmId: farm.id })
  await createUser({ name: 'Ana Leitora', email: 'leitor@demo.com', role: 'viewer', permissions: ['leite', 'animais'], farmId: farm.id })

  const cows = []
  for (const [code, name, born] of [['07', 'Mimosa', '2019-04-10'], ['12', 'Estrela', '2020-02-21'], ['15', 'Malhada', '2018-11-03'], ['21', 'Pintada', '2021-07-15']]) {
    cows.push(await prisma.animal.create({ data: { farmId: farm.id, code, name, species: 'Vaca', gender: 'Fêmea', birthDate: new Date(born), status: 'Vivo' } }))
  }
  await prisma.animal.create({ data: { farmId: farm.id, code: '30', name: 'Trovão', species: 'Touro', gender: 'Macho', birthDate: new Date('2017-09-01'), status: 'Vivo' } })
  await prisma.animal.create({ data: { farmId: farm.id, code: '41', name: 'Faísca', species: 'Bezerro', gender: 'Macho', birthDate: day(-60), status: 'Vivo' } })

  // 14 dias de leite por vaca (sem o dia de hoje, para o sino pedir a ordenha)
  const milk = []
  for (let n = 1; n <= 14; n++) {
    cows.forEach((cow, i) => milk.push({ farmId: farm.id, animalId: cow.id, date: day(-n), quantity: Math.round((12 + i * 2.5 + (n % 4) * 0.5) * 10) / 10 }))
  }
  await prisma.milkProduction.createMany({ data: milk })

  await prisma.vaccination.createMany({
    data: [
      { animalId: cows[1].id, vaccineName: 'Brucelose', scheduledDate: day(-3) },
      { animalId: cows[0].id, vaccineName: 'Aftosa', scheduledDate: day(4) },
      { animalId: cows[2].id, vaccineName: 'Raiva', scheduledDate: day(-20), appliedDate: day(-20), batch: 'L123', manufacturer: 'Vallée' },
    ],
  })
  const coverage = day(-276)
  const expected = new Date(coverage); expected.setUTCDate(expected.getUTCDate() + 280)
  await prisma.reproduction.create({ data: { farmId: farm.id, femaleId: cows[3].id, maleName: 'Trovão', coverageDate: coverage, expectedBirthDate: expected } })
  await prisma.veterinaryTreatment.create({ data: { animalId: cows[2].id, startDate: day(-2), endDate: day(3), medicine: 'Antibiótico para mastite' } })

  const racao = await prisma.supply.create({ data: { farmId: farm.id, name: 'Ração lactação', category: 'Ração', unit: 'kg', currentQuantity: 40, minimumQuantity: 100 } })
  await prisma.supplyMovement.create({ data: { supplyId: racao.id, type: 'Saída', quantity: 15, date: day(-1), description: 'Trato da semana' } })
  await prisma.supply.create({ data: { farmId: farm.id, name: 'Sal mineral', category: 'Sal mineral', unit: 'kg', currentQuantity: 15, minimumQuantity: 30 } })
  await prisma.supply.create({ data: { farmId: farm.id, name: 'Vermífugo', category: 'Medicamento', unit: 'ml', currentQuantity: 500, minimumQuantity: 100 } })

  await prisma.transaction.createMany({
    data: [
      { farmId: farm.id, type: 'Receita', category: 'Venda de Leite', date: day(-5), amount: 1850 },
      { farmId: farm.id, type: 'Despesa', category: 'Ração', date: day(-8), amount: 620.4 },
      { farmId: farm.id, type: 'Despesa', category: 'Veterinário', date: day(-2), amount: 180 },
    ],
  })
  return owner
}

// ── Produtora que veio do lite para a versão completa (com coletas) ─────

async function seedRosa() {
  if (await exists('rosa@demo.com')) return prisma.farm.findFirst({ where: { users: { some: { email: 'rosa@demo.com' } } } })

  const farm = await prisma.farm.create({ data: { name: 'Sítio Esperança', propertyType: 'Sítio', owner: 'Dona Rosa', city: 'Lavras', state: 'MG', milkPrice: 2.45 } })
  await createUser({ name: 'Dona Rosa', email: 'rosa@demo.com', role: 'editor', permissions: ALL_MODULES, farmId: farm.id })
  await prisma.milkProduction.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      farmId: farm.id, date: day(-(i + 1)), quantity: 40 + (i % 3) * 1.5, source: 'lite', observations: 'Anota Aí Leite',
    })),
  })
  return farm
}

// ── Produtora só do lite ────────────────────────────────────────────────

async function seedLite() {
  if (await exists('lite@demo.com')) return
  const user = await createUser({ name: 'Dona Maria', email: 'lite@demo.com', role: 'lite', milkPrice: 2.4 })
  const point = await prisma.milkPoint.create({ data: { ownerId: user.id, name: 'Sítio Primavera', kind: 'sitio' } })
  await prisma.milkEntry.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ pointId: point.id, date: day(-(i + 1)), liters: 46 + (i % 4) })),
  })
}

// ── Motorista com rota (um sítio ligado à Dona Rosa) ────────────────────

async function seedMotorista(rosaFarm) {
  if (await exists('motorista@demo.com')) return
  const user = await createUser({ name: 'Seu Tonho', email: 'motorista@demo.com', role: 'motorista' })
  const route = [
    { name: 'Sítio da Rosa', kind: 'sitio', farmId: rosaFarm?.id ?? null, base: 82 },
    { name: 'Sítio do João', kind: 'sitio', farmId: null, base: 120 },
    { name: 'Tanque da Ponte', kind: 'tanque', farmId: null, base: 380 },
    { name: 'Sítio Santa Rita', kind: 'sitio', farmId: null, base: 95 },
  ]
  for (const stop of route) {
    const point = await prisma.milkPoint.create({ data: { ownerId: user.id, name: stop.name, kind: stop.kind, farmId: stop.farmId } })
    // Coleta a cada 2 dias
    await prisma.milkEntry.createMany({
      data: [0, 2, 4, 6, 8].map((n, i) => ({ pointId: point.id, date: day(-n), liters: stop.base + (i % 3) * 3 })),
    })
  }
}

// ── Fornecedor aprovado, com ofertas e um cliente ───────────────────────

async function seedFornecedor() {
  if (await exists('fornecedor@demo.com')) return
  const vendor = await prisma.vendor.create({
    data: {
      companyName: 'Casa da Ração Boa Safra', contactName: 'Zé da Ração', phone: '(35) 99999-0000', whatsapp: '(35) 99999-0000',
      email: 'fornecedor@demo.com', city: 'Lavras', state: 'MG', description: 'Ração, sal mineral e entrega na zona rural',
      status: 'aprovado', inviteCode: 'DEMO2026', categories: ['Ração', 'Sal mineral'],
    },
  })
  await createUser({ name: 'Zé da Ração', email: 'fornecedor@demo.com', role: 'fornecedor', vendorId: vendor.id })
  await prisma.promotion.createMany({
    data: [
      { vendorId: vendor.id, title: 'Sal mineral 30 kg', category: 'Sal mineral', price: 119.9, unit: 'saco', description: 'Entrega grátis acima de 5 sacos', reach: 'regiao', validUntil: day(15) },
      { vendorId: vendor.id, title: 'Ração leiteira 22% 40 kg', category: 'Ração', price: 92, unit: 'saco', reach: 'clientes', validUntil: day(10) },
    ],
  })
  const produtorFarm = await prisma.farm.findFirst({ where: { users: { some: { email: 'produtor@demo.com' } } } })
  if (!produtorFarm) return
  await prisma.vendorClient.create({ data: { vendorId: vendor.id, farmId: produtorFarm.id } })
  // Pedido de orçamento aberto: aparece em "Pedidos" no painel do fornecedor
  const salt = await prisma.supply.findFirst({ where: { farmId: produtorFarm.id, category: 'Sal mineral' } })
  await prisma.supplyRequest.create({
    data: {
      farmId: produtorFarm.id, vendorId: vendor.id, supplyId: salt?.id ?? null, itemName: 'Sal mineral', category: 'Sal mineral',
      quantity: 60, unit: 'kg', note: 'Preciso até sexta. Entrega no sítio?', createdBy: 'João Produtor',
    },
  })
}

// ── Laticínio aprovado: pontos de coleta, rota de hoje com motorista e recebimento ──

const inviteCode = () => Array.from(randomBytes(8), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

async function seedLaticinio() {
  if (await exists('laticinio@demo.com')) return
  const org = await prisma.organization.create({
    data: {
      type: 'laticinio', name: 'Laticínio Serra Verde', contactName: 'Paulo do Laticínio', phone: '(35) 98888-2222',
      email: 'laticinio@demo.com', city: 'Lavras', state: 'MG', status: 'aprovado', inviteCode: inviteCode(),
    },
  })
  const manager = await createUser({ name: 'Paulo do Laticínio', email: 'laticinio@demo.com', role: 'laticinio', organizationId: org.id })
  const driver = await createUser({
    name: 'Zé Motorista', email: 'motorista.laticinio@demo.com', role: 'motorista', organizationId: org.id, phone: '(35) 97777-3333', vehicle: 'Caminhão tanque ABC-1D23',
  })
  const stops = [
    { name: 'Sítio Ipê', kind: 'sitio', contactName: 'Seu João', phone: '(35) 96666-1111', address: 'Estrada do Ipê, km 3', tankLiters: 500, accessNotes: 'Porteira com cadeado, chave com o vizinho', base: 140 },
    { name: 'Sítio Bela Vista', kind: 'sitio', contactName: 'Dona Cida', phone: '(35) 96666-2222', address: 'Córrego Fundo, km 7', tankLiters: 300, accessNotes: null, base: 85 },
    { name: 'Tanque da Ponte', kind: 'tanque', contactName: 'Associação do Córrego', phone: null, address: 'Ponte do Rio Grande', tankLiters: 2000, accessNotes: 'Coletar antes das 9h', base: 420 },
  ]
  const points = []
  for (const { base, ...data } of stops) {
    points.push(await prisma.milkPoint.create({ data: { ...data, ownerId: manager.id, organizationId: org.id } }))
  }
  // Rota todos os dias, com o motorista; histórico de 7 dias (ontem um local sem leite) e hoje ainda pendente
  const route = await prisma.route.create({
    data: {
      organizationId: org.id, name: 'Rota do Ipê', days: [0, 1, 2, 3, 4, 5, 6], driverId: driver.id,
      stops: { create: points.map((p, position) => ({ pointId: p.id, position })) },
    },
  })
  const entries = []
  for (let n = 1; n <= 7; n++) {
    points.forEach((p, i) => {
      const skipped = n === 1 && i === 1
      entries.push({
        pointId: p.id, date: day(-n), liters: skipped ? 0 : stops[i].base + (n % 3) * 4, skipReason: skipped ? 'Sem leite' : null,
        collectedById: driver.id, collectedAt: new Date(day(-n).getTime() + (9 + i) * 3600e3),
      })
    })
  }
  await prisma.milkEntry.createMany({ data: entries })
  await prisma.milkReception.createMany({
    data: [1, 2, 3].map((n) => ({
      organizationId: org.id, routeId: route.id, date: day(-n),
      liters: entries.filter((e) => e.date.getTime() === day(-n).getTime()).reduce((s, e) => s + e.liters, 0) - n,
    })),
  })
}

// ── Associação aprovada: associados, compra coletiva, comunicado, visita e mensalidades ──

async function seedAssociacao() {
  if (await exists('associacao@demo.com')) return
  const org = await prisma.organization.create({
    data: {
      type: 'associacao', name: 'Associação dos Produtores do Córrego Fundo', contactName: 'Dona Lurdes', phone: '(35) 95555-3333',
      email: 'associacao@demo.com', city: 'Lavras', state: 'MG', status: 'aprovado', inviteCode: 'ASSOC2026',
    },
  })
  await createUser({ name: 'Dona Lurdes', email: 'associacao@demo.com', role: 'associacao', organizationId: org.id })

  // Associados: a produtora do Anota Aí Leite e o produtor da versão completa (os dois compartilham o leite)
  const lite = await prisma.user.findUnique({ where: { email: 'lite@demo.com' }, select: { id: true } })
  const farm = await prisma.farm.findFirst({ where: { users: { some: { email: 'produtor@demo.com' } } }, select: { id: true } })
  const members = []
  if (lite) members.push(await prisma.orgMember.create({ data: { organizationId: org.id, userId: lite.id } }))
  if (farm) members.push(await prisma.orgMember.create({ data: { organizationId: org.id, farmId: farm.id } }))

  const purchase = await prisma.groupPurchase.create({
    data: { organizationId: org.id, title: 'Sal mineral 30 kg', category: 'Sal mineral', unit: 'Saco', description: 'Entrega na sede', deadline: day(10) },
  })
  if (members[0]) await prisma.groupPurchaseOrder.create({ data: { purchaseId: purchase.id, memberId: members[0].id, quantity: 4 } })
  await prisma.orgNotice.create({
    data: { organizationId: org.id, kind: 'vacinacao', title: 'Campanha de vacinação contra aftosa', body: 'Traga a carteira do rebanho. Das 8h às 12h na sede.', eventDate: day(5) },
  })
  if (members[0]) {
    await prisma.techVisit.create({ data: { organizationId: org.id, memberId: members[0].id, subject: 'Vaca com mastite', description: 'Desde ontem com o úbere inchado' } })
  }
  // Mensalidade do mês passado (uma paga, uma atrasada) e a deste mês em aberto
  const month = (offset) => { const d = day(0); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + offset); return d }
  const ref = (d) => d.toISOString().slice(0, 7)
  const fees = []
  members.forEach((m, i) => {
    const last = month(-1); last.setUTCDate(10)
    const next = month(0); next.setUTCDate(28)
    fees.push({ organizationId: org.id, memberId: m.id, reference: ref(last), amount: 50, dueDate: last, paidAt: i === 1 ? day(-20) : null })
    fees.push({ organizationId: org.id, memberId: m.id, reference: ref(next), amount: 50, dueDate: next })
  })
  await prisma.memberFee.createMany({ data: fees })
}

// ── Segmento, matrizes com bezerro ao pé e segunda propriedade de engorda (João) ──
// Cada parte confere se já existe, para funcionar também num banco já populado.

async function seedEngorda() {
  const owner = await prisma.user.findUnique({ where: { email: 'produtor@demo.com' }, select: { id: true, farmId: true } })
  if (!owner?.farmId) return
  const boaVista = owner.farmId
  await prisma.farm.update({ where: { id: boaVista }, data: { segments: ['leite', 'cria'] } })

  // Crias ao pé: Estrela e Malhada pariram há pouco (Mimosa e Pintada ficam solteiras)
  for (const [mother, name, species, gender, age] of [['Estrela', 'Pipoca', 'Bezerra', 'Fêmea', 45], ['Malhada', 'Trovãozinho', 'Bezerro', 'Macho', 120]]) {
    const mom = await prisma.animal.findFirst({ where: { farmId: boaVista, name: mother }, select: { id: true } })
    if (!mom || (await prisma.animal.findFirst({ where: { farmId: boaVista, name } }))) continue
    const codes = (await prisma.animal.findMany({ where: { farmId: boaVista }, select: { code: true } })).map((a) => Number(a.code)).filter(Number.isFinite)
    const code = String(Math.max(0, ...codes) + 1).padStart(2, '0')
    await prisma.animal.create({ data: { farmId: boaVista, code, name, species, gender, birthDate: day(-age), status: 'Vivo', acquisitionType: 'nascimento', motherId: mom.id } })
  }

  // Segunda propriedade do João, só de engorda, com o mesmo dono
  if (await prisma.farm.findFirst({ where: { name: 'Fazenda C2', members: { some: { userId: owner.id } } } })) return
  const c2 = await prisma.farm.create({ data: { name: 'Fazenda C2', propertyType: 'Fazenda', owner: 'João Produtor', city: 'Lavras', state: 'MG', segments: ['engorda'] } })
  await prisma.farmMember.create({ data: { userId: owner.id, farmId: c2.id } })

  const proteinado = await prisma.supply.create({ data: { farmId: c2.id, name: 'Proteinado 01', category: 'Sal mineral', unit: 'sacos', currentQuantity: 18, minimumQuantity: 4, packageKg: 25 } })
  await prisma.supply.create({ data: { farmId: c2.id, name: 'Sal mineral 03', category: 'Sal mineral', unit: 'sacos', currentQuantity: 30, minimumQuantity: 5, packageKg: 30 } })

  // Novilhas: entraram com 300 kg há 150 dias, pesadas a cada ~50 dias, com proteinado a 0,1% do peso vivo
  await prisma.lot.create({
    data: {
      farmId: c2.id, name: 'Novilhas de março', phase: 'engorda', startDate: day(-150), supplyId: proteinado.id, supplyPercent: 0.1,
      weighings: { create: [[-150, 40, 300], [-100, 40, 317], [-50, 40, 331.5], [0, 39, 346.5]].map(([d, headCount, avgWeight]) => ({ date: day(d), headCount, avgWeight })) },
    },
  })
  await prisma.lot.create({
    data: { farmId: c2.id, name: 'Garrotes recria', phase: 'recria', startDate: day(-20), weighings: { create: { date: day(-20), headCount: 25, avgWeight: 210 } } },
  })
  await prisma.lot.create({
    data: {
      farmId: c2.id, name: 'Bois lote 1', phase: 'engorda', startDate: day(-320), endDate: day(-15),
      weighings: { create: [[-320, 30, 360], [-160, 30, 455], [-15, 30, 540]].map(([d, headCount, avgWeight]) => ({ date: day(d), headCount, avgWeight })) },
    },
  })
}

// ── Lote com animais cadastrados e peso de cada um (Fazenda C2) ─────────

async function seedLoteAnimais() {
  const c2 = await prisma.farm.findFirst({ where: { name: 'Fazenda C2', members: { some: { user: { email: 'produtor@demo.com' } } } }, select: { id: true } })
  if (!c2 || (await prisma.lot.findFirst({ where: { farmId: c2.id, name: 'Garrotes de julho' } }))) return
  await prisma.lot.updateMany({ where: { farmId: c2.id, name: 'Novilhas de março' }, data: { targetWeight: 420 } })

  // 6 garrotes pesados na entrada e a cada ~30 dias, cada um no seu ritmo
  const animals = []
  for (const [i, [code, name, entry, daily]] of [['3232', 'Boi 3232', 250, 0.95], ['3233', 'Boi 3233', 262, 1.1], ['3234', 'Boi 3234', 241, 0.8], ['3235', 'Boi 3235', 270, 1.05], ['3236', 'Boi 3236', 255, 0.9], ['3237', 'Boi 3237', 248, 1.0]].entries()) {
    animals.push({ ...(await prisma.animal.create({ data: { farmId: c2.id, code, name, species: 'Boi de engorda', gender: 'Macho', isCastrated: true, birthDate: day(-540 - i * 10), status: 'Vivo', acquisitionType: 'compra' } })), entry, daily })
  }
  const lot = await prisma.lot.create({ data: { farmId: c2.id, name: 'Garrotes de julho', phase: 'recria', startDate: day(-90), targetWeight: 450 } })
  await prisma.animal.updateMany({ where: { id: { in: animals.map((a) => a.id) } }, data: { lotId: lot.id } })
  for (const d of [-90, -60, -30, 0]) {
    const weights = animals.map((a) => ({ animalId: a.id, weight: Math.round((a.entry + a.daily * (d + 90)) * 10) / 10 }))
    const avgWeight = Math.round((weights.reduce((s, w) => s + w.weight, 0) / weights.length) * 10) / 10
    const lw = await prisma.lotWeighing.create({ data: { lotId: lot.id, date: day(d), headCount: animals.length, avgWeight } })
    await prisma.animalWeighing.createMany({ data: weights.map((w) => ({ ...w, date: day(d), lotWeighingId: lw.id })) })
  }
}

// ── Folha do motorista para a aba Conferir (Dona Maria) ─────────────────

async function seedFolhas() {
  const lite = await prisma.user.findUnique({ where: { email: 'lite@demo.com' }, select: { id: true } })
  if (!lite || (await prisma.milkSheet.count({ where: { userId: lite.id } }))) return
  const entries = await prisma.milkEntry.findMany({ where: { point: { ownerId: lite.id } }, select: { date: true, liters: true } })
  const noted = (from, to) => entries.filter((e) => e.date >= day(from) && e.date <= day(to)).reduce((s, e) => s + e.liters, 0)
  // Coleta a cada 2 dias. A folha quase sempre bate; numa coleta vem 8% a menos (aparece em vermelho)
  const sheets = [[-9, 1], [-7, 0.99], [-5, 1], [-3, 0.92], [-1, 0.98]].map(([d, factor], i, all) => ({
    userId: lite.id, date: day(d), liters: Math.round((i === 0 ? 92 : noted(all[i - 1][0] + 1, d) * factor) * 10) / 10,
  }))
  await prisma.milkSheet.createMany({ data: sheets })
}

async function main() {
  await seedAdmin()
  await seedProdutor()
  await seedEngorda()
  await seedLoteAnimais()
  const rosaFarm = await seedRosa()
  await seedLite()
  await seedFolhas()
  await seedMotorista(rosaFarm)
  await seedFornecedor()
  await seedLaticinio()
  await seedAssociacao()

  console.log(`
Dados de demonstração prontos. Senha de todos: ${process.env.SEED_PASSWORD ? '(a que você definiu em SEED_PASSWORD)' : 'demo1234 (admin: admin1234)'}
  admin@demo.com       Administrador (só com SEED_ADMIN=1)
  produtor@demo.com    Versão completa com 2 propriedades: Sítio Boa Vista (leite e cria, matrizes com bezerro ao pé)
                       e Fazenda C2 (engorda: lotes, pesagens, proteinado em sacos). Troque pelo nome no topo.
  gerente@demo.com     Equipe do Sítio Boa Vista (Usuários, Leite, Animais)
  leitor@demo.com      Só leitura no Sítio Boa Vista
  rosa@demo.com        Versão completa com coletas do motorista (Sítio Esperança)
  lite@demo.com        Anota Aí Leite, produtora (Sítio Primavera), com folhas do motorista na aba Conferir
  motorista@demo.com   Anota Aí Leite, motorista com rota de 4 locais
  fornecedor@demo.com  Fornecedor aprovado, convite DEMO2026
  laticinio@demo.com   Laticínio Serra Verde: 3 pontos, Rota do Ipê, recebimento
  motorista.laticinio@demo.com  Motorista do laticínio (rota de hoje no Anota Aí Leite)
  associacao@demo.com  Associação do Córrego Fundo, convite ASSOC2026 (associados: lite e produtor)
`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
