'use client';

import { useState, useMemo, useEffect } from 'react';

interface NumberCaptchaProps {
  onVerify?: (isCorrect: boolean) => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function NumberCaptcha({ onVerify }: NumberCaptchaProps) {
  const [targetNumber] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [userInput, setUserInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const keypadLayout = useMemo(() => {
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const shuffled = shuffleArray(numbers);

    return [
      [shuffled[0], shuffled[1], shuffled[2]],
      [shuffled[3], shuffled[4], shuffled[5]],
      [shuffled[6], shuffled[7], shuffled[8]],
      ['backspace', shuffled[9], 'clear']
    ];
  }, []);

  const handleNumberClick = (num: string) => {
    setError(null);
    if (userInput.length < 6) {
      setUserInput(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setError(null);
    setUserInput(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setUserInput('');
    setError(null);
  };

  useEffect(() => {
    if (userInput.length === 6) {
      if (userInput === targetNumber) {
        onVerify?.(true);
      } else {
        setError('Rəqəm düzgün daxil edilməyib');
        setTimeout(() => handleClear(), 1500);
      }
    }
  }, [userInput, targetNumber, onVerify]);

  const DigitBox = ({ value }: { value: string }) => (
    <div className="flex flex-col items-center">
      <div className="w-10 h-12 bg-white border border-gray-100 rounded-md shadow-sm flex items-center justify-center text-[18px] font-bold text-gray-800 relative">
        {value ? value : <span className="absolute bottom-3 text-gray-300 font-normal">_</span>}
      </div>
    </div>
  );

  return (
    <div className="w-full font-sans bg-white h-full flex flex-col pt-6 px-5">
      {/* Top Gradient Overlay */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#e0f7fa] to-transparent pointer-events-none" />

      <h3 className="text-[14px] font-bold text-gray-900 mb-2 relative z-10 leading-snug">
        Aşağıdakı rəqəmi daxil edin:
      </h3>
      <div className="text-[24px] font-bold text-[#00b2ff] mb-4 tracking-[0.2em] text-center relative z-10 drop-shadow-sm">
        {targetNumber}
      </div>

      {/* Input Area */}
      <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-xl p-3 mb-6 relative z-10 shadow-sm">
        <div className="flex justify-center items-end gap-1.5 px-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <DigitBox key={i} value={userInput[i]} />
          ))}
        </div>

        {error && (
          <div className="absolute -bottom-7 left-0 right-0 text-center text-[#f07183] text-[12px] font-bold transition-all">
            {error}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2 relative z-10 mt-1">
        {keypadLayout.flat().map((key, idx) => {
          if (key === 'backspace') {
            return (
              <button
                key="bs"
                onClick={handleBackspace}
                className="h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-gray-800 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
              >
                <span className="text-[18px] font-bold">←</span>
              </button>
            );
          }
          if (key === 'clear') {
            return (
              <button
                key="cl"
                onClick={handleClear}
                className="h-12 bg-white border border-[#f07183]/30 rounded-lg flex items-center justify-center text-[#f07183] hover:bg-red-50 active:bg-red-100 transition-all border-b-2 shadow-sm"
              >
                <span className="text-[16px]">✕</span>
              </button>
            );
          }
          return (
            <button
              key={idx}
              onClick={() => handleNumberClick(key)}
              className="h-12 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-[18px] font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
