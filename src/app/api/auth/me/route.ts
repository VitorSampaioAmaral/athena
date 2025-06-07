import { NextResponse } from 'next/server';
import { validateToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('Cookie')?.split('auth_token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const user = await validateToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar usuário' },
      { status: 500 }
    );
  }
} 