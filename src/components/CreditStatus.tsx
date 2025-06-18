'use client';

import { useState, useEffect } from 'react';

interface CreditStatus {
  usedToday: number;
  remaining: number;
  nextAvailable: Date | null;
  dailyLimit: number;
  canTranscribe: boolean;
}

export default function CreditStatus() {
  return null;
} 