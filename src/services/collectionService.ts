import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export interface CreateCollectionData {
  userId: string;
  name: string;
  description?: string;
}

export interface AddToCollectionData {
  collectionId: string;
  transcriptionId: string;
}

export const collectionService = {
  // Gera um ID de acesso seguro de 32 caracteres
  generateAccessId(): string {
    return crypto.randomBytes(16).toString('hex');
  },

  async create(data: CreateCollectionData) {
    const accessId = this.generateAccessId();
    
    return prisma.collection.create({
      data: {
        ...data,
        accessId,
      },
      include: {
        items: {
          include: {
            transcription: true,
          },
        },
      },
    });
  },

  async getByUserId(userId: string) {
    return prisma.collection.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            transcription: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: string) {
    return prisma.collection.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            transcription: true,
          },
        },
      },
    });
  },

  async getByAccessId(accessId: string) {
    return prisma.collection.findUnique({
      where: { accessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            transcription: true,
          },
        },
      },
    });
  },

  async addTranscription(data: AddToCollectionData) {
    return prisma.collectionItem.create({
      data,
      include: {
        transcription: true,
        collection: true,
      },
    });
  },

  async removeTranscription(collectionId: string, transcriptionId: string) {
    return prisma.collectionItem.delete({
      where: {
        collectionId_transcriptionId: {
          collectionId,
          transcriptionId,
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.collection.delete({
      where: { id },
    });
  },

  async update(id: string, data: { name?: string; description?: string }) {
    return prisma.collection.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            transcription: true,
          },
        },
      },
    });
  },
}; 
