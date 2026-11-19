// Modo demonstração do veterinário consultor: uma conta fictícia com três propriedades, animais, coberturas, leite e
// vacinas, tudo só no celular. Serve para mostrar e testar o app sem conta e sem servidor.
//
// Como funciona: a sessão usa o token DEMO_TOKEN. Com ele, api() (src/api/client.ts) não vai à internet e responde
// aqui (demoApi): login, troca de propriedade e o painel de consultoria são calculados com os dados do aparelho; as
// listas devolvem o que já está no banco local. A fila de envio é aceita na hora (sync/index.ts), então anotar,
// diagnosticar e editar funcionam como no uso real, mas nada sai do celular. "Sair da conta" apaga tudo.
import { all, getMeta, run, setCache, setMeta, TABLES, transaction, upsert, type Row, type TableName } from '@/db'

export const DEMO_TOKEN = 'demo-veterinario'
const FARM_KEY = 'demo:farm'
const DAY = 86_400_000
const GESTATION = 283

const FARMS = [
  { id: 'demo-farm-1', name: 'Estancia San José', owner: 'Ramón Benítez', city: 'Caaguazú', state: 'Caaguazú', cows: 14 },
  { id: 'demo-farm-2', name: 'Sítio Boa Vista', owner: 'João Pereira', city: 'Patos de Minas', state: 'MG', cows: 9 },
  { id: 'demo-farm-3', name: 'Fazenda Santa Luzia', owner: 'Maria Aparecida Souza', city: 'Uberlândia', state: 'MG', cows: 12 },
]
const COW_NAMES = ['Mimosa', 'Estrela', 'Princesa', 'Jóia', 'Pintada', 'Malhada', 'Serena', 'Bonita', 'Flor', 'Graúna', 'Lua', 'Pérola', 'Cigana', 'Duquesa', 'Morena', 'Faceira', 'Brisa', 'Canela']
const CALF_NAMES = ['Aurora', 'Bela', 'Chica', 'Dalila', 'Esmeralda', 'Fofa', 'Gaia', 'Hortência']
const BULLS = ['Gir Leiteiro — Sansão', 'Holandês — Atlas', 'Girolando — Trovão']

export const DEMO_PERMISSIONS = ['animais', 'leite', 'vacinacao', 'veterinario', 'reproducao']

export function demoFarmId(): string {
  return getMeta(FARM_KEY) ?? FARMS[0].id
}

export function demoUser(farmId = demoFarmId()) {
  const farm = FARMS.find((f) => f.id === farmId) ?? FARMS[0]
  return {
    id: 'demo-vet', name: 'Dra. Ana Demonstração', email: 'demo@anotaaiagro.com.br', phone: null, role: 'editor',
    farmId: farm.id, farmName: farm.name, farms: FARMS.map((f) => ({ id: f.id, name: f.name })),
    permissions: DEMO_PERMISSIONS, support: false, vet: true,
  }
}

// ---------------------------------------------------------------- dados

const iso = (ms: number) => new Date(Math.floor(ms / DAY) * DAY).toISOString()

/** Gerador simples e repetível (mesmos dados a cada demonstração). */
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}

/** Apaga o que houver e grava os dados da demonstração. */
export function seedDemo() {
  const now = Date.now()
  const ago = (days: number) => iso(now - days * DAY)
  const ahead = (days: number) => iso(now + days * DAY)
  const rand = rng(42)
  const stamp = ago(0)
  const rows: [TableName, string, Row][] = []
  const add = (table: TableName, farmId: string, row: Row) => rows.push([table, farmId, { createdAt: stamp, updatedAt: stamp, ...row }])

  FARMS.forEach((farm, fi) => {
    const f = farm.id
    add('farms', f, { id: f, name: farm.name, propertyType: 'Fazenda', owner: farm.owner, city: farm.city, state: farm.state, isActive: 1, segments: JSON.stringify(['leite']), animals: farm.cows, members: 2 })
    let code = 100
    const animal = (row: Row) => { const id = `${f}-a${++code}`; add('animals', f, { id, code: String(code), customCode: null, status: 'Vivo', isCastrated: 0, acquisitionType: 'nascimento', ...row }); return id }
    const coverage = (row: Row) => add('reproductions', f, { id: `${f}-r${rows.length}`, method: 'iatf', maleName: BULLS[fi % BULLS.length], semenBatch: `L${2400 + fi}`, inseminator: 'Dra. Ana', ...row })

    animal({ name: 'Touro Sultão', species: 'Touro', gender: 'Macho', birthDate: ago(6 * 365) })

    for (let i = 0; i < farm.cows; i++) {
      const name = COW_NAMES[(i + fi * 5) % COW_NAMES.length]
      const age = 4 + Math.floor(rand() * 5) // anos
      const cow = animal({ name, species: 'Vaca', gender: 'Fêmea', birthDate: ago(age * 365 + Math.floor(rand() * 200)) })
      // Partos anteriores (dão o intervalo entre partos e a idade ao primeiro parto)
      const lastCalving = 60 + Math.floor(rand() * 340)
      const interval = 380 + Math.floor(rand() * 120)
      const firstFemale = rand() > 0.5
      animal({ name: `Cria de ${name}`, species: firstFemale ? 'Bezerra' : 'Bezerro', gender: firstFemale ? 'Fêmea' : 'Macho', birthDate: ago(lastCalving + interval), motherId: cow, status: 'Vendido', lowDate: ago(lastCalving), lowReason: 'Venda' })
      const female = rand() > 0.45
      const calf = animal({ name: female ? CALF_NAMES[(i + fi) % CALF_NAMES.length] : `Bezerro ${code + 1}`, species: female ? 'Bezerra' : 'Bezerro', gender: female ? 'Fêmea' : 'Macho', birthDate: ago(lastCalving), motherId: cow })
      coverage({ femaleId: cow, coverageDate: ago(lastCalving + GESTATION), expectedBirthDate: ago(lastCalving), actualBirthDate: ago(lastCalving), status: 'Parida', calfId: calf })

      // Situação atual da vaca: uma de cada tipo, para todas as telas terem o que mostrar
      switch (i % 6) {
        case 0: // prenha, parto daqui a uns 3 meses (com uma repetição vazia antes)
          coverage({ femaleId: cow, coverageDate: ago(225), expectedBirthDate: ago(225 - GESTATION), status: 'Vazia' })
          coverage({ femaleId: cow, coverageDate: ago(200), expectedBirthDate: ahead(GESTATION - 200), status: 'Prenha' })
          break
        case 1: // prenha, parto em menos de 30 dias (aparece em "partos próximos", secagem e pré-parto)
          coverage({ femaleId: cow, coverageDate: ago(262 + (i % 3) * 4), expectedBirthDate: ahead(GESTATION - 262 - (i % 3) * 4), status: 'Prenha' })
          break
        case 2: // coberta há mais de 28 dias: falta o diagnóstico
          coverage({ femaleId: cow, coverageDate: ago(32 + (i % 4) * 5), expectedBirthDate: ahead(GESTATION - 32 - (i % 4) * 5), status: 'Coberta' })
          break
        case 3: // coberta há poucos dias (entra na taxa de serviço)
          coverage({ femaleId: cow, coverageDate: ago(8 + (i % 3)), expectedBirthDate: ahead(GESTATION - 8 - (i % 3)), status: 'Coberta', method: 'natural', maleName: 'Touro Sultão', semenBatch: null, inseminator: null })
          break
        case 4: // vazia no último diagnóstico
          coverage({ femaleId: cow, coverageDate: ago(75), expectedBirthDate: ahead(GESTATION - 75), status: 'Vazia', method: 'ia' })
          break
        default: // prenha de 4 meses
          coverage({ femaleId: cow, coverageDate: ago(120), expectedBirthDate: ahead(GESTATION - 120), status: 'Prenha', method: 'ia' })
      }

      // Vacinas: uma aplicada e uma marcada
      add('vaccinations', f, { id: `${cow}-v1`, animalId: cow, vaccineName: 'Febre aftosa', scheduledDate: ago(150), appliedDate: ago(150), batch: 'AF-2291', manufacturer: 'Ourofino' })
      if (i % 3 === 0) add('vaccinations', f, { id: `${cow}-v2`, animalId: cow, vaccineName: 'Brucelose (reforço)', scheduledDate: ahead(10 + i), appliedDate: null })
    }

    // Novilhas em idade de cobertura
    for (let i = 0; i < 3; i++) {
      const heifer = animal({ name: CALF_NAMES[(i + 3 + fi) % CALF_NAMES.length] + ' II', species: 'Bezerra', gender: 'Fêmea', birthDate: ago(480 + i * 40) })
      if (i === 0) coverage({ femaleId: heifer, coverageDate: ago(40), expectedBirthDate: ahead(GESTATION - 40), status: 'Coberta' })
    }

    // Leite do rebanho, todo dia nos últimos 12 meses (com variação de seca e águas)
    const cows = Math.round(farm.cows * 0.7)
    for (let d = 1; d <= 365; d++) {
      const date = new Date(now - d * DAY)
      const season = 1 + 0.18 * Math.cos(((date.getUTCMonth() - 1) / 12) * 2 * Math.PI)
      const liters = Math.round(cows * (11 + fi * 2) * season * (0.92 + rand() * 0.16))
      add('milk', f, { id: `${f}-m${d}`, animalId: null, date: iso(date.getTime()), quantity: liters, cowsMilked: cows, pricePerLiter: 2.6, source: 'manual' })
    }
  })

  transaction(() => {
    for (const name of Object.keys(TABLES)) run(`DELETE FROM ${name}`)
    run('DELETE FROM outbox')
    run('DELETE FROM id_map')
    run('DELETE FROM animal_photos')
    for (const [table, farmId, row] of rows) upsert(table, farmId, row)
  })
  setMeta(FARM_KEY, FARMS[0].id)
  setCache('perfil', { name: demoUser().name, email: demoUser().email, phone: null, role: 'editor', hasPassword: true, googleConnected: false, vendor: null, milkPoints: [] })
}

// ---------------------------------------------------------------- "servidor"

/** Painel de consultoria calculado com os dados do aparelho, como GET /api/veterinario. */
function panel() {
  const now = Date.now()
  const clients = FARMS.map((farm) => {
    const animals = all<{ n: number }>("SELECT count(*) AS n FROM animals WHERE farmId = ? AND status = 'Vivo'", [farm.id])[0]?.n ?? 0
    const repro = all<{ status: string; coverageDate: string; expectedBirthDate: string | null; actualBirthDate: string | null }>(
      'SELECT status, coverageDate, expectedBirthDate, actualBirthDate FROM reproductions WHERE farmId = ?', [farm.id])
    const recent = repro.filter((r) => Date.parse(r.coverageDate) >= now - 365 * DAY)
    const diagnosed = recent.filter((r) => ['Prenha', 'Vazia', 'Parida'].includes(r.status))
    const pregnant = diagnosed.filter((r) => r.status !== 'Vazia')
    return {
      id: `client-${farm.id}`, farmId: farm.id, name: farm.name, owner: farm.owner, city: farm.city, state: farm.state, animals,
      awaitingDiagnosis: repro.filter((r) => r.status === 'Coberta').length,
      pregnancyRate: diagnosed.length ? Math.round((pregnant.length / diagnosed.length) * 100) : null,
      birthsSoon: repro.filter((r) => (r.status === 'Coberta' || r.status === 'Prenha') && !r.actualBirthDate && r.expectedBirthDate
        && Date.parse(r.expectedBirthDate) >= now - DAY && Date.parse(r.expectedBirthDate) <= now + 30 * DAY).length,
    }
  })
  const visit = (days: number, farm: number, time: string, purpose: string) => ({ id: `visit-${days}`, farmName: FARMS[farm].name, date: iso(now + days * DAY), time, purpose })
  return {
    vet: { name: demoUser().name, inviteCode: 'DEMO-2026' },
    openFarmId: demoFarmId(),
    clients,
    visits: [visit(2, 0, '07:30', 'Diagnóstico de gestação'), visit(6, 2, '08:00', 'IATF — lote de vacas paridas'), visit(13, 1, '14:00', 'Exame de novilhas')],
    ended: [],
  }
}

/**
 * Resposta de api() no modo demonstração. undefined = sem resposta (o app age como sem internet e usa o que tem).
 * As gravações nem chegam aqui: a fila é aceita direto em pushOutbox.
 */
export function demoApi(path: string, method: string, body: unknown): unknown {
  const route = path.split('?')[0]
  if (route === '/api/auth/me') return demoUser()
  if (route === '/api/auth/logout') return { ok: true }
  if (route === '/api/auth/switch-farm') {
    const farmId = (body as { farmId?: string } | null)?.farmId
    if (farmId && FARMS.some((f) => f.id === farmId)) setMeta(FARM_KEY, farmId)
    return { ok: true }
  }
  if (route === '/api/veterinario') return panel()
  if (method !== 'GET') return { ok: true }
  // Listas: o que já está no aparelho
  const table = (Object.entries(TABLES) as [TableName, { list: string | null }][]).find(([, t]) => t.list === route)?.[0]
  if (table === 'farms') return all('SELECT * FROM farms')
  if (table) return all(`SELECT * FROM ${table} WHERE farmId = ?`, [demoFarmId()])
  return undefined
}
