import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return new NextResponse('Não autorizado', { status: 401 });
    }

    const { enabled } = await request.json();

    await prisma.user.update({
      where: {
        email: session.user.email!,
      },
      data: {
        notificationsEnabled: enabled,
      },
    });

    return new NextResponse('Configurações atualizadas', { status: 200 });
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
} 