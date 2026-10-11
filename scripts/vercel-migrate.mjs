// Migrations no deploy da Vercel. Roda no build (npm run build).
//
// - Fora do deploy de produção (Preview, local): não toca no banco.
// - Produção: aplica as migrations pendentes. Se o banco existe mas ainda não tem o histórico
//   do Prisma (erro P3005), confere se a estrutura é igual à versão inicial (prisma/baseline/0_init.prisma);
//   só então registra a 0_init como aplicada e segue. Qualquer diferença interrompe o deploy
//   sem alterar o banco (o site no ar continua na versão anterior).
import { execSync } from 'node:child_process'

const prisma = (args) => {
  try {
    const text = execSync(`npx prisma ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, text }
  } catch (e) {
    return { ok: false, text: `${e.stdout ?? ''}${e.stderr ?? ''}`, status: e.status }
  }
}
const fail = (message, detail = '') => {
  console.error(`[migrate] ${message}\n${detail}`)
  process.exit(1)
}

if (process.env.VERCEL_ENV !== 'production' && process.env.MIGRATE_ON_BUILD !== '1') {
  console.log('[migrate] fora do deploy de produção: banco não é alterado')
  process.exit(0)
}
if (!process.env.DATABASE_URL) fail('DATABASE_URL não configurada')

let deploy = prisma('migrate deploy')
if (!deploy.ok && deploy.text.includes('P3005')) {
  console.log('[migrate] banco sem histórico do Prisma: conferindo se a estrutura é igual à versão inicial...')
  const diff = prisma('migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/baseline/0_init.prisma --exit-code'
    .replace('"$DATABASE_URL"', JSON.stringify(process.env.DATABASE_URL)))
  if (!diff.ok) {
    fail('a estrutura do banco é diferente da versão inicial; nada foi alterado. Revise antes de migrar.', diff.text)
  }
  const resolve = prisma('migrate resolve --applied 0_init')
  if (!resolve.ok) fail('não foi possível registrar a migration inicial', resolve.text)
  console.log('[migrate] migration inicial registrada')
  deploy = prisma('migrate deploy')
}
if (!deploy.ok) fail('falha ao aplicar as migrations', deploy.text)
console.log(deploy.text.trim())
console.log('[migrate] banco atualizado')
