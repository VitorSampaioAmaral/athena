import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth'
import { collectionService } from '@/services/collectionService'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()
    const { collectionId, transcriptionId } = data

    if (!collectionId || !transcriptionId) {
      return NextResponse.json(
        { error: 'ID da coleção e ID da transcrição são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se a coleção pertence ao usuário
    const collection = await collectionService.getById(collectionId)
    if (!collection || collection.userId !== session.user.email) {
      return NextResponse.json(
        { error: 'Coleção não encontrada ou não autorizada' },
        { status: 404 }
      )
    }

    const result = await collectionService.addTranscription({
      collectionId,
      transcriptionId,
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao adicionar transcrição à coleção:', error)
    return NextResponse.json(
      { error: 'Erro ao adicionar transcrição à coleção' },
      { status: 500 }
    )
  }
} 
