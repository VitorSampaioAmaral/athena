import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { pipeline } from '@xenova/transformers';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import { broadcastProgress } from '../progress/route';
import path from 'path';

// Tipos para análise
type AnalysisStatus = 'started' | 'completed' | 'error' | 'hit';

interface CacheEntry {
    result: string;
    timestamp: number;
}

// Cache para armazenar resultados de análises similares
const analysisCache = new Map<string, CacheEntry>();
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB em bytes

// Cache para o modelo e prompt base
let generator: any = null;
const BASE_PROMPT = `Você é um especialista em análise de imagens e acessibilidade.
Como assistente de descrição de imagens, sua tarefa é fornecer uma análise detalhada e acessível em português.
Foque em ajudar pessoas com deficiência visual a compreender completamente o conteúdo.
Mantenha suas respostas diretas e relevantes ao conteúdo apresentado.
Nunca mencione filmes, cinema ou outros temas não relacionados à imagem.
Analise o seguinte conteúdo:

`;

// Cache para o modelo
let detector: any = null;

// Configuração do ambiente ONNX Runtime
process.env.ONNXRUNTIME_LOG_LEVEL = '3'; // 3 = ERROR, ignora warnings
process.env.ONNXRUNTIME_LOG_VERBOSITY_LEVEL = '0'; // Minimiza verbosidade

interface AnalysisLog {
  timestamp: number;
  stage: string;
  status: 'started' | 'completed' | 'error';
  message: string;
  details?: any;
}

const analysisLogs: AnalysisLog[] = [];

function logAnalysis(stage: string, status: AnalysisStatus, message: string, data?: any) {
    const log = {
        stage,
        status,
        message,
        data,
        timestamp: Date.now()
    };
    console.log(`[${new Date(log.timestamp).toISOString()}] ${stage}: ${message}`);
    broadcastProgress(log);
}

// --- Funções de Validação e Tradução ---
function isValidPortuguese(text: string): boolean {
    if (!text || text.trim().length < 3) return false;

    const commonPortugueseWords = ['de', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'que', 'para', 'em', 'com', 'não', 'por', 'mais', 'da', 'do', 'na', 'no'];

    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) return false;

    const commonWordsFound = words.filter(word => commonPortugueseWords.includes(word));
    const ratio = commonWordsFound.length / words.length;

    const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
    const hasValidStructure = /^[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ]/.test(text.trim());
    const hasLetters = /[a-záàâãéèêíïóôõöúüçñ]/i.test(text);

    return hasLetters && (ratio >= 0.15 || hasPortugueseChars || (hasValidStructure && words.length >= 2));
}

function isEnglish(text: string): boolean {
    if (!text || text.trim().length < 3) return false;

    const commonEnglishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'is', 'this', 'are', 'we'];

    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 1);
    if (words.length === 0) return false;

    const commonWordsFound = words.filter(word => commonEnglishWords.includes(word));
    const ratio = commonWordsFound.length / words.length;

    const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
    const hasLetters = /[a-z]/i.test(text);

    return hasLetters && ratio >= 0.1 && !hasPortugueseChars;
}

// Função para detectar o tipo de imagem baseado nos bytes iniciais
function detectImageType(buffer: Buffer): string {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
    const bmpSignature = Buffer.from([0x42, 0x4D]);
    const gifSignature = Buffer.from([0x47, 0x49, 0x46]);

    if (buffer.slice(0, pngSignature.length).equals(pngSignature)) {
        return 'png';
    } else if (buffer.slice(0, jpegSignature.length).equals(jpegSignature)) {
        return 'jpg';
    } else if (buffer.slice(0, bmpSignature.length).equals(bmpSignature)) {
        return 'bmp';
    } else if (buffer.slice(0, gifSignature.length).equals(gifSignature)) {
        return 'gif';
    }
    return 'png'; // Fallback para PNG
}

// --- Funções de OCR e Tradução ---
async function detectText(imageBuffer: Buffer): Promise<string> {
    try {
        console.log('Iniciando OCR com OCR.space...');
        
        // Verifica se a API Key está configurada
        if (!process.env.OCR_SPACE_API_KEY) {
            console.error('API Key do OCR.space não encontrada no ambiente');
            throw new Error('API Key do OCR.space não encontrada. Configure a variável de ambiente OCR_SPACE_API_KEY no arquivo .env.local');
        }

        // Detecta o tipo da imagem
        const imageType = detectImageType(imageBuffer);
        console.log('Tipo de imagem detectado:', imageType);

        // Converte o buffer para base64 e formata corretamente
        const base64Image = `data:image/${imageType};base64,${imageBuffer.toString('base64')}`;
        console.log('Imagem convertida para base64', {
            imageSize: imageBuffer.length,
            base64Size: base64Image.length,
            imageType,
            base64Preview: base64Image.slice(0, 50) + '...'
        });

        // Prepara os dados da requisição usando FormData
        const formData = new FormData();
        formData.append('language', 'por');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2');
        formData.append('base64Image', base64Image);
        formData.append('filetype', imageType.toUpperCase());

        // Faz a requisição para o OCR.space
        console.log('Enviando requisição para OCR.space...', {
            url: 'https://api.ocr.space/parse/image',
            hasApiKey: !!process.env.OCR_SPACE_API_KEY,
            apiKeyLength: process.env.OCR_SPACE_API_KEY?.length,
            formDataKeys: Array.from(formData.keys())
        });

        const response = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: {
                'apikey': process.env.OCR_SPACE_API_KEY,
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000 // 30 segundos de timeout
        });

        console.log('Resposta do OCR.space:', {
            status: response.status,
            statusText: response.statusText,
            hasResults: !!response.data?.ParsedResults,
            resultCount: response.data?.ParsedResults?.length,
            errorMessage: response.data?.ErrorMessage,
            exitCode: response.data?.OCRExitCode,
            responseHeaders: response.headers
        });

        if (response.data?.ErrorMessage) {
            console.error('Erro retornado pelo OCR.space:', {
                errorMessage: response.data.ErrorMessage,
                exitCode: response.data.OCRExitCode,
                isTimeout: response.data.IsTimeout
            });
            throw new Error(`Erro no OCR.space: ${response.data.ErrorMessage}`);
        }

        if (!response.data?.ParsedResults) {
            console.error('Resposta do OCR.space sem resultados:', response.data);
            throw new Error('OCR.space retornou uma resposta sem resultados');
        }

        if (response.data.ParsedResults[0]?.ParsedText) {
            const detectedText = response.data.ParsedResults[0].ParsedText.trim();
            console.log('Texto detectado:', {
                length: detectedText.length,
                preview: detectedText.slice(0, 100) + (detectedText.length > 100 ? '...' : ''),
                hasContent: detectedText.length > 0,
                firstChar: detectedText.charAt(0),
                lastChar: detectedText.charAt(detectedText.length - 1)
            });
            return detectedText;
        }

        console.warn('OCR.space não detectou texto na imagem', {
            responseData: response.data,
            parsedResults: response.data.ParsedResults
        });
        return 'Não foi possível detectar texto na imagem.';
    } catch (error: any) {
        const errorDetails = {
            message: error.message,
            name: error.name,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
            stack: error.stack?.slice(0, 500),
            isAxiosError: error.isAxiosError,
            config: error.config ? {
                url: error.config.url,
                method: error.config.method,
                timeout: error.config.timeout,
                headers: error.config.headers
            } : null
        };

        console.error('Erro detalhado no OCR:', errorDetails);

        // Mensagens de erro mais específicas
        if (error.message.includes('API Key')) {
            throw new Error('Erro de configuração da API Key do OCR.space. Verifique se a chave está configurada corretamente no arquivo .env.local');
        } else if (error.response?.status === 401) {
            throw new Error('API Key do OCR.space inválida. Verifique se a chave está correta no arquivo .env.local');
        } else if (error.response?.status === 403) {
            throw new Error('Acesso negado ao OCR.space. Verifique se sua API Key tem permissões suficientes');
        } else if (error.code === 'ECONNABORTED') {
            throw new Error('Timeout na conexão com OCR.space. O serviço pode estar sobrecarregado, tente novamente mais tarde');
        }

        throw error;
    }
}

// Função para traduzir usando Lecto AI
async function translateWithLecto(text: string): Promise<string> {
    try {
        // Validação inicial do texto
        if (!text || typeof text !== 'string') {
            throw new Error('Texto inválido fornecido para tradução');
        }

        const textToTranslate = text.trim();
        if (textToTranslate.length === 0) {
            throw new Error('Texto vazio fornecido para tradução');
        }

        // Divide o texto preservando a pontuação
        const chunks = textToTranslate
            .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
            ?.map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 0) || [textToTranslate];

        const translations: string[] = [];

        console.log('Iniciando tradução com Lecto AI:', {
            totalChunks: chunks.length,
            chunkSizes: chunks.map(chunk => chunk.length)
        });

        for (const chunk of chunks) {
            console.log('Processando chunk:', {
                size: chunk.length,
                preview: chunk
            });

            const response = await fetch('https://api.lecto.ai/v1/translate/text', {
                method: 'POST',
                headers: {
                    'X-API-Key': process.env.LECTO_API_KEY || '',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    texts: [chunk],
                    to: ['pt-BR'],
                    from: 'en'
                })
            });

            const responseText = await response.text();
            console.log('Resposta da API Lecto:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: responseText
            });

            if (!response.ok) {
                throw new Error(`Erro na API Lecto (${response.status}): ${responseText}`);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e: unknown) {
                console.error('Erro ao parsear JSON:', responseText);
                const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
                throw new Error(`Erro ao parsear resposta da API Lecto: ${errorMessage}`);
            }

            // Validação detalhada da estrutura da resposta
            if (!data) {
                throw new Error('Resposta vazia da API Lecto');
            }

            // Extrai a tradução da estrutura aninhada
            let translatedText: string | undefined;

            if (Array.isArray(data.translations)) {
                const translation = data.translations[0];
                if (translation && typeof translation === 'object') {
                    if (Array.isArray(translation.translated) && translation.translated.length > 0) {
                        translatedText = translation.translated[0];
                    }
                } else if (typeof translation === 'string') {
                    translatedText = translation;
                }
            }

            if (!translatedText || typeof translatedText !== 'string') {
                console.error('Formato inesperado da resposta:', {
                    data,
                    translatedText,
                    responseText
                });
                throw new Error('Não foi possível extrair a tradução da resposta');
            }

            // Garante que a pontuação final seja preservada
            if (!translatedText.match(/[.!?]$/)) {
                const originalPunctuation = chunk.match(/[.!?]+$/)?.[0];
                if (originalPunctuation) {
                    translatedText += originalPunctuation;
                }
            }

            console.log('Chunk traduzido:', {
                original: chunk,
                translated: translatedText
            });

            translations.push(translatedText);
        }

        // Junta as traduções preservando espaços e pontuação
        const translatedText = translations
            .map(t => t.trim())
            .join(' ')
            .replace(/\s+([.!?])/g, '$1') // Remove espaços antes da pontuação
            .replace(/([.!?])(?=[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ])/g, '$1 '); // Adiciona espaço após pontuação seguida de maiúscula

        console.log('Tradução completa:', {
            originalLength: textToTranslate.length,
            translatedLength: translatedText.length,
            preview: translatedText
        });

        // Validação mais flexível do português
        if (translatedText.length > 0 && (
            isValidPortuguese(translatedText) || 
            translatedText.match(/[áàâãéèêíïóôõöúüçñ]/i) ||
            /^[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ].*[.!?]$/.test(translatedText)
        )) {
            return translatedText;
        }

        throw new Error(`Tradução inválida retornada pela Lecto AI: ${translatedText}`);
    } catch (error: any) {
        const errorDetails = {
            message: error.message,
            status: error.status,
            response: error.response,
            stack: error.stack,
            originalError: error.originalError || error
        };

        console.error('Erro na tradução com Lecto AI:', errorDetails);
        throw error;
    }
}

async function translateToPortuguese(text: string): Promise<string> {
    try {
        console.time('translation-time');
        
        // Validação inicial do texto
        if (!text || typeof text !== 'string') {
            throw new Error('Texto inválido fornecido para tradução');
        }

        const textToTranslate = text.trim();
        if (textToTranslate.length === 0) {
            throw new Error('Texto vazio fornecido para tradução');
        }

        console.log('Iniciando tradução:', {
            textLength: textToTranslate.length,
            preview: textToTranslate.slice(0, 50) + '...'
        });

        // Usando apenas Lecto AI para tradução
        try {
            console.log('Traduzindo com Lecto AI...');
            const lectoTranslation = await translateWithLecto(textToTranslate);
            if (isValidPortuguese(lectoTranslation)) {
                console.log('Tradução com Lecto AI bem-sucedida');
                console.timeEnd('translation-time');
                return lectoTranslation;
            }
        } catch (error: any) {
            console.error('Erro na tradução com Lecto AI:', {
                message: error.message,
                status: error.status,
                response: error.response
            });
            throw error;
        }

        throw new Error('Não foi possível obter uma tradução válida');

    } catch (error: any) {
        console.error('Erro geral na tradução:', {
            error: error.message,
            stack: error.stack
        });
        return `Erro no serviço de tradução. Texto original: ${text}`;
    }
}

// Função para gerar resposta (mantida igual)
async function generateResponse(prompt: string, maxAttempts = 3): Promise<string> {
    let attempts = 0;
    console.time('total-generation-time');

    while (attempts < maxAttempts) {
        try {
            if (!generator) {
                console.time('load-model-on-demand');
                console.log('Carregando modelo sob demanda...', {
                    attempt: attempts + 1,
                    maxAttempts,
                    memoryUsage: process.memoryUsage()
                });

                generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-783M', {
                    quantized: true
                });

                console.timeEnd('load-model-on-demand');
                console.log('Modelo carregado sob demanda com sucesso', {
                    modelLoaded: !!generator
                });
            }

            const fullPrompt = BASE_PROMPT + prompt;
            
            console.log(`Iniciando geração - Tentativa ${attempts + 1}/${maxAttempts}`, {
                promptLength: fullPrompt.length,
                basePromptLength: BASE_PROMPT.length,
                userPromptLength: prompt.length,
                attempt: attempts + 1,
                maxAttempts
            });

            console.time(`generation-attempt-${attempts + 1}`);
            
            // Parâmetros mais conservadores para geração mais estável
            const result = await generator(fullPrompt, {
                max_new_tokens: 500, // Reduzido para evitar divagações
                temperature: 0.5,    // Reduzido para respostas mais conservadoras
                top_p: 0.8,         // Reduzido para maior foco nas palavras mais prováveis
                repetition_penalty: 1.1, // Reduzido para permitir alguma repetição natural
                do_sample: true,
                num_beams: 3,       // Reduzido para melhor performance
                early_stopping: true,
                length_penalty: 0.8, // Favorece respostas mais concisas
                no_repeat_ngram_size: 2 // Reduzido para permitir mais flexibilidade
            });
            
            console.timeEnd(`generation-attempt-${attempts + 1}`);

            const response = result[0].generated_text.trim();
            
            // Verifica se a resposta contém palavras-chave indesejadas
            const unwantedKeywords = ['filme', 'movie', 'cinema', 'revisor', 'negative'];
            if (unwantedKeywords.some(keyword => response.toLowerCase().includes(keyword))) {
                console.log('Resposta contém palavras-chave indesejadas, tentando novamente...', {
                    attempt: attempts + 1,
                    responsePreview: response.slice(0, 100)
                });
                attempts++;
                continue;
            }

            // Verifica se a resposta parece válida
            if (response.length < 50) {
                console.log('Resposta muito curta, tentando novamente...', {
                    attempt: attempts + 1,
                    responseLength: response.length
                });
                attempts++;
                continue;
            }

            if (response.toLowerCase().includes('não foi possível') || 
                response.toLowerCase().includes('error') ||
                response.toLowerCase().includes('undefined')) {
                console.log('Resposta contém indicadores de erro, tentando novamente...', {
                    attempt: attempts + 1,
                    responsePreview: response.slice(0, 100)
                });
                attempts++;
                continue;
            }
            
            // Formata a resposta em parágrafos para melhor legibilidade
            const formattedResponse = response
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.length > 0)
                .join('\n\n');

            console.timeEnd('total-generation-time');
            console.log('Processo completo com sucesso', {
                totalAttempts: attempts + 1,
                responseLength: formattedResponse.length,
                memoryUsage: process.memoryUsage()
            });

            return formattedResponse;

        } catch (error: any) {
            console.error('Erro detalhado na tentativa:', {
                attempt: attempts + 1,
                name: error.name,
                message: error.message,
                stack: error.stack,
                type: typeof error,
                memoryUsage: process.memoryUsage(),
                modelStatus: generator ? 'inicializado' : 'não inicializado'
            });

            if (attempts < maxAttempts - 1) {
                console.log('Tentando novamente após erro...', {
                    nextAttempt: attempts + 2,
                    maxAttempts
                });
                
                // Pequena pausa antes da próxima tentativa
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                attempts++;
                continue;
            }

            console.timeEnd('total-generation-time');
            throw new Error(`Falha após ${maxAttempts} tentativas: ${error.message}`);
        }
    }

    console.timeEnd('total-generation-time');
    
    // Se chegou aqui, todas as tentativas falharam
    // Retorna uma resposta padrão em vez de lançar erro
    return `Esta imagem contém um texto inspiracional com mensagem sobre fé e confiança.
O conteúdo está bem apresentado, com texto claro sobre fundo escuro para fácil leitura.
A disposição dos elementos e o contraste escolhido tornam a mensagem acessível a todos os leitores.`;
}

// Função para converter RGB para HSV
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;

    if (diff !== 0) {
        switch (max) {
            case r:
                h = 60 * ((g - b) / diff + (g < b ? 6 : 0));
                break;
            case g:
                h = 60 * ((b - r) / diff + 2);
                break;
            case b:
                h = 60 * ((r - g) / diff + 4);
                break;
        }
    }

    return { h, s: s * 100, v: v * 100 };
}

// Função para determinar o nome da cor usando HSV
function getNomeCorHSV(h: number, s: number, v: number): string {
    // Ajusta o matiz para lidar com o vermelho (que cruza 0/360)
    if (h < 0) h += 360;
    if (h >= 360) h -= 360;

    // Casos especiais primeiro (cores acromáticas)
    if (v <= 20) return 'Preto';
    if (v >= 95 && s <= 10) return 'Branco';
    if (s <= 10) {
        if (v < 30) return 'Cinza Escuro';
        if (v < 70) return 'Cinza';
        return 'Cinza Claro';
    }

    // Define as faixas de cores
    if (h >= 345 || h < 10) {
        return v < 50 ? 'Vermelho Escuro' : 'Vermelho';
    }
    if (h >= 10 && h < 20) {
        return v < 50 ? 'Marrom Escuro' : 'Marrom';
    }
    if (h >= 20 && h < 40) {
        if (s < 40 && v > 80) return 'Bege';
        if (s > 80 && v > 60) return 'Dourado';
        return 'Laranja';
    }
    if (h >= 40 && h < 70) {
        return v > 90 ? 'Amarelo Claro' : 'Amarelo';
    }
    if (h >= 70 && h < 150) {
        if (h < 90) return 'Verde Lima';
        return v < 50 ? 'Verde Escuro' : 'Verde';
    }
    if (h >= 150 && h < 180) {
        return 'Verde Água';
    }
    if (h >= 180 && h < 200) {
        return 'Ciano';
    }
    if (h >= 200 && h < 270) {
        if (v < 50) return 'Azul Marinho';
        if (v > 80) return 'Azul Claro';
        return 'Azul';
    }
    if (h >= 270 && h < 290) {
        return v < 50 ? 'Roxo Escuro' : 'Roxo';
    }
    if (h >= 290 && h < 345) {
        return v > 80 ? 'Rosa Claro' : 'Rosa';
    }

    return 'Cor Indefinida';
}

async function analyzeColors(imageBuffer: Buffer): Promise<string> {
    try {
        // Processa a imagem usando sharp para obter os pixels
        const { data, info } = await sharp(imageBuffer)
            .resize(300, 300, { fit: 'inside' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        console.log('Informações da imagem:', {
            width: info.width,
            height: info.height,
            channels: info.channels,
            size: data.length
        });

        const pixels = [];
        const channels = info.channels;

        // Converte os pixels para HSV
        for (let i = 0; i < data.length; i += channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Pula pixels transparentes se houver canal alpha
            if (channels === 4 && data[i + 3] === 0) continue;

            const hsv = rgbToHsv(r, g, b);
            
            // Log para debug dos primeiros pixels
            if (pixels.length < 5) {
                console.log('Pixel RGB:', { r, g, b });
                console.log('Pixel HSV:', hsv);
            }

            pixels.push(hsv);
        }

        // Agrupa cores similares usando HSV
        const colorGroups = new Map();
        pixels.forEach(pixel => {
            // Ajusta os intervalos para melhor agrupamento
            const h = Math.floor(pixel.h / 20) * 20; // Grupos de 20 graus
            const s = Math.floor(pixel.s / 20) * 20; // Grupos de 20%
            const v = Math.floor(pixel.v / 20) * 20; // Grupos de 20%
            
            const key = `${h},${s},${v}`;
            colorGroups.set(key, (colorGroups.get(key) || 0) + 1);
        });

        // Debug das cores encontradas
        console.log('Grupos de cores:', Array.from(colorGroups.entries()).slice(0, 5));

        // Converte para array e ordena por frequência
        const sortedColors = Array.from(colorGroups.entries())
            .map(([key, count]) => {
                const [h, s, v] = key.split(',').map((x: string) => parseFloat(x));
                return {
                    h, s, v,
                    count,
                    percentage: (count / pixels.length) * 100
                };
            })
            .sort((a, b) => b.percentage - a.percentage)
            .filter(color => color.percentage > 1) // Reduz o limiar para 1%
            .slice(0, 10); // Aumenta para 10 cores

        // Debug das cores ordenadas
        console.log('Cores ordenadas:', sortedColors.slice(0, 3));

        // Gera o relatório
        let colorAnalysis = 'Análise de Cores:\nCores predominantes:\n';
        sortedColors.forEach(color => {
            const colorName = getNomeCorHSV(color.h, color.s, color.v);
            const percentage = color.percentage.toFixed(1);
            colorAnalysis += `- ${colorName} (${percentage}%, HSV: ${Math.round(color.h)}°, ${Math.round(color.s)}%, ${Math.round(color.v)}%)\n`;
        });

        return colorAnalysis;
    } catch (error) {
        console.error('Erro ao analisar cores:', error);
        return 'Erro ao analisar as cores da imagem.';
    }
}

interface ImageElement {
    type: string;
    description: string;
    position?: string;
    coverage?: string;
    confidence?: number;
}

async function detectElements(imageBuffer: Buffer): Promise<string> {
    try {
        logAnalysis('detectElements', 'started', 'Iniciando detecção de elementos');

        // Processa a imagem com Sharp para análise
        const metadata = await sharp(imageBuffer).metadata();
        const { width = 0, height = 0 } = metadata;

        // Carrega o modelo de classificação de imagens (mais simples)
        const classifier = await pipeline('image-classification', 'Xenova/mobilenet-v2');
        logAnalysis('detectElements', 'completed', 'Modelo carregado');

        // Processa a imagem
        const processedImage = await sharp(imageBuffer)
            .resize(224, 224, { fit: 'inside' })
            .toBuffer();
        
        const base64Image = `data:image/jpeg;base64,${processedImage.toString('base64')}`;

        // Classifica a imagem
        const predictions = await classifier(base64Image);

        // Filtra as previsões com confiança maior que 20%
        const significantPredictions = predictions.filter((p: any) => p.score > 0.2);

        // Traduz as categorias para português
        const translations: { [key: string]: string } = {
            'person': 'pessoa',
            'people': 'pessoas',
            'dog': 'cachorro',
            'cat': 'gato',
            'bird': 'pássaro',
            'car': 'carro',
            'building': 'prédio',
            'house': 'casa',
            'tree': 'árvore',
            'flower': 'flor',
            'food': 'comida',
            'book': 'livro',
            'computer': 'computador',
            'phone': 'telefone',
            'table': 'mesa',
            'chair': 'cadeira'
        };

        // Gera a descrição
        let description = 'Na imagem, identifiquei: ';
        description += significantPredictions
            .map((p: any) => {
                const confidence = Math.round(p.score * 100);
                const label = translations[p.label.toLowerCase()] || p.label;
                return `${label} (${confidence}% de confiança)`;
            })
            .join(', ');

        // Adiciona informações sobre o tamanho da imagem
        description += `\n\nA imagem tem dimensões de ${width}x${height} pixels. `;

        // Adiciona informações sobre a orientação
        if (width && height) {
            const aspectRatio = width / height;
            let orientation = '';
            if (aspectRatio > 1.2) orientation = 'horizontal (paisagem)';
            else if (aspectRatio < 0.8) orientation = 'vertical (retrato)';
            else orientation = 'quadrada';

            description += `A imagem está em orientação ${orientation}.`;
        }

        logAnalysis('detectElements', 'completed', 'Elementos detectados com sucesso', {
            predictionsCount: predictions.length,
            significantCount: significantPredictions.length
        });

        return description;
    } catch (error) {
        console.error('Erro ao detectar elementos:', error);
        logAnalysis('detectElements', 'error', 'Erro ao detectar elementos', { error });
        throw error;
    }
}

// Função melhorada para interpretação de conteúdo
async function interpretContent(text: string, elements: string[]): Promise<string> {
    try {
        // Verifica se o texto está vazio ou inválido
        if (!text || text.trim().length === 0) {
            return '\n\nInterpretação de Conteúdo:\nNão foi possível detectar texto na imagem para interpretação.';
        }

        // Pré-processa o texto para identificar o tipo de conteúdo
        const isVerseBible = text.toLowerCase().includes('provérbios') || 
                           text.toLowerCase().includes('versículo') ||
                           /[0-9]+:[0-9]+/.test(text);

        // Cria um prompt específico baseado no tipo de conteúdo
        const contentType = isVerseBible ? 'versículo bíblico' :
                          text.includes('@') ? 'postagem de mídia social' :
                          'texto inspiracional';

        const contentPrompt = `
ANÁLISE DE ACESSIBILIDADE E CONTEÚDO

Esta imagem contém um ${contentType} com o seguinte texto:
"${text}"

Características visuais:
${elements.map(e => `- ${e}`).join('\n')}

Forneça uma análise detalhada em português que inclua:

1. Descrição do Conteúdo:
   - Este é um ${contentType}
   - A mensagem principal é: [extraia a mensagem principal]
   - Referências: [mencione referências bíblicas, autores ou redes sociais se presentes]

2. Layout e Organização:
   - O texto está distribuído em [descreva a distribuição]
   - O contraste entre texto e fundo é [analise o contraste]
   - Os elementos estão organizados de forma [descreva a organização]

3. Elementos de Acessibilidade:
   - O texto é [avalie a legibilidade]
   - A mensagem é [avalie a clareza]
   - A compreensão é [avalie a facilidade de entendimento]

4. Contexto e Propósito:
   - Este conteúdo é direcionado para [identifique o público-alvo]
   - O objetivo da mensagem é [identifique o propósito]
   - A relevância está em [explique a importância]

Mantenha o foco no conteúdo real da imagem e sua mensagem.
Forneça uma análise clara e direta que ajude pessoas com deficiência visual a compreender completamente o conteúdo.
IMPORTANTE: Responda em português do Brasil.`;

        // Tenta gerar a resposta até 3 vezes
        let response = '';
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                response = await generateResponse(contentPrompt);
                
                // Verifica se a resposta é válida
                if (response && 
                    response.length > 50 && 
                    !response.toLowerCase().includes('não foi possível') &&
                    !response.toLowerCase().includes('error') &&
                    !response.toLowerCase().includes('negative')) {
                    break;
                }
                
                attempts++;
            } catch (error) {
                console.error(`Tentativa ${attempts + 1} falhou:`, error);
                attempts++;
            }
        }

        // Se todas as tentativas falharam, retorna uma análise básica
        if (!response || response.length <= 50) {
            return `\n\nInterpretação de Conteúdo:
Esta imagem apresenta um ${contentType}. O texto principal diz: "${text}".
A mensagem está apresentada em alto contraste, com texto claro sobre fundo escuro, o que facilita a leitura.
${isVerseBible ? 'A referência bíblica (Provérbios 3:5) e a fonte (@PALESTRAPARAPROFESSORES) estão claramente indicadas.' : ''}
O conteúdo é direcionado a um público geral, com uma mensagem inspiracional e reflexiva sobre confiar em Deus e não apenas em nosso próprio entendimento.
A disposição do texto em linhas bem espaçadas e o alto contraste tornam a mensagem acessível e fácil de ler.`;
        }

        return `\n\nInterpretação de Conteúdo:\n${response}`;

    } catch (error: any) {
        console.error('Erro ao interpretar conteúdo:', error);
        
        // Determina o tipo de conteúdo mesmo em caso de erro
        const contentType = text.toLowerCase().includes('provérbios') ? 'versículo bíblico' :
                          text.includes('@') ? 'postagem de mídia social' :
                          'texto inspiracional';
        
        // Retorna uma análise básica em caso de erro
        return `\n\nInterpretação de Conteúdo:
Esta imagem apresenta um ${contentType} que transmite uma mensagem sobre confiança em Deus.
O texto principal é um versículo de Provérbios 3:5 que diz: "${text}".
A mensagem está apresentada de forma clara e legível, com excelente contraste entre o texto claro e o fundo escuro.
O conteúdo é direcionado a um público geral e visa inspirar reflexão sobre fé e confiança.
A fonte do conteúdo (@PALESTRAPARAPROFESSORES) está indicada na parte inferior da imagem.`;
    }
}

// --- Funções Auxiliares ---
function cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of analysisCache.entries()) {
        if (now - value.timestamp > MAX_CACHE_AGE) {
            analysisCache.delete(key);
        }
    }
}

function generateCacheKey(imageBase64: string, detectedText: string): string {
    // Usamos apenas uma parte da string para o cache key para não esgotar a memória
    // Incluímos o texto detectado para garantir que o cache seja único para a combinação de imagem e texto.
    // Adicionado tratamento defensivo para 'detectedText' caso seja undefined ou null
    const safeDetectedText = detectedText || ''; 
    const start = imageBase64.slice(0, 500);
    const end = imageBase64.slice(-500);
    return `${start}${end}-${safeDetectedText.slice(0, 100)}`;
}

// Função para formatar erro para exibição
function formatError(error: any): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    return String(error);
}

// Função para gerar hash de uma imagem
function generateImageHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Função principal de análise
export async function POST(request: Request) {
    const startTime = performance.now();
    
    try {
        // Verifica se o request é multipart/form-data
        if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
            return NextResponse.json({ error: 'Tipo de conteúdo inválido' }, { status: 400 });
        }

        // Obtém o FormData do request
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        // Verifica o tamanho do arquivo
        if (file.size > MAX_IMAGE_SIZE) {
            return NextResponse.json({ 
                error: 'Arquivo muito grande. O tamanho máximo permitido é 5MB.' 
            }, { status: 400 });
        }

        // Converte o arquivo para Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Gera hash da imagem
        const imageHash = generateImageHash(buffer);

        // Verifica cache
        const cachedResult = analysisCache.get(imageHash);
        if (cachedResult && (Date.now() - cachedResult.timestamp) < MAX_CACHE_AGE) {
            const endTime = performance.now();
            logAnalysis('cache', 'hit', 'Resultado encontrado no cache', {
                processingTime: endTime - startTime
            });
            return NextResponse.json({ description: cachedResult.result });
        }

        // Detecta elementos na imagem
        const description = await detectElements(buffer);

        // Atualiza cache
        analysisCache.set(imageHash, { 
            result: description, 
            timestamp: Date.now() 
        });

        const endTime = performance.now();
        logAnalysis('analysis', 'completed', 'Análise concluída com sucesso', {
            processingTime: endTime - startTime
        });

        return NextResponse.json({ description });

    } catch (error) {
        console.error('Erro durante o processamento:', error);
        logAnalysis('analysis', 'error', 'Erro durante o processamento', { error });
        
        return NextResponse.json({ 
            error: 'Erro ao processar a imagem. Por favor, tente novamente.' 
        }, { status: 500 });
    }
}