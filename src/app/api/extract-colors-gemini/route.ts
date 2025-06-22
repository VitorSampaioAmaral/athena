// src/app/api/extract-colors-gemini/route.ts

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Defina a interface para a resposta da API
interface ColorResponse {
  colors?: string[];
  error?: string;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Funcionalidade de extração de cores com Gemini não está disponível.' },
    { status: 501 }
  );
}
