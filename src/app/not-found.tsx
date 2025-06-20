import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white">404</h1>
        <h2 className="text-xl text-gray-300">Página não encontrada</h2>
        <p className="text-gray-400">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
} 
