import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { transcriptionId } = data

    if (!transcriptionId) {
      return NextResponse.json(
        { error: 'ID da transcrição é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a coleção pertence ao usuário
    const collection = await collectionService.getById(id)
    if (!collection || collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Coleção não encontrada ou não autorizada' },
        { status: 404 }
      )
    }

    await collectionService.removeTranscription(id, transcriptionId)
    
    return NextResponse.json({ message: 'Transcrição removida da coleção' })
  } catch (error) {
    console.error('Erro ao remover transcrição da coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao remover transcrição da coleção' },
      { status: 500 }
    )
  }
} 