// src/app/api/extract-colors-gemini/route.ts

import { NextRequest, NextResponse } from 'next/server';
// Mantenha a importação de todos os tipos necessários.
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import axios from 'axios';

// Defina a interface para a resposta da API
interface ColorResponse {
  colors?: string[];
  error?: string;
}

// Inicialize o cliente Gemini com sua chave de API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('imageUrl');

  if (!imageUrl) {
    return NextResponse.json(
      { error: 'URL da imagem é necessária.' },
      { status: 400 }
    );
  }

  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    const imagePart = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString('base64'),
        mimeType: imageResponse.headers['content-type'] || 'image/jpeg',
      },
    };

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const promptText = "Liste os 5 códigos de cores HEX mais predominantes nesta imagem. Responda apenas os códigos HEX separados por vírgulas, sem texto adicional. Ex: #RRGGBB,#RRGGBB,...";

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [imagePart, { text: promptText }] }],
      safetySettings: [
        {
          // CORREÇÃO: Use o membro da enumeração diretamente.
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          // CORREÇÃO: Use o membro da enumeração diretamente.
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          // CORREÇÃO: Use o membro da enumeração diretamente.
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          // CORREÇÃO: Use o membro da enumeração diretamente.
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const responseText = result.response.text();
    const colors = responseText.split(',').map(color => color.trim());

    const validColors = colors.filter(color => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color));

    if (validColors.length > 0) {
      return NextResponse.json(
        { colors: validColors },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: 'Gemini não conseguiu detectar cores predominantes no formato esperado.' },
        { status: 200 }
      );
    }

  } catch (error: any) {
    console.error('Erro ao chamar a API Gemini ou processar imagem:', error);
    let errorMessage = 'Falha ao extrair cores da imagem com Gemini.';
    if (error.message) {
        errorMessage += ` Detalhes: ${error.message}`;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
