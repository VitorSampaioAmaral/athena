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
  return NextResponse.json({
    usedToday: 0,
    remaining: 9999,
    nextAvailable: null,
    dailyLimit: 9999,
    canTranscribe: true
  });
}

export async function POST() {
  return NextResponse.json({ success: true });
} 