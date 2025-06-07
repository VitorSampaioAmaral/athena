import { NextResponse } from 'next/server'
import { TranscriptionService } from '@/services/transcription.service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body.userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const transcription = await TranscriptionService.create({
      text: body.text,
      imageUrl: body.imageUrl,
      userId: body.userId
    })
    
    return NextResponse.json(transcription, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    const transcriptions = await TranscriptionService.findByUserId(userId)
    
    return NextResponse.json(transcriptions)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 