import { useState, useCallback } from 'react';

export function useProgress() {
  const [progress, setProgress] = useState(0);

  const startProgress = useCallback(() => {
    setProgress(0);
  }, []);

  const updateProgress = useCallback((value: number) => {
    setProgress(Math.min(100, Math.max(0, value)));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(0);
  }, []);

  return {
    progress,
    startProgress,
    updateProgress,
    resetProgress
  };
} 
