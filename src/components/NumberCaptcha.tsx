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
      <div className="w-8 h-11 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center text-[17px] font-black text-gray-800 relative italic">
        {value ? value : <span className="absolute bottom-2 text-gray-300 font-normal italic text-sm">_</span>}
      </div>
    </div>
  );

  return (
    <div className="w-full font-sans bg-white h-auto flex flex-col pt-5 pb-6 px-4 relative rounded-[24px] shadow-xl overflow-hidden border border-gray-100">
      {/* Top Gradient Overlay from image */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#e0f7fa] to-transparent pointer-events-none opacity-60" />

      <h3 className="text-[14px] font-bold text-gray-900 mb-2 relative z-10 leading-snug px-1">
        Aşağıdakı rəqəmi daxil edin:
      </h3>
      <div className="text-[24px] font-black text-[#00965e] mb-5 tracking-[0.2em] text-center relative z-10 drop-shadow-sm font-mono italic">
        {targetNumber}
      </div>

      {/* Input Area */}
      <div className="bg-gray-50 border border-gray-100/80 rounded-xl p-2.5 mb-5 relative z-10 shadow-sm mx-0.5">
        <div className="flex justify-center items-end gap-1 px-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <DigitBox key={i} value={userInput[i]} />
          ))}
        </div>

        {error && (
          <div className="absolute -bottom-6 left-0 right-0 text-center text-red-500 text-[10px] font-bold uppercase tracking-wider transition-all">
            {error}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2.5 relative z-10 mt-1">
        {keypadLayout.flat().map((key, idx) => {
          if (key === 'backspace') {
            return (
              <button
                key="bs"
                onClick={handleBackspace}
                className="h-11 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-800 hover:bg-gray-50 active:scale-95 transition-all shadow-[0_2px_0_rgba(0,0,0,0.05)] border-b-2"
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
                className="h-11 bg-[#fff5f5] border border-red-200 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-100 active:scale-95 transition-all shadow-[0_2px_0_rgba(239,68,68,0.1)] border-b-2"
              >
                <span className="text-[16px]">✕</span>
              </button>
            );
          }
          return (
            <button
              key={idx}
              onClick={() => handleNumberClick(key)}
              className="h-11 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-[18px] font-bold text-gray-800 hover:bg-gray-50 active:scale-95 transition-all shadow-[0_2px_0_rgba(0,0,0,0.05)] border-b-2"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
