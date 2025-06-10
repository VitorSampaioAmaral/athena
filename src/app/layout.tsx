import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Athena - Análise de Imagens',
  description: 'Sistema de análise de imagens usando IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen bg-[#0F172A] text-white antialiased`}>
        <AuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <div className="relative flex-1 flex flex-col">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
