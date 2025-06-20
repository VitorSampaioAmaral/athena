import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      credits: {
        remaining: 1000,
        used: 0,
        total: 1000
      }
    });
  } catch (error) {
    console.error('Erro ao buscar créditos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ success: true });
} 
