// Banco local (SQLite) com cópia dos dados da propriedade e a fila de envio (outbox).
// As colunas têm os mesmos nomes dos campos da API, então uma linha do banco é o mesmo objeto que o servidor devolve.
// Campos aninhados (listas, objetos) ficam como JSON na coluna; use parseJson() ao ler.
import * as SQLite from 'expo-sqlite'

export const db = SQLite.openDatabaseSync('anotaai.db')

export type Row = Record<string, unknown>

/**
 * Tabelas sincronizadas: nome local, colunas (além de id e farmId) e a rota da API que lista tudo.
 * `module`: permissão exigida para baixar ('' = qualquer pessoa logada; 'admin' = só administrador da plataforma).
 * `list: null` = preenchida a partir de outra rota (ver sync/index.ts).
 */
export const TABLES = {
  animals: {
    columns: ['code', 'customCode', 'name', 'species', 'gender', 'birthDate', 'status', 'isCastrated', 'acquisitionType', 'gta', 'observations', 'motherId', 'lowDate', 'lowReason', 'lotId', 'rearingStart', 'rearingEnd', 'rearingTarget', 'createdAt', 'updatedAt'],
    list: '/api/animals', module: 'animais',
  },
  milk: {
    columns: ['animalId', 'date', 'quantity', 'pricePerLiter', 'cowsMilked', 'source', 'observations', 'createdAt', 'updatedAt'],
    list: '/api/milk-production', module: 'leite',
  },
  vaccinations: {
    columns: ['animalId', 'vaccineName', 'scheduledDate', 'appliedDate', 'batch', 'manufacturer', 'observations', 'createdAt', 'updatedAt'],
    list: '/api/vacinacao', module: 'vacinacao',
  },
  treatments: {
    columns: ['animalId', 'startDate', 'endDate', 'medicine', 'milkWithdrawalDays', 'meatWithdrawalDays', 'batch', 'manufacturer', 'description', 'observations', 'createdAt', 'updatedAt'],
    list: '/api/veterinary-treatment', module: 'veterinario',
  },
  transactions: {
    columns: ['type', 'category', 'date', 'amount', 'description', 'animalId', 'createdAt', 'updatedAt'],
    list: '/api/financeiro', module: 'financeiro',
  },
  supplies: {
    columns: ['name', 'category', 'unit', 'currentQuantity', 'minimumQuantity', 'packageKg', 'unitPrice', 'dailyUseKg', 'daysLeft', 'createdAt', 'updatedAt'],
    list: '/api/estoque', module: 'estoque',
  },
  supply_movements: {
    columns: ['supplyId', 'type', 'quantity', 'date', 'description', 'createdAt'],
    list: null, module: 'estoque',
  },
  reproductions: {
    columns: ['femaleId', 'maleName', 'method', 'heatDate', 'semenBatch', 'bullRegistry', 'inseminator', 'coverageDate', 'expectedBirthDate', 'actualBirthDate', 'status', 'calfId', 'observations', 'createdAt', 'updatedAt'],
    list: '/api/reproducao', module: 'reproducao',
  },
  /** Lote de recria/engorda como o servidor devolve (supplies, feedings, weighings e animals em JSON). */
  lots: {
    columns: ['name', 'phase', 'startDate', 'endDate', 'targetWeight', 'notes', 'supplies', 'feedings', 'weighings', 'animals', 'createdAt', 'updatedAt'],
    list: '/api/lotes', module: 'animais',
  },
  /** Pesagens individuais (recria um a um); vêm dentro de /api/recria. */
  animal_weighings: {
    columns: ['animalId', 'date', 'weight', 'lotWeighingId', 'createdAt'],
    list: null, module: 'animais',
  },
  /** Equipe da propriedade (permissions em JSON). */
  users: {
    columns: ['name', 'email', 'phone', 'role', 'permissions', 'createdAt'],
    list: '/api/users', module: 'usuarios',
  },
  /** Propriedades da pessoa (admin: todas, com contagens de /api/admin/propriedades). */
  farms: {
    columns: ['name', 'propertyType', 'documentType', 'documentNumber', 'owner', 'phone', 'address', 'city', 'state', 'isActive', 'segments', 'animals', 'members', 'lastActivity', 'createdAt'],
    list: '/api/farms', module: '',
  },
  /** Ofertas visíveis (vendor em JSON); a rota devolve { offers, lowCategories }. */
  offers: {
    columns: ['vendorId', 'title', 'description', 'category', 'price', 'unit', 'imageUrl', 'reach', 'validUntil', 'isActive', 'vendor', 'isMyVendor', 'matchesLowStock', 'createdAt'],
    list: '/api/ofertas', module: '',
  },
  /** Pedidos e mensagens aos fornecedores (vendor em JSON). */
  supply_requests: {
    columns: ['vendorId', 'supplyId', 'itemName', 'category', 'quantity', 'unit', 'note', 'status', 'reply', 'replyPrice', 'repliedAt', 'createdBy', 'vendor', 'createdAt', 'updatedAt'],
    list: '/api/pedidos', module: '',
  },
  /** Meus fornecedores (id = id do fornecedor). */
  vendors: {
    columns: ['companyName', 'contactName', 'city', 'state', 'whatsapp', 'phone', 'status', 'muted', 'shareStock', 'since'],
    list: '/api/meus-fornecedores', module: '',
  },
} as const

export type TableName = keyof typeof TABLES

const SCHEMA = `
PRAGMA journal_mode = WAL;
${Object.entries(TABLES).map(([name, t]) => `CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, farmId TEXT NOT NULL, ${t.columns.map(c => `${c}`).join(', ')});
CREATE INDEX IF NOT EXISTS ${name}_farm ON ${name}(farmId);`).join('\n')}
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, farmId TEXT NOT NULL, module TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL,
  body TEXT, localId TEXT, tbl TEXT, createdAt TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lastError TEXT, failed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS id_map (localId TEXT PRIMARY KEY, serverId TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`

/** Colunas acrescentadas depois da primeira versão entram com ALTER TABLE (sem perder os dados do aparelho). */
function ensureColumns() {
  for (const [name, t] of Object.entries(TABLES)) {
    const existing = new Set(db.getAllSync<{ name: string }>(`PRAGMA table_info(${name})`).map(c => c.name))
    for (const col of t.columns) {
      if (!existing.has(col)) db.execSync(`ALTER TABLE ${name} ADD COLUMN ${col}`)
    }
  }
}

let ready = false
export function initDb() {
  if (ready) return
  db.execSync(SCHEMA)
  ensureColumns()
  ready = true
}

export function all<T = Row>(sql: string, params: SQLite.SQLiteBindParams = []): T[] {
  initDb()
  return db.getAllSync<T>(sql, params)
}

export function one<T = Row>(sql: string, params: SQLite.SQLiteBindParams = []): T | null {
  initDb()
  return db.getFirstSync<T>(sql, params) ?? null
}

export function run(sql: string, params: SQLite.SQLiteBindParams = []) {
  initDb()
  return db.runSync(sql, params)
}

export function transaction(fn: () => void) {
  initDb()
  db.withTransactionSync(fn)
}

/** Converte um valor da API para algo que o SQLite guarda (booleanos viram 0/1, objetos viram JSON). */
function toCell(value: unknown): SQLite.SQLiteBindValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number' || typeof value === 'string') return value
  return JSON.stringify(value)
}

/** Lê uma coluna guardada como JSON (lista ou objeto). */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value !== 'string') return value as T
  try { return JSON.parse(value) as T } catch { return fallback }
}

export function upsert(table: TableName, farmId: string, row: Row) {
  const cols = ['id', 'farmId', ...TABLES[table].columns]
  const values = cols.map(c => (c === 'farmId' ? farmId : toCell(row[c])))
  run(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, values)
}

/** Substitui a cópia local da tabela pela lista do servidor, preservando as linhas criadas no aparelho e ainda não enviadas. */
export function replaceFromServer(table: TableName, farmId: string, rows: Row[]) {
  transaction(() => {
    run(`DELETE FROM ${table} WHERE farmId = ? AND id NOT LIKE 'local_%'`, [farmId])
    for (const row of rows) upsert(table, farmId, row)
  })
}

export function patchRow(table: TableName, id: string, patch: Row) {
  const cols = TABLES[table].columns.filter(c => c in patch)
  if (!cols.length) return
  run(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => toCell(patch[c])), id])
}

export function deleteRow(table: TableName, id: string) {
  run(`DELETE FROM ${table} WHERE id = ?`, [id])
}

export function getMeta(key: string): string | null {
  return one<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null
}

export function setMeta(key: string, value: string | null) {
  if (value === null) run('DELETE FROM meta WHERE key = ?', [key])
  else run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value])
}

/** Cópia em JSON de uma resposta da API que não é uma tabela por propriedade (perfil, listas do administrador). */
export function getCache<T>(key: string): T | null {
  return parseJson<T | null>(getMeta(`cache:${key}`), null)
}

export function setCache(key: string, value: unknown) {
  setMeta(`cache:${key}`, JSON.stringify(value))
}

/** Apaga tudo o que é da propriedade (ao sair da conta). */
export function wipeAll() {
  transaction(() => {
    for (const name of Object.keys(TABLES)) run(`DELETE FROM ${name}`)
    run('DELETE FROM outbox')
    run('DELETE FROM id_map')
    run('DELETE FROM meta')
  })
}
