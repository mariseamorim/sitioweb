import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, isLegacyPassword, setSessionCookie, verifyPassword } from '@/lib/auth';
import { parseLogin } from '@/lib/identity';

// POST { login, password }: entra com e-mail ou telefone (DDD + número) e senha. `email` ainda é aceito no lugar de `login`.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;
  const login = parseLogin(body.login ?? body.email);

  if (!login || typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Informe o e-mail ou o telefone e a senha' }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: 'email' in login ? { email: { equals: login.email, mode: 'insensitive' } } : { phone: login.phone },
    include: { farm: true },
  });

  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ error: 'email' in login ? 'E-mail ou senha incorretos' : 'Telefone ou senha incorretos' }, { status: 401 });
  }

  // Senhas antigas em texto puro são convertidas para hash no primeiro login
  if (isLegacyPassword(user.password)) {
    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
  }

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    farmId: user.farmId,
    farmName: user.farm?.name ?? null,
  });

  setSessionCookie(response, user.id);
  return response;
}
