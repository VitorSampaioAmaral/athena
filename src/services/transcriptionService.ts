import { prisma } from '@/lib/prisma';

export interface CreateTranscriptionData {
  userId: string;
  imageUrl: string;
  text: string;
  confidence: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  source?: 'file' | 'url';
}

export interface UpdateTranscriptionData {
  text?: string;
  confidence?: number;
  status?: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export const transcriptionService = {
  async create(data: CreateTranscriptionData) {
    console.log('[DEBUG] Tentando criar transcrição com dados:', JSON.stringify(data, null, 2));
    try {
      const result = await prisma.transcription.create({
        data: {
          ...data,
          text: data.text || '',
          confidence: data.confidence || 0,
          status: data.status || 'pending'
        },
      });
      console.log('[DEBUG] Transcrição criada com sucesso:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[DEBUG] Erro ao criar transcrição:', error);
      throw error;
    }
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
    console.log('[DEBUG] Buscando transcrições para userId:', userId);
    try {
      const result = await prisma.transcription.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      console.log('[DEBUG] Transcrições encontradas:', result.length, 'registros');
      console.log('[DEBUG] Primeira transcrição (se houver):', result[0] ? JSON.stringify(result[0], null, 2) : 'Nenhuma');
      return result;
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar transcrições:', error);
      throw error;
    }
  },

  async delete(id: string) {
    return prisma.transcription.delete({
      where: { id },
    });
  },
}; 
