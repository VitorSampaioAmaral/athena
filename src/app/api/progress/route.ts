import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const clients = new Set<ReadableStreamDefaultController>();

export async function GET() {
    const headersList = await headers();
    const acceptHeader = headersList.get('accept') || '';

    if (acceptHeader === 'text/event-stream') {
        const stream = new ReadableStream({
            start(controller: ReadableStreamDefaultController) {
                clients.add(controller);

                // Envia um evento inicial
                const data = `data: ${JSON.stringify({ type: 'connected' })}\n\n`;
                controller.enqueue(new TextEncoder().encode(data));
            },
            cancel(controller: ReadableStreamDefaultController) {
                clients.delete(controller);
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    return NextResponse.json({ error: 'Método não suportado' }, { status: 405 });
}

export function broadcastProgress(data: any) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    
    clients.forEach(client => {
        try {
            client.enqueue(encoder.encode(message));
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            clients.delete(client);
        }
    });
}

export const dynamic = 'force-dynamic'; 