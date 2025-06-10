import { NextResponse } from 'next/server';

interface SSEClient {
    id: string;
    controller: ReadableStreamDefaultController;
    active: boolean;
    lastPing: number;
}

// Armazena as conexões ativas
const clients = new Map<string, SSEClient>();

// Codificador para mensagens SSE
const encoder = new TextEncoder();

// Limpa clientes inativos periodicamente
const CLEANUP_INTERVAL = 30000; // 30 segundos
const CLIENT_TIMEOUT = 60000; // 60 segundos

function cleanupInactiveClients() {
    const now = Date.now();
    for (const [id, client] of clients.entries()) {
        if (!client.active || (now - client.lastPing > CLIENT_TIMEOUT)) {
            try {
                client.controller.close();
            } catch (error) {
                console.error('Erro ao fechar controlador:', error);
            }
            clients.delete(id);
        }
    }
}

// Inicia o processo de limpeza
setInterval(cleanupInactiveClients, CLEANUP_INTERVAL);

// Função para enviar mensagem para todos os clientes
export function broadcastProgress(data: any) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encodedMessage = encoder.encode(message);
    const now = Date.now();

    for (const [id, client] of clients.entries()) {
        if (!client.active) {
            clients.delete(id);
            continue;
        }

        try {
            client.controller.enqueue(encodedMessage);
            client.lastPing = now;
        } catch (error) {
            console.error(`Erro ao enviar mensagem para cliente ${id}:`, error);
            try {
                client.controller.close();
            } catch (closeError) {
                console.error(`Erro ao fechar controlador do cliente ${id}:`, closeError);
            }
            clients.delete(id);
        }
    }
}

// Rota GET para estabelecer conexão SSE
export async function GET() {
    const clientId = Math.random().toString(36).substring(7);

    const stream = new ReadableStream({
        start(controller) {
            // Registra novo cliente
            clients.set(clientId, {
                id: clientId,
                controller,
                active: true,
                lastPing: Date.now()
            });

            // Envia mensagem inicial
            try {
                controller.enqueue(encoder.encode('data: {"status": "connected", "clientId": "' + clientId + '"}\n\n'));
            } catch (error) {
                console.error(`Erro ao enviar mensagem inicial para cliente ${clientId}:`, error);
                clients.delete(clientId);
            }
        },
        cancel() {
            // Remove cliente quando a conexão é fechada
            const client = clients.get(clientId);
            if (client) {
                client.active = false;
                try {
                    client.controller.close();
                } catch (error) {
                    console.error(`Erro ao fechar controlador do cliente ${clientId}:`, error);
                }
                clients.delete(clientId);
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}

export const dynamic = 'force-dynamic'; 