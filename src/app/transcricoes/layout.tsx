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
    <>{children}</>
  );
} 
