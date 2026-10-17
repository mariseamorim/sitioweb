// Administrador: propriedades agrupadas por proprietário (regra pura, sem banco)
// node tests/owner-groups.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const modules = {}
function load(path) {
  if (modules[path]) return modules[path]
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, Intl, console, require: (name) => {
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error(`módulo inesperado: ${name}`)
  } })
  modules[path] = exports
  return exports
}

const { groupFarmsByOwner, filterOwnerGroups, ownerTotals, activityLabel, daysSince, UNKNOWN_OWNER, STALE_DAYS } = load('src/lib/ownerGroups.ts')

// Arrays e objetos criados dentro do vm têm outro protótipo: compara a forma, não a referência
const plain = (v) => JSON.parse(JSON.stringify(v))
const deep = (a, b, msg) => assert.deepEqual(plain(a), plain(b), msg)

const now = new Date('2026-10-16T12:00:00Z')
const ago = (days) => new Date(now.getTime() - days * 86400000).toISOString()
const farm = (over) => ({
  id: over.name, name: over.name, propertyType: 'Fazenda', documentType: null, documentNumber: null, owner: null, phone: null, address: null,
  city: null, state: null, isActive: true, segments: [], animals: 0, members: 1, lastActivity: null, createdAt: ago(100), ...over,
})

const farms = [
  farm({ name: 'Sítio Três Irmãos', documentType: 'CPF', documentNumber: '123.456.789-00', owner: 'Marise Amorim', city: 'Capim Branco', state: 'MG', animals: 48, lastActivity: ago(0), segments: ['leite', 'cria'] }),
  // mesmo CPF escrito só com números e sem nome: entra no grupo da Marise
  farm({ name: 'Fazenda do Alto', documentNumber: '12345678900', animals: 37, lastActivity: ago(2), segments: ['recria', 'engorda'] }),
  farm({ name: 'Fazenda Santa Rita', documentType: 'CNPJ', documentNumber: '12.345.678/0001-90', owner: 'Agropecuária Santa Rita Ltda', city: 'Sete Lagoas', state: 'MG', animals: 212, lastActivity: ago(0) }),
  // sem documento: agrupa pelo nome, ignorando maiúsculas, acentos e espaços
  farm({ name: 'Sítio Recanto', owner: 'Antônio Silva', city: 'Curvelo', state: 'MG', animals: 22, lastActivity: ago(41) }),
  farm({ name: 'Sítio Recanto 2', owner: '  antonio  silva ', animals: 3, lastActivity: null }),
  farm({ name: 'Fazenda Bela Vista', city: 'Capim Branco', state: 'MG', animals: 61, lastActivity: ago(5) }),
  farm({ name: 'Fazenda Horizonte', animals: 0, lastActivity: null }),
  farm({ name: 'Fazenda Antiga', owner: 'Marise Amorim', documentNumber: '123.456.789-00', isActive: false, animals: 10, lastActivity: ago(300) }),
]

const groups = groupFarmsByOwner(farms)

// Ordem: por nome do proprietário; "Sem proprietário" por último
deep(groups.map((g) => g.name), ['Agropecuária Santa Rita Ltda', 'Antônio Silva', 'Marise Amorim', UNKNOWN_OWNER])

const marise = groups.find((g) => g.name === 'Marise Amorim')
assert.equal(marise.document, '123.456.789-00')
deep(marise.farms.map((f) => f.name), ['Fazenda Antiga', 'Fazenda do Alto', 'Sítio Três Irmãos'])
assert.equal(marise.animals, 85, 'inativa não soma animais')
assert.equal(marise.city, 'Capim Branco, MG')
assert.equal(marise.lastActivity, ago(0))

const antonio = groups.find((g) => g.name === 'Antônio Silva')
assert.equal(antonio.farms.length, 2, 'nome com acento, espaços e maiúsculas diferentes é o mesmo dono')
assert.equal(antonio.document, null)

const unknown = groups.find((g) => g.unknown)
deep(unknown.farms.map((f) => f.name), ['Fazenda Bela Vista', 'Fazenda Horizonte'])

// Documento sem nome: o grupo mostra o documento formatado
const [soDoc] = groupFarmsByOwner([farm({ name: 'X', documentNumber: '98765432100' })])
assert.equal(soDoc.name, '987.654.321-00')
assert.equal(soDoc.unknown, false)

// Totais: só ativas; inativas à parte
deep(ownerTotals(groups, now), { owners: 3, farms: 7, stale: 3, unknown: 2, inactive: 1 })

// Filtros
const names = (list) => list.flatMap((g) => g.farms.map((f) => f.name))
deep(names(filterOwnerGroups(groups, 'todos', '', now)), ['Fazenda Santa Rita', 'Sítio Recanto', 'Sítio Recanto 2', 'Fazenda do Alto', 'Sítio Três Irmãos', 'Fazenda Bela Vista', 'Fazenda Horizonte'])
deep(names(filterOwnerGroups(groups, 'varias', '', now)), ['Sítio Recanto', 'Sítio Recanto 2', 'Fazenda do Alto', 'Sítio Três Irmãos'])
deep(names(filterOwnerGroups(groups, 'paradas', '', now)), ['Sítio Recanto', 'Sítio Recanto 2', 'Fazenda Horizonte'], 'sem lançamento nunca também conta como parada')
deep(names(filterOwnerGroups(groups, 'semdono', '', now)), ['Fazenda Bela Vista', 'Fazenda Horizonte'])
deep(names(filterOwnerGroups(groups, 'inativas', '', now)), ['Fazenda Antiga'])

// Busca por dono, documento (com ou sem pontuação), propriedade e cidade, sem acento
deep(filterOwnerGroups(groups, 'todos', 'marise', now).map((g) => g.name), ['Marise Amorim'])
deep(filterOwnerGroups(groups, 'todos', '12345678', now).map((g) => g.name), ['Agropecuária Santa Rita Ltda', 'Marise Amorim'])
deep(filterOwnerGroups(groups, 'todos', '123.456.789', now).map((g) => g.name), ['Marise Amorim'])
deep(filterOwnerGroups(groups, 'todos', 'alto', now).map((g) => g.name), ['Marise Amorim'])
deep(filterOwnerGroups(groups, 'todos', 'capim branco', now).map((g) => g.name), ['Marise Amorim', UNKNOWN_OWNER])
deep(filterOwnerGroups(groups, 'todos', 'ANTONIO', now).map((g) => g.name), ['Antônio Silva'])
deep(filterOwnerGroups(groups, 'paradas', 'marise', now), [], 'filtro e busca juntos')

// Texto do último lançamento
assert.equal(daysSince(null, now), null)
assert.equal(activityLabel(null, now), 'sem lançamentos')
assert.equal(activityLabel(ago(0), now), 'lançou hoje')
assert.equal(activityLabel(ago(1), now), 'lançou ontem')
assert.equal(activityLabel(ago(12), now), 'lançou há 12 dias')
assert.equal(activityLabel(ago(STALE_DAYS), now), `parada há ${STALE_DAYS} dias`)

console.log('owner-groups: ok')
