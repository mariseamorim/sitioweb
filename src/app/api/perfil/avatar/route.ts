import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// PUT { avatar }: troca a foto do perfil (data URL de imagem, já reduzida pela tela); { avatar: null } remove.
const MAX_LENGTH = 300_000 // ~220 KB de imagem: a tela manda 256 px em JPEG, bem menos que isso

export async function PUT(request: NextRequest) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  if (me.isDemo) return NextResponse.json({ error: 'Na demonstração não dá para fazer isto. Crie sua conta para usar de verdade.' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const avatar = body.avatar
  if (avatar !== null && (typeof avatar !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > MAX_LENGTH)) {
    return NextResponse.json({ error: 'Foto inválida ou grande demais' }, { status: 400 })
  }
  await prisma.user.update({ where: { id: me.id }, data: { avatar } })
  return NextResponse.json({ avatar })
}
