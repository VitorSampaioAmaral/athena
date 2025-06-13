// pages/index.js
import { useState } from 'react';
import Image from 'next/image';
import axios from 'axios';

export default function Home() {
  const [resultado, setResultado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleClick = async () => {
    setCarregando(true);
    setResultado('');
    setErro('');

    try {
      const imageUrl = 'https://api.ocr.space/parse/imageurl?apikey=helloworld&url=https://dl.a9t9.com/ocr/solarcell.jpg';
      const response = await axios.get(imageUrl);
      setResultado(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Erro na requisição:', error);
      setErro('Ocorreu um erro ao buscar os dados.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
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

      <main className="flex flex-col gap-8 row-start-2 items-center">
        <button
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
          onClick={handleClick}
          disabled={carregando}
        >
          {carregando ? 'Carregando...' : 'Buscar Resultado'}
        </button>

        {erro && <p className="text-red-500">{erro}</p>}

        {resultado && (
          <div className="bg-black/[.05] dark:bg-white/[.06] rounded-md p-4 w-full max-w-md">
            <h2 className="font-semibold mb-2">Resultado da Requisição:</h2>
            <pre className="text-sm font-[family-name:var(--font-geist-mono)] whitespace-pre-wrap break-words">
              {resultado}
            </pre>
          </div>
        )}
      </main>

      <footer className="row-start-3 flex gap-4 flex-wrap items-center justify-center text-sm text-gray-500 dark:text-gray-400">
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