'use client'; // This directive is necessary for client-side components in Next.js App Router

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import axios from 'axios';

// Define the interface for the API response.
// 'colors' is now optional, as an error response might not have colors.
interface ColorResponse {
  colors?: string[];
  error?: string;
}

// ColorDetector component to display extracted colors from an image URL
function ColorDetector({ imageUrl }: { imageUrl: string }) {
  const [colors, setColors] = useState<string[]>([]);
  const [isLoadingColors, setIsLoadingColors] = useState<boolean>(false);
  const [colorError, setColorError] = useState<string | null>(null);

  useEffect(() => {
    const fetchColors = async () => {
      // Only fetch if imageUrl is valid
      if (!imageUrl) {
        setColors([]);
        setColorError(null); // Clear any previous errors
        return;
      }

      setIsLoadingColors(true);
      setColorError(null);
      setColors([]); // Clear previous colors before new fetch

      try {
        // Correct API route path for App Router: /api/extract-colors-sharp
        const response = await axios.get<ColorResponse>(`/api/extract-colors-gemini?imageUrl=${encodeURIComponent(imageUrl)}`);

        // Check if colors exist in the response data
        if (response.data.colors && response.data.colors.length > 0) {
          setColors(response.data.colors);
        } else if (response.data.error) {
          setColorError(response.data.error);
        } else {
          setColorError("Erro ao obter cores do servidor: Nenhuma cor ou erro específico recebido.");
        }
      } catch (error: any) {
        console.error("Erro ao buscar cores do servidor:", error);
        // Provide a more user-friendly error message
        if (axios.isAxiosError(error) && error.response) {
          setColorError(`Erro do servidor (${error.response.status}): ${error.response.data?.error || "Falha na comunicação."}`);
        } else {
          setColorError("Erro ao comunicar com o servidor para detectar cores.");
        }
      } finally {
        setIsLoadingColors(false);
      }
    };

    fetchColors(); // Call fetchColors on imageUrl change
  }, [imageUrl]); // Dependency array: re-run effect when imageUrl changes

  return (
    <div>
      <h2>Cores Detectadas (Servidor - Sharp):</h2>
      {isLoadingColors ? (
        <p>Carregando cores...</p>
      ) : colorError ? (
        <p className="text-red-500">{colorError}</p>
      ) : colors.length > 0 ? (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {colors.map((hex) => (
            <div
              key={hex} // Use hex as key, assuming unique colors
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: hex,
                borderRadius: '5px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            />
          ))}
        </div>
      ) : (
        // Only show "Nenhuma cor detectada" if not loading and no error, and imageUrl is provided
        imageUrl && <p>Nenhuma cor detectada.</p>
      )}
    </div>
  );
}

// Main Home component
export default function Home() {
  const [imageUrlInput, setImageUrlInput] = useState<string>('');
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(''); // State to trigger ColorDetector
  const [textoResultado, setTextoResultado] = useState<string>('');
  const [carregandoTexto, setCarregandoTexto] = useState<boolean>(false);
  const [erroTexto, setErroTexto] = useState<string>('');

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrlInput(event.target.value);
  };

  const handleClick = async () => {
    if (!imageUrlInput.trim()) {
      setErroTexto('Por favor, insira a URL da imagem.');
      setTextoResultado(''); // Clear previous results
      setCurrentImageUrl(''); // Clear image for ColorDetector
      return;
    }

    // Set the image URL for ColorDetector to react to
    setCurrentImageUrl(imageUrlInput.trim());

    setCarregandoTexto(true);
    setTextoResultado('');
    setErroTexto('');

    try {
      const apiUrl = `https://api.ocr.space/parse/imageurl?apikey=helloworld&url=${encodeURIComponent(
        imageUrlInput
      )}&detectOrientation=true&OCREngine=2`;

      const response = await axios.get(apiUrl);

      if (response.data && response.data.ParsedResults && response.data.ParsedResults.length > 0) {
        const textoExtraido = response.data.ParsedResults[0].ParsedText;
        setTextoResultado(textoExtraido);
      } else {
        setErroTexto('Não foi possível encontrar texto na resposta da OCR.space.');
      }
    } catch (error: any) {
      console.error('Erro na requisição OCR:', error);
      // More specific error message for OCR
      if (axios.isAxiosError(error) && error.response) {
        setErroTexto(`Erro na OCR.space (${error.response.status}): ${error.response.data?.ErrorMessage || "Falha na comunicação."}`);
      } else {
        setErroTexto('Ocorreu um erro ao buscar os dados do OCR.space.');
      }
    } finally {
      setCarregandoTexto(false);
    }
  };

  return (
    <div className="grid grid-rows-[auto_auto_auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={120}
          height={25}
          priority
        />
      </header>

      <main className="flex flex-col gap-8 row-start-2 items-center w-full max-w-md">
        <input
          type="text"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 py-2 px-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
          placeholder="Insira a URL da imagem"
          value={imageUrlInput}
          onChange={handleInputChange}
        />
        <button
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
          onClick={handleClick}
          disabled={carregandoTexto}
        >
          {carregandoTexto ? 'Carregando...' : 'Transcrever URL'}
        </button>

        {erroTexto && <p className="text-red-500">{erroTexto}</p>}

        {textoResultado && (
          <div className="bg-black/[.05] dark:bg-white/[.06] rounded-md p-4 w-full">
            <h2 className="font-semibold mb-2">Texto Extraído:</h2>
            <pre className="text-sm font-[family-name:var(--font-geist-mono)] whitespace-pre-wrap break-words">
              {textoResultado}
            </pre>
          </div>
        )}

        {/* Pass currentImageUrl to ColorDetector so it updates only when the button is clicked */}
        {currentImageUrl && (
          <div className="mt-4 w-full">
            <ColorDetector imageUrl={currentImageUrl} />
          </div>
        )}
      </main>

      <footer className="row-start-5 flex gap-4 flex-wrap items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        <a
          className="hover:underline hover:underline-offset-2"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn
        </a>
        <a
          className="hover:underline hover:underline-offset-2"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Examples
        </a>
        <a
          className="hover:underline hover:underline-offset-2"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Go to nextjs.org
        </a>
      </footer>
    </div>
  );
}