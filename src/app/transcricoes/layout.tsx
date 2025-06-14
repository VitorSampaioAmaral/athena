import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Histórico de Transcrições - Athena',
  description: 'Visualize e gerencie seu histórico de transcrições',
};

export default function TranscricoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0F172A]">
      <div className="container mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
} 