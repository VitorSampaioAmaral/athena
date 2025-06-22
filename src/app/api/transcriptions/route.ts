export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { transcriptionService } from '@/services/transcriptionService'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    console.log('[DEBUG] Sessão no POST:', JSON.stringify(session, null, 2));
    
    if (!session?.user?.id) {
      console.error('[DEBUG] Falha na autorização POST: session.user.id está faltando.');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const transcription = await transcriptionService.create({
      userId: session.user.id,
      imageUrl: data.imageUrl,
      text: data.text || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 1.0,
      status: 'completed',
      source: data.source || 'file',
    })
    console.log('[DEBUG] Transcrição criada no POST:', JSON.stringify(transcription, null, 2));
    
    return NextResponse.json(transcription)
  } catch (error) {
    console.error('Erro ao criar transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao criar transcrição' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    console.log('[DEBUG] Sessão completa no GET:', JSON.stringify(session, null, 2));
    console.log('[DEBUG] session.user:', session?.user);
    console.log('[DEBUG] session.user.id:', session?.user?.id);
    console.log('[DEBUG] session.user.email:', session?.user?.email);
    
    if (!session?.user?.id) {
      console.error('[DEBUG] Falha na autorização GET: session.user.id está faltando.');
      console.error('[DEBUG] session.user existe?', !!session?.user);
      console.error('[DEBUG] session.user.id existe?', !!session?.user?.id);
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    console.log('[DEBUG] Buscando transcrições para o userId:', session.user.id);
    const transcriptions = await transcriptionService.getByUserId(session.user.id)
    console.log('[DEBUG] Transcrições encontradas no GET:', JSON.stringify(transcriptions, null, 2));
    return NextResponse.json(transcriptions)
  } catch (error) {
    console.error('Erro ao buscar transcrições:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar transcrições' },
      { status: 500 }
    )
  }
} 
