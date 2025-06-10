import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Análise de Imagens",
  description: "Sistema de análise de imagens com detecção de cores e objetos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-screen bg-[#0F172A] text-white antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
            <div className="relative flex-1 flex flex-col">
              <Navbar />
              <main className="flex-1 pt-16">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
