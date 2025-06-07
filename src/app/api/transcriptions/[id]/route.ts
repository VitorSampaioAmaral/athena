import { NextResponse } from 'next/server'
import { TranscriptionService } from '@/services/transcription.service'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const transcription = await TranscriptionService.findById(params.id)
    return NextResponse.json(transcription)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: error.message === 'Transcrição não encontrada' ? 404 : 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuário não autenticado' },
        { status: 401 }
      )
    }

    await TranscriptionService.delete(params.id, userId)
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { 
        status: error.message === 'Transcrição não encontrada' ? 404 : 
                error.message === 'Não autorizado' ? 403 : 500 
      }
    )
  }
} 