import { PrismaClient } from '@prisma/client';

declare global {
  namespace PrismaJson {
    interface Transcription {
      id: string;
      userId: string;
      imageUrl: string;
      text: string;
      confidence: number;
      status: 'pending' | 'processing' | 'completed' | 'error';
      error?: string;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

declare module '@prisma/client' {
  interface PrismaClient {
    transcription: {
      create: (args: any) => Promise<PrismaJson.Transcription>;
      update: (args: any) => Promise<PrismaJson.Transcription>;
      findUnique: (args: any) => Promise<PrismaJson.Transcription | null>;
      findMany: (args: any) => Promise<PrismaJson.Transcription[]>;
      delete: (args: any) => Promise<PrismaJson.Transcription>;
    };
  }
} 