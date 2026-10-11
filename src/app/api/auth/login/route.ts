import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isLegacyPassword, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { farm: true },
  });

  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 });
  }

  // Senhas antigas em texto puro são convertidas para hash no primeiro login
  if (isLegacyPassword(user.password)) {
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
  }

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    farmId: user.farmId,
    farmName: user.farm?.name ?? null,
  });

  setSessionCookie(response, user.id);
  return response;
}
