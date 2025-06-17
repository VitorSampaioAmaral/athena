import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { prisma } from '@/lib/prisma';

// Configurações de créditos
const DAILY_LIMIT = 50; // Limite diário de transcrições
const MIN_DELAY_MS = 30000; // 30 segundos entre transcrições
const MAX_DELAY_MS = 120000; // 2 minutos entre transcrições

interface CreditStatus {
  usedToday: number;
  remaining: number;
  nextAvailable: Date | null;
  dailyLimit: number;
  canTranscribe: boolean;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar transcrições de hoje
    const todayTranscriptions = await prisma.transcription.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Buscar última transcrição para calcular delay
    const lastTranscription = await prisma.transcription.findFirst({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const usedToday = todayTranscriptions;
    const remaining = Math.max(0, DAILY_LIMIT - usedToday);
    
    let nextAvailable: Date | null = null;
    let canTranscribe = remaining > 0;

    if (lastTranscription) {
      const timeSinceLast = Date.now() - lastTranscription.createdAt.getTime();
      const delayNeeded = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, timeSinceLast));
      
      if (timeSinceLast < delayNeeded) {
        nextAvailable = new Date(lastTranscription.createdAt.getTime() + delayNeeded);
        canTranscribe = false;
      }
    }

    const status: CreditStatus = {
      usedToday,
      remaining,
      nextAvailable,
      dailyLimit: DAILY_LIMIT,
      canTranscribe
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Erro ao buscar status de créditos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Verificar limite diário
    const todayTranscriptions = await prisma.transcription.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (todayTranscriptions >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Limite diário de transcrições atingido' },
        { status: 429 }
      );
    }

    // Verificar delay
    const lastTranscription = await prisma.transcription.findFirst({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (lastTranscription) {
      const timeSinceLast = Date.now() - lastTranscription.createdAt.getTime();
      const delayNeeded = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, timeSinceLast));
      
      if (timeSinceLast < delayNeeded) {
        const nextAvailable = new Date(lastTranscription.createdAt.getTime() + delayNeeded);
        return NextResponse.json(
          { 
            error: 'Aguarde antes de fazer outra transcrição',
            nextAvailable,
            waitTime: delayNeeded - timeSinceLast
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao verificar créditos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 