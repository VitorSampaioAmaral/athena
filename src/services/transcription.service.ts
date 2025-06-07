import { prisma } from '@/lib/prisma'

export interface TranscriptionCreateInput {
  text: string
  imageUrl?: string
  userId: string
}

export class TranscriptionService {
  static async create(data: TranscriptionCreateInput) {
    const transcription = await prisma.transcription.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return transcription
  }

  static async findByUserId(userId: string) {
    const transcriptions = await prisma.transcription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return transcriptions
  }

  static async findById(id: string) {
    const transcription = await prisma.transcription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!transcription) {
      throw new Error('Transcrição não encontrada')
    }

    return transcription
  }

  static async delete(id: string, userId: string) {
    const transcription = await prisma.transcription.findUnique({
      where: { id }
    })

    if (!transcription) {
      throw new Error('Transcrição não encontrada')
    }

    if (transcription.userId !== userId) {
      throw new Error('Não autorizado')
    }

    await prisma.transcription.delete({
      where: { id }
    })
  }
} 