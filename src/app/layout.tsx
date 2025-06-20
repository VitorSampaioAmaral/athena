import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/components/AuthProvider';
import Navigation from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Athena - Transcrição de Imagens',
  description: 'Transcreva suas imagens com facilidade usando IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        <AuthProvider>
          <div className="min-h-screen bg-gray-900">
            <Navigation />
            <main className="container mx-auto px-4 py-8">{children}</main>
          </div>
          <Toaster 
            position="top-right"
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#ffffff',
                border: '1px solid #374151',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
