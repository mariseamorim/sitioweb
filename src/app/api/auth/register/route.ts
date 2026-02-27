import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { farm, user } = await request.json();

  if (!farm?.name) {
    return NextResponse.json({ error: 'Nome da propriedade é obrigatório' }, { status: 400 });
  }
  if (!user?.name || !user?.email || !user?.password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: user.email } });
  if (existingUser) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
  }

  try {
    const result = await prisma.$transaction(async (tx:any) => {
      const newFarm = await tx.farm.create({
        data: {
          name: farm.name,
          propertyType: farm.propertyType || 'Fazenda',
          documentType: farm.documentType || null,
          documentNumber: farm.documentNumber || null,
          owner: farm.owner || null,
          email: farm.email || null,
          phone: farm.phone || null,
          city: farm.city || null,
          state: farm.state || null,
        },
      });

      const newUser = await tx.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          role: 'editor',
          permissions: ['animais', 'leite', 'veterinario', 'vacinacao', 'reproducao', 'financeiro', 'estoque', 'fazendas', 'usuarios'],
          farmId: newFarm.id,
        },
      });

      return { farm: newFarm, user: newUser };
    });

    const response = NextResponse.json({ id: result.user.id, name: result.user.name }, { status: 201 });

    response.cookies.set('userId', result.user.id, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    // Log full error server-side for debugging
    console.error('Register error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Erro ao criar conta', detail: message }, { status: 500 });
  }
}
