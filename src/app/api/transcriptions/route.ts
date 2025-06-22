export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { transcriptionService } from '@/services/transcriptionService'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const transcription = await transcriptionService.create({
      userId: session.user.email,
      imageUrl: data.imageUrl,
      text: data.text || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : 1.0,
      status: 'completed',
    })
    
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
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const transcriptions = await transcriptionService.getByUserId(session.user.id)
    return NextResponse.json(transcriptions)
  } catch (error) {
    console.error('Erro ao buscar transcrições:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar transcrições' },
      { status: 500 }
    )
  }
} 
