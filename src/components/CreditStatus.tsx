'use client';

import React from 'react';

interface CreditStatusProps {
  credits: number;
  used: number;
  total: number;
}

export function CreditStatus({ credits, used, total }: CreditStatusProps) {
  const percentage = (used / total) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-2">Créditos</h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">Usados:</span>
          <span className="text-white">{used}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">Disponíveis:</span>
          <span className="text-white">{credits}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">Total:</span>
          <span className="text-white">{total}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
} 
