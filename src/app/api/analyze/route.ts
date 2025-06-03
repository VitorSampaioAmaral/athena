import { NextResponse } from 'next/server';
import axios from 'axios';
import sharp from 'sharp';
import { pipeline } from '@xenova/transformers';

// Cache para armazenar resultados de análises similares
const analysisCache = new Map<string, { result: string; timestamp: number }>();
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB em bytes

// Cache para o modelo e prompt base
let generator: any = null;
const BASE_PROMPT = 'You are an expert in analyzing images. ' +
                   'Analyze the following content and provide a detailed interpretation:\n\n';

// Configuração do ambiente ONNX Runtime
process.env.ONNXRUNTIME_LOG_LEVEL = '3'; // 3 = ERROR, ignora warnings
process.env.ONNXRUNTIME_LOG_VERBOSITY_LEVEL = '0'; // Minimiza verbosidade

// Função para verificar se o texto está em português válido
function isValidPortuguese(text: string): boolean {
  // Lista de palavras comuns em português
  const commonPortugueseWords = ['de', 'o', 'a', 'os', 'as', 'um', 'uma', 'e', 'que', 'para', 'em', 'com', 'não', 'por', 'mais'];
  
  // Verifica se pelo menos 30% das palavras são palavras comuns em português
  const words = text.toLowerCase().split(/\s+/);
  const commonWordsFound = words.filter(word => commonPortugueseWords.includes(word));
  const ratio = commonWordsFound.length / words.length;
  
  // Verifica caracteres especiais do português
  const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
  
  // Verifica estrutura básica de frase em português
  const hasValidStructure = /^[A-ZÀÁÂÃÉÈÊÍÏÓÔÕÖÚÜÇ].*[.!?]$/.test(text.trim());
  
  return ratio >= 0.15 && (hasPortugueseChars || hasValidStructure);
}

// Função para verificar se o texto está em inglês
function isEnglish(text: string): boolean {
  // Lista de palavras comuns em inglês
  const commonEnglishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at'];
  
  // Verifica se pelo menos 20% das palavras são palavras comuns em inglês
  const words = text.toLowerCase().split(/\s+/);
  const commonWordsFound = words.filter(word => commonEnglishWords.includes(word));
  const ratio = commonWordsFound.length / words.length;
  
  // Verifica se não tem caracteres especiais do português
  const hasPortugueseChars = /[áàâãéèêíïóôõöúüçñ]/i.test(text);
  
  return ratio >= 0.1 && !hasPortugueseChars;
}

// Função para traduzir texto usando múltiplas APIs gratuitas
async function translateToPortuguese(text: string): Promise<string> {
  try {
    console.time('translation-time');
    console.log('Iniciando tradução:', {
      textLength: text.length,
      preview: text.slice(0, 50) + '...'
    });

    let translations: string[] = [];

    // Tenta com MyMemory
    try {
      const myMemoryResponse = await axios.get('https://api.mymemory.translated.net/get', {
        params: {
          q: text,
          langpair: 'en|pt-BR',
          de: 'admin@athena.com' // Email para maior quota
        }
      });

      if (myMemoryResponse.data.responseStatus === 200) {
        const translatedText = myMemoryResponse.data.responseData.translatedText;
        if (isValidPortuguese(translatedText)) {
          translations.push(translatedText);
        }
      }
    } catch (error: any) {
      console.log('MyMemory falhou:', error.message);
    }

    // Tenta com Lingva
    try {
      const lingvaResponse = await axios.get('https://lingva.ml/api/v1/en/pt', {
        params: { text }
      });

      if (lingvaResponse.data.translation) {
        const translatedText = lingvaResponse.data.translation;
        if (isValidPortuguese(translatedText)) {
          translations.push(translatedText);
        }
      }
    } catch (error: any) {
      console.log('Lingva falhou:', error.message);
    }

    // Se temos traduções válidas, escolhe a melhor
    if (translations.length > 0) {
      // Ordena por comprimento (geralmente traduções muito curtas ou muito longas são problemáticas)
      translations.sort((a, b) => {
        const aRatio = a.length / text.length;
        const bRatio = b.length / text.length;
        return Math.abs(1 - aRatio) - Math.abs(1 - bRatio);
      });

      const bestTranslation = translations[0];
      console.log('Melhor tradução selecionada:', {
        originalLength: text.length,
        translatedLength: bestTranslation.length,
        preview: bestTranslation.slice(0, 50) + '...',
        totalTranslations: translations.length
      });

      console.timeEnd('translation-time');
      return bestTranslation;
    }

    // Se nenhuma tradução foi bem-sucedida, retorna mensagem de erro
    console.error('Nenhuma tradução válida foi obtida');
    return 'Não foi possível obter uma tradução válida. Texto original em inglês: ' + text;

  } catch (error: any) {
    console.error('Erro geral na tradução:', {
      error: error.message,
      stack: error.stack
    });
    return 'Erro no serviço de tradução. A resposta original em inglês é: ' + text;
  }
}

// Função para traduzir para inglês
async function translateToEnglish(text: string): Promise<string> {
  try {
    console.time('english-translation-time');
    console.log('Traduzindo para inglês:', {
      textLength: text.length,
      preview: text.slice(0, 50) + '...'
    });

    // Tenta com MyMemory
    try {
      const response = await axios.get('https://api.mymemory.translated.net/get', {
        params: {
          q: text,
          langpair: 'pt|en',
          de: 'admin@athena.com'
        }
      });

      if (response.data.responseStatus === 200) {
        const translatedText = response.data.responseData.translatedText;
        if (isEnglish(translatedText)) {
          console.timeEnd('english-translation-time');
          return translatedText;
        }
      }
    } catch (error: any) {
      console.log('MyMemory falhou na tradução para inglês:', error.message);
    }

    // Tenta com Lingva
    try {
      const response = await axios.get('https://lingva.ml/api/v1/pt/en', {
        params: { text }
      });

      if (response.data.translation) {
        const translatedText = response.data.translation;
        if (isEnglish(translatedText)) {
          console.timeEnd('english-translation-time');
          return translatedText;
        }
      }
    } catch (error: any) {
      console.log('Lingva falhou na tradução para inglês:', error.message);
    }

    console.timeEnd('english-translation-time');
    throw new Error('Não foi possível traduzir para inglês');
  } catch (error: any) {
    console.error('Erro na tradução para inglês:', error);
    throw error;
  }
}

// Função para gerar resposta
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
      const result = await generator(fullPrompt, {
        max_new_tokens: 256,
        temperature: 0.3,
        top_p: 0.95,
        repetition_penalty: 1.2,
        do_sample: true,
        num_beams: 5,
        early_stopping: true
      });
      console.timeEnd(`generation-attempt-${attempts + 1}`);

      const response = result[0].generated_text.trim();
      
      console.log('Resposta gerada, iniciando tradução...', {
        attempt: attempts + 1,
        responseLength: response.length,
        firstChars: response.slice(0, 50) + '...'
      });

      // Traduz a resposta para português
      const translatedResponse = await translateToPortuguese(response);

      console.timeEnd('total-generation-time');
      console.log('Processo completo com sucesso', {
        totalAttempts: attempts + 1,
        originalLength: response.length,
        translatedLength: translatedResponse.length,
        memoryUsage: process.memoryUsage()
      });

      return translatedResponse;

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
        attempts++;
        continue;
      }

      console.timeEnd('total-generation-time');
      throw new Error(`Falha após ${maxAttempts} tentativas: ${error.message}`);
    }
  }

  console.timeEnd('total-generation-time');
  throw new Error('Número máximo de tentativas excedido');
}

function cleanOldCache() {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > MAX_CACHE_AGE) {
      analysisCache.delete(key);
    }
  }
}

function generateCacheKey(imageBase64: string): string {
  // Pega apenas os primeiros e últimos 1000 caracteres para comparação
  const start = imageBase64.slice(0, 1000);
  const end = imageBase64.slice(-1000);
  return `${start}${end}`;
}

async function detectText(imageBase64: string): Promise<string> {
  try {
    interface OCRResult {
      ParsedText: string;
      TextOverlay?: {
        Lines: Array<{
          Words: Array<{
            Confidence: number;
          }>;
        }>;
      };
      FileParseExitCode: number;
    }

    interface TextResult {
      text: string;
      confidence: number;
      language: string;
    }

    interface ProcessedResult extends TextResult {
      normalizedText: string;
      type: string;
    }

    interface GroupedResults {
      [key: string]: ProcessedResult[];
    }

    // Função auxiliar para tentar diferentes preprocessamentos
    async function tryOCR(preprocessing: string, bufferBase64: string) {
      const formData = new FormData();
      formData.append('base64Image', `data:image/png;base64,${bufferBase64}`);
      formData.append('language', 'por,eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2');
      formData.append('filetype', 'png');
      formData.append('isTable', 'false');
      formData.append('ocrParams', JSON.stringify({
        language: 'por,eng',
        detectOrientation: true,
        scale: true,
        fastMode: false,
        preprocessing
      }));
      return axios.post('https://api.ocr.space/parse/image', formData, {
        headers: {
          'apikey': 'helloworld',
          'Content-Type': 'multipart/form-data'
        }
      });
    }

    // Pré-processamentos com sharp
    const originalBuffer = Buffer.from(imageBase64, 'base64');
    const grayBuffer = await sharp(originalBuffer).grayscale().toBuffer();
    // Aumenta contraste: linear(contraste, brilho) - valores ajustáveis
    const contrastBuffer = await sharp(originalBuffer).linear(1.4, -30).toBuffer();
    const invertBuffer = await sharp(originalBuffer).negate().toBuffer();

    // Tenta diferentes combinações de imagem e preprocessamento do OCR
    const buffersToTry = [
      { buffer: imageBase64, desc: 'original' },
      { buffer: grayBuffer.toString('base64'), desc: 'grayscale' },
      { buffer: contrastBuffer.toString('base64'), desc: 'contraste' },
      { buffer: invertBuffer.toString('base64'), desc: 'invertido' }
    ];
    const preprocessings = ['Advanced', 'Default', 'None'];

    let ocrResponse = null;
    let foundText = false;
    for (const { buffer, desc } of buffersToTry) {
      for (const prep of preprocessings) {
        ocrResponse = await tryOCR(prep, buffer);
        if (ocrResponse.data.ParsedResults?.[0]?.ParsedText) {
          foundText = true;
          break;
        }
      }
      if (foundText) break;
    }

    // Se não detectou texto, retorna mensagem especial
    if (!ocrResponse || !ocrResponse.data.ParsedResults?.[0]?.ParsedText) {
      return '__PRESENCA_VISUAL_TEXTO__';
    }

    // Processa os resultados do OCR
    const textResults = ocrResponse.data.ParsedResults
      .map((result: OCRResult): TextResult => {
        const text = result.ParsedText.trim();
        let confidence = 0;

        if (result.TextOverlay?.Lines) {
          const lines = result.TextOverlay.Lines;
          let totalConfidence = 0;
          let wordCount = 0;

          lines.forEach((line: { Words: Array<{ Confidence: number }> }) => {
            line.Words.forEach((word: { Confidence: number }) => {
              totalConfidence += word.Confidence;
              wordCount++;
            });
          });

          confidence = wordCount > 0 ? totalConfidence / wordCount : 0;
        }

        return {
          text,
          confidence,
          language: result.FileParseExitCode === 1 ? 'por' : 'eng'
        };
      })
      .filter((result: TextResult) => result.text.length > 0);

    if (textResults.length === 0) {
      return 'Não foi possível detectar texto na imagem.';
    }

    // Função para limpar e normalizar o texto
    function normalizeText(text: string): string {
      return text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[^\S\r\n]+/g, ' ')
        .trim();
    }

    // Função para detectar o tipo de texto de forma mais genérica
    function detectTextType(text: string): string {
      // Verifica se é um versículo bíblico
      if (/[A-Za-zÀ-ÿ]+ \d+:\d+/.test(text)) {
        return 'versículo bíblico';
      }
      
      // Verifica se é uma citação
      if (text.includes('"') || text.includes('"') || text.includes('"')) {
        return 'citação';
      }
      
      // Verifica se é um título
      if (text.length < 50 && /^[A-Z]/.test(text)) {
        return 'título';
      }
      
      // Verifica se é uma frase
      if (/^[A-Z][^.!?]+[.!?]$/.test(text)) {
        return 'frase';
      }
      
      return 'texto';
    }

    // Processa e organiza os resultados
    const processedResults = textResults.map((result: TextResult): ProcessedResult => {
      const normalizedText = normalizeText(result.text);
      return {
        ...result,
        normalizedText,
        type: detectTextType(normalizedText)
      };
    });

    // Agrupa os resultados por tipo
    const groupedResults = processedResults.reduce((acc: GroupedResults, result: ProcessedResult) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    }, {} as GroupedResults);

    // Formata a resposta
    let response = 'Texto detectado:\n\n';

    // Apresenta os resultados em ordem de relevância
    const presentationOrder = [
      'versículo bíblico',
      'citação',
      'título',
      'frase',
      'texto'
    ];

    for (const type of presentationOrder) {
      if (groupedResults[type]?.length > 0) {
        response += `${type.charAt(0).toUpperCase() + type.slice(1)}:\n`;
        groupedResults[type].forEach((result: ProcessedResult) => {
          response += `"${result.normalizedText}"\n`;
          if (result.confidence > 0) {
            response += `(Confiança: ${Math.round(result.confidence)}%)\n`;
          }
        });
        response += '\n';
      }
    }

    return response.trim();
  } catch (error) {
    console.error('Erro ao detectar texto:', error);
    return 'Erro ao processar o texto da imagem.';
  }
}

async function analyzeColors(imageBuffer: Buffer): Promise<string> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Função para converter RGB para HSL
    function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return [h * 360, s * 100, l * 100];
    }

    // Função para identificar cores baseada em HSL
    function getColorName(h: number, s: number, l: number): string[] {
      const colors: string[] = [];

      // Cores acromáticas (preto, branco, cinza)
      if (s < 10) {
        if (l < 15) return ['preto'];
        if (l > 85) return ['branco'];
        if (l > 65) return ['cinza claro'];
        if (l < 35) return ['cinza escuro'];
        return ['cinza médio'];
      }

      // Define os intervalos de matiz para cada cor
      const hueRanges = [
        { name: 'vermelho', start: 355, end: 10 },
        { name: 'vermelho alaranjado', start: 10, end: 20 },
        { name: 'laranja', start: 20, end: 40 },
        { name: 'amarelo', start: 40, end: 65 },
        { name: 'verde amarelado', start: 65, end: 80 },
        { name: 'verde', start: 80, end: 160 },
        { name: 'verde azulado', start: 160, end: 180 },
        { name: 'ciano', start: 180, end: 200 },
        { name: 'azul claro', start: 200, end: 220 },
        { name: 'azul', start: 220, end: 240 },
        { name: 'azul escuro', start: 240, end: 280 },
        { name: 'roxo', start: 280, end: 320 },
        { name: 'magenta', start: 320, end: 330 },
        { name: 'rosa', start: 330, end: 355 }
      ];

      // Encontra a cor base pelo matiz
      let baseColor = '';
      for (const range of hueRanges) {
        if (range.start <= range.end) {
          if (h >= range.start && h < range.end) {
            baseColor = range.name;
            break;
          }
        } else {
          // Para o caso especial do vermelho (355-10)
          if (h >= range.start || h < range.end) {
            baseColor = range.name;
            break;
          }
        }
      }

      // Adiciona modificadores baseados em saturação e luminosidade
      if (baseColor) {
        // Muito escuro (exceto para azul escuro que já indica escuridão)
        if (l < 20 && !baseColor.includes('escuro')) {
          colors.push(baseColor + ' escuro');
        }
        // Muito claro
        else if (l > 80) {
          colors.push(baseColor + ' claro');
        }
        // Cores pastéis (alta luminosidade, baixa saturação)
        else if (l > 70 && s < 50) {
          colors.push(baseColor + ' pastel');
        }
        // Cores vivas (alta saturação)
        else if (s > 80 && l > 45 && l < 65) {
          colors.push(baseColor + ' vivo');
        }
        // Cores profundas (alta saturação, baixa luminosidade)
        else if (s > 70 && l < 45) {
          colors.push(baseColor + ' profundo');
        }
        // Cores suaves (média saturação, alta luminosidade)
        else if (s > 30 && s < 60 && l > 60) {
          colors.push(baseColor + ' suave');
        }
        // Cor normal
        else {
          colors.push(baseColor);
        }

        // Detecta tons terrosos
        if ((baseColor.includes('vermelho') || baseColor.includes('laranja')) && s < 60 && l < 60) {
          colors.push('marrom');
          if (l < 30) colors.push('marrom escuro');
          else if (l > 45) colors.push('marrom claro');
        }

        // Detecta tons dourados
        if (baseColor === 'amarelo' && l > 50 && l < 80 && s > 50) {
          colors.push('dourado');
        }

        // Detecta tons metálicos
        if (s < 20 && l > 60 && l < 80) {
          colors.push('prateado');
        }

        // Detecta tons de bege
        if ((baseColor === 'amarelo' || baseColor === 'laranja') && s < 35 && l > 65) {
          colors.push('bege');
        }

        // Detecta tons de creme
        if (baseColor === 'amarelo' && s < 30 && l > 75) {
          colors.push('creme');
        }
      }

      return colors;
    }

    // Analisa uma amostra de pixels
    const pixels = [];
    const colorFrequency = new Map<string, number>();
    const totalPixels = data.length / info.channels;
    const sampleSize = Math.min(5000, totalPixels);
    const step = Math.floor(totalPixels / sampleSize);

    for (let i = 0; i < data.length; i += info.channels * step) {
      pixels.push({
        r: data[i],
        g: data[i + 1],
        b: data[i + 2]
      });
    }

    // Analisa cada pixel da amostra
    pixels.forEach(pixel => {
      const [h, s, l] = rgbToHsl(pixel.r, pixel.g, pixel.b);
      const colors = getColorName(h, s, l);
      colors.forEach(color => {
        colorFrequency.set(color, (colorFrequency.get(color) || 0) + 1);
      });
    });

    // Organiza as cores por frequência
    const sortedColors = Array.from(colorFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, freq]) => freq > pixels.length * 0.05); // Filtra cores que aparecem em mais de 5% dos pixels

    if (sortedColors.length === 0) {
      return 'Cores: não foi possível identificar cores significativas';
    }

    // Agrupa as cores por categoria
    const colorCategories = {
      principais: [] as string[],
      neutras: [] as string[],
      terrosas: [] as string[],
      metálicas: [] as string[]
    };

    sortedColors.forEach(([color, _]) => {
      if (color.includes('marrom') || color.includes('bege') || color.includes('creme')) {
        colorCategories.terrosas.push(color);
      } else if (color.includes('prateado') || color.includes('dourado')) {
        colorCategories.metálicas.push(color);
      } else if (color.includes('preto') || color.includes('branco') || color.includes('cinza')) {
        colorCategories.neutras.push(color);
      } else {
        colorCategories.principais.push(color);
      }
    });

    // Formata a resposta
    let response = 'Cores encontradas:\n';
    
    if (colorCategories.principais.length > 0) {
      response += '\nCores Principais:\n' + colorCategories.principais.map(c => `- ${c}`).join('\n');
    }
    
    if (colorCategories.neutras.length > 0) {
      response += '\nTons Neutros:\n' + colorCategories.neutras.map(c => `- ${c}`).join('\n');
    }
    
    if (colorCategories.terrosas.length > 0) {
      response += '\nTons Terrosos:\n' + colorCategories.terrosas.map(c => `- ${c}`).join('\n');
    }
    
    if (colorCategories.metálicas.length > 0) {
      response += '\nTons Metálicos:\n' + colorCategories.metálicas.map(c => `- ${c}`).join('\n');
    }

    return response;
  } catch (error) {
    console.error('Erro ao analisar cores:', error);
    return 'Erro ao analisar as cores da imagem.';
  }
}

async function detectElements(imageBuffer: Buffer): Promise<string> {
  try {
    // Função para converter RGB para HSL
    function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
      r /= 255;
      g /= 255;
      b /= 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return [h * 360, s * 100, l * 100];
    }

    const elements: string[] = [];
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      return 'Não foi possível analisar as dimensões da imagem';
    }

    const { width, height } = metadata;
    const isPortrait = height > width;
    const aspectRatio = width / height;

    // Análise inicial da imagem completa
    const imageStats = await image.stats();
    const { channels, entropy } = imageStats;

    // Obtém os dados brutos da imagem
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Análise de dimensões e proporções
    elements.push(isPortrait ? 'orientação retrato' : 'orientação paisagem');
    if (aspectRatio > 2) {
      elements.push('formato panorâmico');
    } else if (aspectRatio === 1) {
      elements.push('formato quadrado');
    }

    // Análise de cores dominantes e padrões
    const colorGroups = {
      escuros: 0,
      claros: 0,
      vibrantes: 0,
      pasteis: 0,
      azuis: 0,
      verdes: 0,
      vermelhos: 0,
      amarelos: 0,
      neutros: 0,
      arcoIris: {
        vermelho: false,
        laranja: false,
        amarelo: false,
        verde: false,
        azul: false,
        roxo: false
      }
    };

    // Função para verificar se uma cor está dentro de um intervalo HSL
    function isColorInRange(r: number, g: number, b: number, hueRange: [number, number], satRange: [number, number], lightRange: [number, number]): boolean {
      const [h, s, l] = rgbToHsl(r, g, b);
      const hueInRange = (hueRange[0] <= hueRange[1]) 
        ? (h >= hueRange[0] && h <= hueRange[1])
        : (h >= hueRange[0] || h <= hueRange[1]);
      return hueInRange && s >= satRange[0] && s <= satRange[1] && l >= lightRange[0] && l <= lightRange[1];
    }

    // Analisa cada região da imagem para cores específicas
    const regionHeight = Math.floor(height / 3);
    const sampleSize = Math.min(10000, width * height);
    const step = Math.floor((width * height) / sampleSize);

    for (let i = 0; i < data.length; i += info.channels * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = Math.floor((i / info.channels / width) % height);

      // Verifica cores do arco-íris
      if (y < regionHeight) { // Terço superior da imagem
        if (isColorInRange(r, g, b, [350, 10], [50, 100], [20, 80])) colorGroups.arcoIris.vermelho = true;
        if (isColorInRange(r, g, b, [11, 40], [50, 100], [20, 80])) colorGroups.arcoIris.laranja = true;
        if (isColorInRange(r, g, b, [41, 70], [50, 100], [20, 80])) colorGroups.arcoIris.amarelo = true;
        if (isColorInRange(r, g, b, [71, 160], [50, 100], [20, 80])) colorGroups.arcoIris.verde = true;
        if (isColorInRange(r, g, b, [161, 260], [50, 100], [20, 80])) colorGroups.arcoIris.azul = true;
        if (isColorInRange(r, g, b, [261, 310], [50, 100], [20, 80])) colorGroups.arcoIris.roxo = true;
      }

      // Análise geral de cores
      if (r < 85 && g < 85 && b < 85) colorGroups.escuros++;
      if (r > 170 && g > 170 && b > 170) colorGroups.claros++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 100) colorGroups.vibrantes++;
      if (Math.min(r, g, b) > 127 && Math.max(r, g, b) - Math.min(r, g, b) < 50) colorGroups.pasteis++;
      
      // Análise de cores específicas
      if (b > r * 1.2 && b > g * 1.2) colorGroups.azuis++;
      if (g > r * 1.1 && g > b) colorGroups.verdes++;
      if (r > g * 1.2 && r > b * 1.2) colorGroups.vermelhos++;
      if (r > 150 && g > 150 && b < 100) colorGroups.amarelos++;
      if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10) colorGroups.neutros++;
    }

    // Detecta arco-íris
    const coresArcoIris = Object.values(colorGroups.arcoIris).filter(Boolean).length;
    if (coresArcoIris >= 4) {
      elements.push('arco-íris na parte superior');
    }

    // Análise de características baseadas em cores
    if (colorGroups.escuros >= 2) elements.push('predominância de tons escuros');
    if (colorGroups.claros >= 2) elements.push('predominância de tons claros');
    if (colorGroups.vibrantes >= 2) elements.push('cores vibrantes');
    if (colorGroups.pasteis >= 2) elements.push('tons pastéis');
    if (colorGroups.neutros >= 2) elements.push('cores neutras');

    // Análise de contraste
    const contrast = Math.max(...channels.map(c => c.stdev));
    if (contrast > 35) elements.push('alto contraste');
    else if (contrast < 20) elements.push('baixo contraste');

    // Análise de textura
    if (entropy < 4) {
      elements.push('textura uniforme');
    } else if (entropy > 6.5) {
      elements.push('textura complexa');
    } else {
      elements.push('textura moderada');
    }

    // Análise de regiões específicas
    const regions = {
      top: new Set<string>(),
      middle: new Set<string>(),
      bottom: new Set<string>(),
      left: new Set<string>(),
      right: new Set<string>(),
      center: new Set<string>()
    };

    // Divide a imagem em uma grade 3x3
    const regionWidth = Math.floor(width / 3);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const region = await image
          .clone()
          .extract({
            left: col * regionWidth,
            top: row * regionHeight,
            width: regionWidth,
            height: regionHeight
          })
          .toBuffer();

        const regionStats = await sharp(region).stats();
        const regionChannels = regionStats.channels;
        const regionEntropy = regionStats.entropy;

        // Análise de padrões de texto
        const hasTextPattern = regionChannels.every(c => c.stdev > 25) && regionEntropy > 4;
        const hasHighContrast = Math.max(...regionChannels.map(c => c.stdev)) > 40;
        const hasUniformBackground = regionChannels.some(c => c.mean > 200 || c.mean < 50);
        
        if (hasTextPattern && (hasHighContrast || hasUniformBackground)) {
          const textElement = 'presença de texto';
          if (row === 0) regions.top.add(textElement);
          else if (row === 1) regions.middle.add(textElement);
          else regions.bottom.add(textElement);
        }

        // Análise de elementos naturais
        const hasNaturalTexture = regionEntropy > 5;
        const hasNaturalColors = (
          colorGroups.verdes > 0 ||
          colorGroups.azuis > 0 ||
          (colorGroups.amarelos > 0 && colorGroups.verdes > 0)
        );

        if (hasNaturalTexture && hasNaturalColors) {
          regions.center.add('elementos naturais');
        }

        // Análise de cachoeira
        const hasWaterfallPattern = (
          regionChannels[2].mean > regionChannels[0].mean * 1.03 &&
          regionChannels[2].mean > regionChannels[1].mean * 1.03 &&
          regionEntropy > 3.8 &&
          regionChannels.some(c => c.mean > 200) // Área de espuma/spray
        );

        if (hasWaterfallPattern) {
          if (row === 1) regions.middle.add('cachoeira');
          else if (row === 2) regions.bottom.add('cachoeira');
        }

        // Análise de pessoas
        const hasPersonPattern = (
          regionChannels.some(c => c.mean < 135 && c.stdev > 30) &&
          regionEntropy > 3.5 &&
          Math.max(...regionChannels.map(c => c.stdev)) > 30
        );

        if (hasPersonPattern) {
          const personElement = 'presença de pessoas';
          if (col === 0) regions.left.add(personElement);
          else if (col === 1) regions.middle.add(personElement);
          else regions.right.add(personElement);
        }

        // Análise de foco
        const hasFocalPoint = regionChannels.every(c => c.stdev > 40);
        if (hasFocalPoint && row === 1 && col === 1) {
          regions.center.add('ponto focal central');
        }
      }
    }

    // Adiciona elementos identificados por região
    for (const [region, elements_set] of Object.entries(regions)) {
      elements_set.forEach(element => {
        switch (region) {
          case 'top':
            elements.push(`${element} na parte superior`);
            break;
          case 'middle':
            elements.push(`${element} na parte central`);
            break;
          case 'bottom':
            elements.push(`${element} na parte inferior`);
            break;
          case 'left':
            elements.push(`${element} à esquerda`);
            break;
          case 'right':
            elements.push(`${element} à direita`);
            break;
          case 'center':
            elements.push(element);
            break;
        }
      });
    }

    // Análise de composição geral
    if (elements.includes('elementos naturais') && elements.includes('presença de pessoas')) {
      elements.push('interação pessoa-natureza');
    }

    if (elements.includes('arco-íris na parte superior') && elements.includes('cachoeira')) {
      elements.push('composição natural dramática');
    }

    // Análise de iluminação
    const avgBrightness = channels.reduce((sum, c) => sum + c.mean, 0) / channels.length;
    if (avgBrightness > 180) elements.push('imagem clara');
    else if (avgBrightness < 75) elements.push('imagem escura');
    else elements.push('iluminação balanceada');

    // Análise de simetria
    const leftRegion = await image
      .clone()
      .extract({ left: 0, top: 0, width: Math.floor(width / 2), height: height })
      .stats();
    
    const rightRegion = await image
      .clone()
      .extract({ left: Math.floor(width / 2), top: 0, width: Math.floor(width / 2), height: height })
      .stats();

    const symmetryScore = leftRegion.channels.reduce((acc, channel, i) => 
      acc + Math.abs(channel.mean - rightRegion.channels[i].mean), 0) / 3;

    if (symmetryScore < 10) {
      elements.push('composição simétrica');
    } else if (symmetryScore > 30) {
      elements.push('composição assimétrica');
    }

    // Remove elementos duplicados e formata a resposta
    const uniqueElements = [...new Set(elements)];
    if (uniqueElements.length === 0) {
      return 'Não foi possível identificar elementos específicos';
    }

    return `Elementos identificados:\n${uniqueElements.map(element => `- ${element}`).join('\n')}`;
  } catch (error) {
    console.error('Erro ao detectar elementos:', error);
    return `Erro ao analisar elementos da imagem: ${error instanceof Error ? error.message : 'erro desconhecido'}`;
  }
}

// Função para classificar o tipo de imagem
function classifyImageType(text: string, elements: string[]): {
  type: string;
  subtype: string;
  hasText: boolean;
  hasHumans: boolean;
  hasNature: boolean;
  isArtistic: boolean;
} {
  const hasText = text.trim().length > 0;
  const isBibleVerse = /[A-Za-zÀ-ÿ]+ \d+:\d+/.test(text);
  const hasHumans = elements.some(e => e.includes('pessoa') || e.includes('presença de pessoas'));
  const hasNature = elements.some(e => 
    e.includes('água') || 
    e.includes('céu') || 
    e.includes('montanha') || 
    e.includes('natureza') ||
    e.includes('paisagem')
  );
  const isArtistic = elements.some(e => 
    e.includes('vibrante') || 
    e.includes('contraste') || 
    e.includes('textura')
  );

  let type = 'genérica';
  let subtype = 'indefinido';

  if (isBibleVerse) {
    type = 'religiosa';
    subtype = 'versículo bíblico';
  } else if (hasText && hasNature) {
    type = 'inspiracional';
    subtype = 'citação com paisagem';
  } else if (hasNature && hasHumans) {
    type = 'fotografia';
    subtype = 'retrato em paisagem';
  } else if (hasNature) {
    type = 'fotografia';
    subtype = 'paisagem natural';
  } else if (hasHumans) {
    type = 'fotografia';
    subtype = 'retrato';
  }

  return {
    type,
    subtype,
    hasText,
    hasHumans,
    hasNature,
    isArtistic
  };
}

async function interpretContent(text: string, elements: string[]): Promise<string> {
  try {
    // Se o OCR não extraiu texto, mas há presença visual de texto
    const hasVisualText = elements.some(e => e.includes('presença de texto'));
    const textoExtraido = text !== '__PRESENCA_VISUAL_TEXTO__' && text.trim().length > 0;

    // Classifica o tipo de imagem
    const imageClass = classifyImageType(text, elements);

    // Análise preliminar do conteúdo para identificar temas
    const themes = {
      religious: textoExtraido && (text.toLowerCase().includes('deus') || text.toLowerCase().includes('jesus') || text.toLowerCase().includes('bíblia') || /[A-Za-zÀ-ÿ]+ \d+:\d+/.test(text)),
      inspirational: textoExtraido && (text.toLowerCase().includes('vida') || text.toLowerCase().includes('amor') || text.toLowerCase().includes('força')),
      nature: imageClass.hasNature,
      human: imageClass.hasHumans,
      artistic: imageClass.isArtistic,
      rainbow: elements.some(e => e.includes('arco-íris') || e.includes('cores vibrantes')),
      water: elements.some(e => e.includes('água') || e.includes('cachoeira')),
      light: elements.some(e => e.includes('iluminação') || e.includes('luz'))
    };

    let prompt = 'INSTRUÇÕES ESPECÍFICAS PARA ANÁLISE:\n\n';
    prompt += 'Você é um especialista em análise de imagens e interpretação de conteúdo visual. ' +
              'Sua tarefa é fornecer uma análise detalhada e significativa em português do Brasil, ' +
              'focando na integração entre os elementos visuais e textuais.\n\n';
    prompt += `TIPO DE IMAGEM: ${imageClass.type} (${imageClass.subtype})\n\n`;

    // Adapta o texto conforme o caso
    if (textoExtraido) {
      prompt += 'CONTEÚDO TEXTUAL:\n';
      prompt += `"${text.trim()}"\n\n`;
    } else if (hasVisualText) {
      prompt += 'CONTEÚDO TEXTUAL NÃO EXTRAÍDO, MAS TEXTO VISUAL DETECTADO:\n';
      prompt += '- A imagem apresenta texto em destaque, centralizado e com alto contraste visual.\n';
      prompt += '- O texto pode ser um título, slogan, frase de destaque ou exemplo de layout gráfico.\n';
      prompt += '- O uso de fonte grande e espaçamento reforça a intenção de chamar atenção para a mensagem.\n';
      prompt += '- Possíveis contextos: apresentação, banner, slide, chamada de atenção ou demonstração de design.\n';
      prompt += '- Sugira possíveis temas ou mensagens que poderiam estar presentes nesse tipo de composição.\n\n';
    }

    // Organiza elementos visuais por categorias
    const visualElements = {
      composition: elements.filter(e => 
        e.includes('orientação') || 
        e.includes('textura') || 
        e.includes('composição')
      ),
      lighting: elements.filter(e =>
        e.includes('iluminação') ||
        e.includes('contraste') ||
        e.includes('claro') ||
        e.includes('escuro') ||
        e.includes('vibrante')
      ),
      natural: elements.filter(e =>
        e.includes('água') ||
        e.includes('cachoeira') ||
        e.includes('natureza') ||
        e.includes('paisagem') ||
        e.includes('arco-íris')
      ),
      human: elements.filter(e =>
        e.includes('pessoa') ||
        e.includes('presença de pessoas')
      )
    };

    prompt += 'ELEMENTOS VISUAIS SIGNIFICATIVOS:\n';
    if (visualElements.composition.length > 0) {
      prompt += '1. Composição:\n   ' + visualElements.composition.join('\n   ') + '\n';
    }
    if (visualElements.lighting.length > 0) {
      prompt += '2. Iluminação:\n   ' + visualElements.lighting.join('\n   ') + '\n';
    }
    if (visualElements.natural.length > 0) {
      prompt += '3. Elementos Naturais:\n   ' + visualElements.natural.join('\n   ') + '\n';
    }
    if (visualElements.human.length > 0) {
      prompt += '4. Presença Humana:\n   ' + visualElements.human.join('\n   ') + '\n';
    }
    prompt += '\n';

    prompt += 'ESTRUTURA DA ANÁLISE REQUERIDA:\n\n';

    // Adapta a estrutura da análise com base no tipo de imagem e temas
    if (themes.religious) {
      prompt += '1. Análise do Conteúdo Religioso:\n';
      prompt += '- Contexto e significado do texto\n';
      prompt += '- Mensagem espiritual\n';
      prompt += '- Aplicação prática\n\n';
    } else if (themes.inspirational) {
      prompt += '1. Análise da Mensagem:\n';
      prompt += '- Tema central\n';
      prompt += '- Impacto emocional\n';
      prompt += '- Relevância pessoal\n\n';
    }

    prompt += '2. Análise Visual:\n';
    prompt += '- Composição e enquadramento\n';
    prompt += '- Uso de cores e iluminação\n';
    prompt += '- Elementos principais\n\n';

    if (themes.nature) {
      prompt += '3. Elementos Naturais:\n';
      prompt += '- Descrição da paisagem\n';
      prompt += '- Simbolismo natural\n';
      prompt += '- Impacto visual\n\n';
    }

    if (themes.human) {
      prompt += '4. Elemento Humano:\n';
      prompt += '- Postura e expressão\n';
      prompt += '- Interação com o ambiente\n';
      prompt += '- Significado da presença\n\n';
    }

    prompt += '5. Integração e Significado:\n';
    if (text.trim()) {
      prompt += '- Relação texto-imagem\n';
    }
    prompt += '- Mensagem geral\n';
    prompt += '- Impacto emocional\n\n';

    prompt += '6. Contextualização:\n';
    prompt += '- Relevância atual\n';
    prompt += '- Aspectos culturais\n';
    prompt += '- Aplicações práticas\n\n';

    prompt += 'DIRETRIZES:\n';
    prompt += '- Mantenha um tom profissional\n';
    prompt += '- Equilibre análise técnica e interpretativa\n';
    prompt += '- Estabeleça conexões significativas\n';
    prompt += '- Use linguagem acessível\n';
    prompt += '- Mantenha foco na mensagem central\n';
    prompt += '- Baseie a análise nos elementos observáveis\n';

    // Gera a interpretação
    const response = await generateResponse(prompt);

    if (response) {
      return `\n\nAnálise Completa:\n${response}`;
    }

    return '\n\nNão foi possível gerar interpretação.';
  } catch (error: any) {
    console.error('Erro ao interpretar conteúdo:', error);
    return '\n\nNão foi possível gerar a interpretação do texto e/ou símbolos. ' +
           'Verifique se o modelo de linguagem está disponível e configurado corretamente.';
  }
}

export async function POST(request: Request) {
  try {
    console.log('Iniciando processamento de nova requisição...');
    const { imageBase64 } = await request.json();
    
    // Verifica o tamanho da imagem
    const imageSize = Buffer.from(imageBase64, 'base64').length;
    console.log('Tamanho da imagem recebida:', {
      size: `${(imageSize / 1024 / 1024).toFixed(2)}MB`,
      limiteMB: `${(MAX_IMAGE_SIZE / 1024 / 1024).toFixed(2)}MB`
    });

    if (imageSize > MAX_IMAGE_SIZE) {
      console.warn('Imagem excede o tamanho máximo permitido');
      return NextResponse.json(
        { error: 'Imagem muito grande. Por favor, use uma imagem menor que 5MB.' },
        { status: 400 }
      );
    }

    // Limpa cache antigo
    cleanOldCache();

    // Verifica se há resultado em cache
    const cacheKey = generateCacheKey(imageBase64);
    const cachedResult = analysisCache.get(cacheKey);
    if (cachedResult) {
      console.log('Resultado encontrado em cache');
      return NextResponse.json({
        analysis: cachedResult.result,
        cached: true
      });
    }

    console.log('Iniciando análise da imagem...');
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Executa todas as análises em paralelo
    console.time('analise-total');
    const [textResult, colorResult, elementResult] = await Promise.all([
      detectText(imageBase64).then(result => {
        console.log('Análise de texto concluída:', { 
          textLength: result.length,
          primeiras_palavras: result.slice(0, 50) + '...'
        });
        return result;
      }),
      analyzeColors(imageBuffer).then(result => {
        console.log('Análise de cores concluída');
        return result;
      }),
      detectElements(imageBuffer).then(result => {
        console.log('Análise de elementos concluída');
        return result;
      })
    ]);
    console.timeEnd('analise-total');

    // Extrai os elementos da análise
    const elements = elementResult
      .split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2));

    console.log('Iniciando interpretação do conteúdo...');
    // Obtém a interpretação do conteúdo
    const interpretation = await interpretContent(textResult, elements);

    const analysis = `Análise da Imagem:

${textResult}

${colorResult}

${elementResult}${interpretation}

Tipo de imagem:
Imagem digital com texto e elementos gráficos.`;

    // Armazena o resultado no cache
    analysisCache.set(cacheKey, {
      result: analysis,
      timestamp: Date.now()
    });
    console.log('Análise concluída e armazenada em cache');

    return NextResponse.json({
      analysis,
      cached: false
    });

  } catch (error: any) {
    console.error('Erro detalhado no processamento da requisição:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      type: typeof error
    });
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : 'Erro desconhecido ao processar a imagem.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 