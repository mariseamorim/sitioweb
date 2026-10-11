import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/auth'
import { registrationIdentity } from '@/lib/registration'
import { MODULES } from '@/lib/modules'

export async function POST(request: NextRequest) {
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 }) }
  if (!body) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  const auth = await registrationIdentity(body.user)
  if (auth.error) return auth.error
  const identity = auth.identity!
  try {
    if (!body.farm) {
      const user = identity.id ? identity : await prisma.user.create({ data: { name: identity.name, email: identity.email, password: identity.password!, role: 'onboarding', permissions: [] } })
      const response = NextResponse.json({ id: user.id, name: user.name }, { status: 201 })
      setSessionCookie(response, user.id!)
      return response
    }
    const farm = body.farm
    if (typeof farm.name !== 'string' || !farm.name.trim()) return NextResponse.json({ error: 'Nome da propriedade é obrigatório' }, { status: 400 })
    const fields = ['documentType', 'documentNumber', 'owner', 'phone', 'address', 'city', 'state'] as const
    const details: Record<string, string | null> = {}
    for (const key of fields) {
      if (farm[key] !== undefined && typeof farm[key] !== 'string') return NextResponse.json({ error: 'Dados da propriedade inválidos' }, { status: 400 })
      details[key] = farm[key]?.trim() || null
    }
    if (farm.propertyType && !['Fazenda', 'Sítio'].includes(farm.propertyType)) return NextResponse.json({ error: 'Tipo de propriedade inválido' }, { status: 400 })
    if (details.state) {
      details.state = details.state.toUpperCase()
      if (!/^[A-Z]{2}$/.test(details.state)) return NextResponse.json({ error: 'Informe a sigla do estado' }, { status: 400 })
    }
    const user = await prisma.$transaction(async tx => {
      if (identity.id) {
        const claimed = await tx.user.updateMany({ where: { id: identity.id, role: 'onboarding' }, data: { role: 'editor' } })
        if (claimed.count !== 1) throw new Error('ALREADY_REGISTERED')
      }
      const property = await tx.farm.create({ data: { name: farm.name.trim(), propertyType: farm.propertyType || 'Fazenda', ...details } })
      const data = { role: 'editor', permissions: MODULES.map(m => m.key), farmId: property.id }
      const account = identity.id
        ? await tx.user.update({ where: { id: identity.id }, data })
        : await tx.user.create({ data: { name: identity.name, email: identity.email, password: identity.password!, ...data } })
      if (body.inviteCode) {
        const vendor = await tx.vendor.findUnique({ where: { inviteCode: String(body.inviteCode).toUpperCase() } })
        if (vendor && vendor.status !== 'bloqueado') await tx.vendorClient.create({ data: { vendorId: vendor.id, farmId: property.id } })
      }
      return account
    })
    const response = NextResponse.json({ id: user.id, name: user.name }, { status: 201 })
    setSessionCookie(response, user.id)
    return response
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'E-mail ou documento já cadastrado' }, { status: 409 })
    if (error instanceof Error && error.message === 'ALREADY_REGISTERED') return NextResponse.json({ error: 'Sua conta já foi cadastrada' }, { status: 409 })
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro' }, { status: 500 })
  }
}
