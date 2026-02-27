import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { farm: true },
  });

  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
  }

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    farmId: user.farmId,
    farmName: user.farm?.name ?? null,
  });

  response.cookies.set('userId', user.id, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });

  return response;
}
