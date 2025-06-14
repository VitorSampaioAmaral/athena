import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return new NextResponse('Não autorizado', { status: 401 });
    }

    // Primeiro, exclui todas as transcrições do usuário
    await prisma.transcription.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    // Depois, exclui o usuário
    await prisma.user.delete({
      where: {
        id: session.user.id,
      },
    });

    return new NextResponse('Conta excluída com sucesso', { status: 200 });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
} 