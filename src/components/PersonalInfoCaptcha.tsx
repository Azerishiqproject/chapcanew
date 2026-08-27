'use client';

import { useState } from 'react';

type PersonalCaptchaType = 'fin' | 'religion' | 'favoriteCar';

interface PersonalInfoCaptchaProps {
  type: PersonalCaptchaType;
  correctAnswer: string;
  onVerify?: (isCorrect: boolean) => void;
}

const captchaCopy: Record<PersonalCaptchaType, { title: string; placeholder: string }> = {
  fin: {
    title: '7 simvoldan ibarət FİN kodunuzu daxil edin:',
    placeholder: 'Məsələn: 69SZNKO',
  },
  religion: {
    title: 'Din məlumatınızı daxil edin:',
    placeholder: 'Cavabınızı yazın',
  },
  favoriteCar: {
    title: 'Sevimli maşınınızı daxil edin:',
    placeholder: 'Maşın markasını yazın',
  },
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('az');
}

export default function PersonalInfoCaptcha({
  type,
  correctAnswer,
  onVerify,
}: PersonalInfoCaptchaProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const copy = captchaCopy[type];
  const isFin = type === 'fin';
  const isComplete = isFin ? value.length === 7 : value.trim().length > 0;

  const handleChange = (nextValue: string) => {
    setError(null);
    if (isFin) {
      setValue(nextValue.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7));
      return;
    }
    setValue(nextValue.slice(0, 40));
  };

  const handleVerify = () => {
    const isCorrect = normalize(value) === normalize(correctAnswer);
    if (isCorrect) {
      onVerify?.(true);
      return;
    }

    onVerify?.(false);
    setError('Məlumat düzgün daxil edilməyib');
    setTimeout(() => {
      setValue('');
      setError(null);
    }, 1500);
  };

  return (
    <div className="w-full rounded-[24px] border border-gray-100 bg-white px-5 pb-6 pt-5 shadow-xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#e0f7fa] to-transparent opacity-60 pointer-events-none" />
      <h3 className="relative z-10 mb-5 px-1 text-[14px] font-bold leading-snug text-gray-900">
        {copy.title}
      </h3>

      <div className="relative z-10 mb-5 rounded-xl border border-gray-100 bg-gray-50 p-3 shadow-sm">
        <input
          type="text"
          value={value}
          maxLength={isFin ? 7 : 40}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && isComplete) handleVerify();
          }}
          placeholder={copy.placeholder}
          autoFocus
          autoComplete="off"
          className={`w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-800 outline-none transition-colors focus:border-[#00965e] ${isFin ? 'font-mono uppercase tracking-[0.22em]' : ''}`}
        />
        {isFin && (
          <div className="mt-2 text-right text-[10px] font-bold text-gray-400">
            {value.length}/7
          </div>
        )}
        {error && (
          <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-red-500">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={handleVerify}
        disabled={!isComplete}
        className="relative z-10 h-11 w-full -translate-y-0.5 rounded-lg border border-white/10 bg-[#00965e] text-[13px] font-black uppercase tracking-wider text-white shadow-[0_2px_0_rgb(0,100,60)] transition-all active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
      >
        Təsdiqlə
      </button>
    </div>
  );
}
