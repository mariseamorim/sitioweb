import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, getSessionUser } from '@/lib/auth'
import { isFarmMember, parseSegments } from '@/lib/farms'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canAccessModule(me, 'fazendas') || !canEdit(me)) {
    return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  }
  const { id } = await params
  if (me.role !== 'admin' && !(await isFarmMember(me.id, id))) {
    return NextResponse.json({ error: 'Você não tem acesso a esta propriedade' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    body = parsed
  } catch {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const fields = ['name', 'propertyType', 'documentType', 'documentNumber', 'owner', 'phone', 'address', 'city', 'state'] as const
  const data: Record<string, string | string[] | null> = {}
  for (const field of fields) {
    if (!(field in body)) continue
    if (typeof body[field] !== 'string') return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    data[field] = (body[field] as string).trim() || null
  }
  if ('segments' in body) {
    const segments = parseSegments(body.segments)
    if (!segments) return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 })
    data.segments = segments
  }
  if ('name' in data && !data.name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  if ('propertyType' in data && !['Fazenda', 'Sítio'].includes(String(data.propertyType ?? ''))) return NextResponse.json({ error: 'Tipo de propriedade inválido' }, { status: 400 })
  if (data.documentType && !['CPF', 'CNPJ'].includes(String(data.documentType))) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  if (data.state) {
    data.state = String(data.state).toUpperCase()
    if (!/^[A-Z]{2}$/.test(data.state)) return NextResponse.json({ error: 'Informe a sigla do estado com duas letras' }, { status: 400 })
  }

  try {
    const farm = await prisma.farm.update({ where: { id }, data: data as Prisma.FarmUpdateInput })
    return NextResponse.json(farm)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'Documento já cadastrado' }, { status: 409 })
      if (error.code === 'P2025') return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Não foi possível salvar a propriedade' }, { status: 500 })
  }
}
