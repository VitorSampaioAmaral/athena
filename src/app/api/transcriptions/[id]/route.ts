export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { transcriptionService } from '@/services/transcriptionService'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const transcription = await transcriptionService.getById(id)
    
    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcrição não encontrada' },
        { status: 404 }
      )
    }

    if (transcription.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    return NextResponse.json(transcription)
  } catch (error) {
    console.error('Erro ao buscar transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar transcrição' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const transcription = await transcriptionService.getById(id)
    
    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcrição não encontrada' },
        { status: 404 }
      )
    }

    if (transcription.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const data = await request.json()
    const updatedTranscription = await transcriptionService.update(id, data)

    return NextResponse.json(updatedTranscription)
  } catch (error) {
    console.error('Erro ao atualizar transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar transcrição' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params
    const transcription = await transcriptionService.getById(id)
    
    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcrição não encontrada' },
        { status: 404 }
      )
    }

    if (transcription.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    await transcriptionService.delete(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar transcrição' },
      { status: 500 }
    )
  }
} 