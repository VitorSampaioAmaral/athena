export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const { imageUrl, result } = await request.json();

        if (!imageUrl || !result) {
            return NextResponse.json(
                { error: 'Dados incompletos' },
                { status: 400 }
            );
        }

        const analysis = await prisma.analysis.create({
            data: {
                userId: session.user.email,
                imageUrl,
                result
            }
        });

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Erro ao salvar análise:', error);
        return NextResponse.json(
            { error: 'Erro ao salvar análise' },
            { status: 500 }
        );
    }
} 
