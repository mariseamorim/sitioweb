import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth'
import { validateContact } from '@/lib/identity'
import { contactInUse } from '@/lib/registration'

export async function GET() {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: {
    name: true, email: true, phone: true, role: true, password: true, googleId: true,
    vendor: { select: { companyName: true, document: true, phone: true, whatsapp: true, city: true, state: true, description: true } },
    milkPoints: { where: { active: true }, select: { id: true, name: true, kind: true }, orderBy: { createdAt: 'asc' } },
  } })
  const { password, googleId, ...profile } = user
  return NextResponse.json({ ...profile, hasPassword: !!password, googleConnected: !!googleId }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 }) }
  const fail = (error: string) => NextResponse.json({ error }, { status: 400 })
  if (!body || typeof body.name !== 'string' || !body.name.trim()) return fail('Informe o nome')
  const name = body.name.trim()
  const contact = validateContact({ email: body.email, phone: body.phone })
  if ('error' in contact) return fail(contact.error)
  const { email, phone } = contact
  const inUse = await contactInUse(email, phone, me.id)
  if (inUse) return NextResponse.json({ error: inUse.replace(' Entre para continuar seu cadastro.', '') }, { status: 409 })
  if (body.password !== undefined && typeof body.password !== 'string') return fail('Senha inválida')
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } })
  const contactChanged = email !== user.email || phone !== user.phone
  if (!user.password && contactChanged) return fail('Crie uma senha antes de alterar o e-mail ou o telefone')
  if (user.password && (contactChanged || body.password)) {
    if (typeof body.currentPassword !== 'string' || !await verifyPassword(body.currentPassword, user.password)) return fail('Informe sua senha atual corretamente para alterar o e-mail, o telefone ou a senha')
  }
  if (body.password && body.password.length < 6) return fail('A nova senha deve ter pelo menos 6 caracteres')
  const vendorData: Record<string, string | null> = {}
  if (user.role === 'fornecedor') {
    if (!user.vendorId || !body.vendor || typeof body.vendor !== 'object') return fail('Dados da empresa inválidos')
    for (const key of ['companyName', 'document', 'phone', 'whatsapp', 'city', 'state', 'description']) {
      if (typeof body.vendor[key] !== 'string') return fail('Dados da empresa inválidos')
      vendorData[key] = body.vendor[key].trim() || null
    }
    if (!vendorData.companyName || !vendorData.phone) return fail('Empresa e telefone são obrigatórios')
    if (vendorData.state) {
      vendorData.state = vendorData.state.toUpperCase()
      if (!/^[A-Z]{2}$/.test(vendorData.state)) return fail('Informe a sigla do estado com duas letras')
    }
  }
  const points: { id: string; name: string; kind: string }[] = []
  if (user.role === 'lite' || user.role === 'motorista') {
    if (!Array.isArray(body.points) || body.points.length > 200) return fail('Locais inválidos')
    const owned = await prisma.milkPoint.findMany({ where: { ownerId: me.id }, select: { id: true } })
    const ids = new Set(owned.map(p => p.id))
    const seen = new Set<string>()
    for (const point of body.points) {
      if (!point || !ids.has(point.id) || seen.has(point.id) || typeof point.name !== 'string' || !point.name.trim() || !['sitio', 'tanque'].includes(point.kind)) return fail('Local inválido ou sem permissão')
      if (user.role === 'lite' && point.kind !== 'sitio') return fail('O local do produtor deve ser um sítio')
      seen.add(point.id)
      points.push({ id: point.id, name: point.name.trim(), kind: point.kind })
    }
  }
  try {
    const password = body.password ? await hashPassword(body.password) : undefined
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: me.id }, data: { name, email, phone, ...(password ? { password } : {}) } })
      if (user.role === 'fornecedor' && user.vendorId) {
        await tx.vendor.update({ where: { id: user.vendorId }, data: { ...vendorData, contactName: name, email } as Prisma.VendorUpdateInput })
      }
      for (const point of points) await tx.milkPoint.updateMany({ where: { id: point.id, ownerId: me.id }, data: { name: point.name, kind: point.kind } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'E-mail ou telefone já cadastrado' }, { status: 409 })
    return NextResponse.json({ error: 'Não foi possível salvar o cadastro' }, { status: 500 })
  }
}
