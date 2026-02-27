import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar se farm existe
    const farm = await prisma.farm.findUnique({
      where: { id },
      include: {
        animals: { select: { id: true } },
        reproductions: { select: { id: true } },
        transactions: { select: { id: true } },
        supplies: { select: { id: true } },
      },
    });

    if (!farm) {
      return NextResponse.json({ error: 'Farm não encontrada' }, { status: 404 });
    }

    // Verificar se tem dados relacionados
    const hasData =
      farm.animals.length > 0 ||
      farm.reproductions.length > 0 ||
      farm.transactions.length > 0 ||
      farm.supplies.length > 0;

    if (hasData) {
      // Se tem dados, apenas inativar
      const updated = await prisma.farm.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: 'Farm inativada com sucesso (contém dados)',
        farm: updated,
        action: 'inactivated',
      });
    } else {
      // Se não tem dados, deletar permanentemente
      await prisma.farm.delete({
        where: { id },
      });

      return NextResponse.json({
        message: 'Farm deletada com sucesso',
        action: 'deleted',
      });
    }
  } catch (error) {
    console.error('Erro ao deletar/inativar farm:', error);
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    );
  }
}
