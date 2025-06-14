import { prisma } from '@/lib/prisma';

export interface CreateTranscriptionData {
  userId: string;
  imageUrl: string;
  text: string;
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface UpdateTranscriptionData {
  text?: string;
  confidence?: number;
  status?: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export const transcriptionService = {
  async create(data: CreateTranscriptionData) {
    return prisma.transcription.create({
      data: {
        ...data,
        text: data.text || '',
        confidence: data.confidence || 0,
        status: data.status || 'pending'
      },
    });
  },

  async update(id: string, data: UpdateTranscriptionData) {
    return prisma.transcription.update({
      where: { id },
      data,
    });
  },

  async getById(id: string) {
    return prisma.transcription.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async getByUserId(userId: string) {
    return prisma.transcription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async delete(id: string) {
    return prisma.transcription.delete({
      where: { id },
    });
  },
}; 