import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transcritor de Imagens",
  description: "Analise imagens com IA usando Ollama",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="font-sans bg-white">{children}</body>
    </html>
  )
}
