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
      <div className="w-10 h-14 bg-white/10 border border-white/10 rounded-xl shadow-inner flex items-center justify-center text-[22px] font-black text-[#00965e] relative italic">
        {value ? value : <span className="absolute bottom-3 text-white/20 font-normal italic">_</span>}
      </div>
    </div>
  );

  return (
    <div className="w-full font-sans bg-transparent h-full flex flex-col pt-6 px-5 relative">
      {/* Remove hardcoded gradient that causes design error */}

      <h3 className="text-[16px] font-black uppercase tracking-tight text-white mb-8 relative z-10 leading-snug">
        Doğum tarixinizi aşağıdakı düymələr vasitəsilə daxil edin:
      </h3>

      {/* Input Area */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-10 relative z-10 shadow-2xl">
        <div className="flex justify-between items-end gap-2 px-0">
          {/* Gün */}
          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              <DigitBox value={day[0]} />
              <DigitBox value={day[1]} />
            </div>
            <span className="text-[11px] text-white/40 mt-2 font-black uppercase tracking-widest">Gün</span>
          </div>

          {/* Ay */}
          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              <DigitBox value={month[0]} />
              <DigitBox value={month[1]} />
            </div>
            <span className="text-[11px] text-white/40 mt-2 font-black uppercase tracking-widest">Ay</span>
          </div>

          {/* İl */}
          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              <DigitBox value={year[0]} />
              <DigitBox value={year[1]} />
              <DigitBox value={year[2]} />
              <DigitBox value={year[3]} />
            </div>
            <span className="text-[11px] text-white/40 mt-2 font-black uppercase tracking-widest">İl</span>
          </div>
        </div>

        {error && (
          <div className="absolute -bottom-8 left-0 right-0 text-center text-red-500 text-sm font-black uppercase tracking-wider transition-all">
            {error}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 relative z-10 mt-2">
        {keypadLayout.flat().map((key, idx) => {
          if (key === 'backspace') {
            return (
              <button
                key="bs"
                onClick={handleBackspace}
                className="h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-xl"
              >
                <span className="text-[20px] font-black">←</span>
              </button>
            );
          }
          if (key === 'clear') {
            return (
              <button
                key="cl"
                onClick={handleClear}
                className="h-14 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-white transition-all shadow-xl"
              >
                <span className="text-[18px]">✕</span>
              </button>
            );
          }
          return (
            <button
              key={idx}
              onClick={() => handleNumberClick(key)}
              className="h-14 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-[22px] font-black italic text-white/80 hover:bg-[#00965e] hover:text-white hover:border-[#00965e] transition-all shadow-xl"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
