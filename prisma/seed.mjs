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
  return prisma.user.create({ data: { ...data, password: await hashPassword(data.password ?? PASSWORD) } })
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

async function main() {
  await seedAdmin()
  await seedProdutor()
  const rosaFarm = await seedRosa()
  await seedLite()
  await seedMotorista(rosaFarm)
  await seedFornecedor()

  console.log(`
Dados de demonstração prontos. Senha de todos: ${process.env.SEED_PASSWORD ? '(a que você definiu em SEED_PASSWORD)' : 'demo1234 (admin: admin1234)'}
  admin@demo.com       Administrador (só com SEED_ADMIN=1)
  produtor@demo.com    Versão completa (Sítio Boa Vista), cliente do fornecedor
  gerente@demo.com     Equipe do Sítio Boa Vista (Usuários, Leite, Animais)
  leitor@demo.com      Só leitura no Sítio Boa Vista
  rosa@demo.com        Versão completa com coletas do motorista (Sítio Esperança)
  lite@demo.com        Anota Aí Leite, produtora (Sítio Primavera)
  motorista@demo.com   Anota Aí Leite, motorista com rota de 4 locais
  fornecedor@demo.com  Fornecedor aprovado, convite DEMO2026
`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
