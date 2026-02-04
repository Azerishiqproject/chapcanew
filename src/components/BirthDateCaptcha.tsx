'use client';

import { useState, useMemo, useEffect } from 'react';

interface BirthDateCaptchaProps {
  correctDate?: string;
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

export default function BirthDateCaptcha({ correctDate: propDate, onVerify }: BirthDateCaptchaProps) {
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Correct date for demo purposes
  const correctDate = propDate || "25/08/1990";

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
    if (day.length < 2) {
      setDay(prev => prev + num);
    } else if (month.length < 2) {
      setMonth(prev => prev + num);
    } else if (year.length < 4) {
      setYear(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setError(null);
    if (year.length > 0) {
      setYear(prev => prev.slice(0, -1));
    } else if (month.length > 0) {
      setMonth(prev => prev.slice(0, -1));
    } else if (day.length > 0) {
      setDay(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setDay('');
    setMonth('');
    setYear('');
    setError(null);
  };

  useEffect(() => {
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      const enteredDate = `${day}/${month}/${year}`;
      // Normalize correctDate to use / instead of . or space
      const normalizedCorrectDate = correctDate?.replace(/[.\s]/g, '/');
      const isCorrect = enteredDate === normalizedCorrectDate;
      if (isCorrect) {
        onVerify?.(true);
      } else {
        setError('Tarix düzgün daxil edilməyib');
        setTimeout(() => handleClear(), 1500);
      }
    }
  }, [day, month, year, correctDate, onVerify]);

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

      <h3 className="text-[14px] font-bold text-gray-900 mb-5 relative z-10 leading-snug px-1">
        Doğum tarixinizi aşağıdakı düymələr vasitəsilə daxil edin:
      </h3>

      {/* Input Area */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 mb-5 relative z-10 shadow-sm mx-0.5">
        <div className="flex justify-between items-end gap-1.5 px-0">
          {/* Gün */}
          <div className="flex flex-col items-center flex-1">
            <div className="flex gap-1">
              <DigitBox value={day[0]} />
              <DigitBox value={day[1]} />
            </div>
            <span className="text-[8px] text-gray-400 mt-1 font-bold uppercase tracking-widest">Gün</span>
          </div>

          {/* Ay */}
          <div className="flex flex-col items-center flex-1 border-x border-gray-100 px-1">
            <div className="flex gap-1">
              <DigitBox value={month[0]} />
              <DigitBox value={month[1]} />
            </div>
            <span className="text-[8px] text-gray-400 mt-1 font-bold uppercase tracking-widest">Ay</span>
          </div>

          {/* İl */}
          <div className="flex flex-col items-center flex-[1.4]">
            <div className="flex gap-1">
              <DigitBox value={year[0]} />
              <DigitBox value={year[1]} />
              <DigitBox value={year[2]} />
              <DigitBox value={year[3]} />
            </div>
            <span className="text-[8px] text-gray-400 mt-1 font-bold uppercase tracking-widest">İl</span>
          </div>
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
