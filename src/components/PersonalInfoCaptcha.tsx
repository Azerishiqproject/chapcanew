'use client';

import type { CaptchaCondition } from '@/lib/captcha-metrics';
import { useState } from 'react';
import { matchesAnswer } from '@/lib/captcha-config';
import { useCaptchaFeedback } from './useCaptchaFeedback';

type PersonalCaptchaType = 'fin' | 'religion' | 'favoriteCar';

interface PersonalInfoCaptchaProps {
  type: PersonalCaptchaType;
  correctAnswer: string;
  onReady?: (condition: CaptchaCondition) => void;
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

export default function PersonalInfoCaptcha({
  type,
  correctAnswer,
  onVerify,
  onReady,
}: PersonalInfoCaptchaProps) {
  const [value, setValue] = useState('');
  const { blocked, error, submit, clearError } = useCaptchaFeedback(onVerify, () => setValue(''), () => onReady?.({ variant: 'standard', inputLength: correctAnswer.trim().length }));
  const copy = captchaCopy[type];
  const isFin = type === 'fin';
  const isComplete = isFin ? value.length === 7 : value.trim().length > 0;

  const handleChange = (nextValue: string) => {
    clearError();
    if (isFin) {
      setValue(nextValue.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7));
      return;
    }
    setValue(nextValue.slice(0, 40));
  };

  const handleVerify = () => {
    if (!isComplete || blocked) return;
    submit(matchesAnswer(type, value, correctAnswer), 'Məlumat düzgün daxil edilməyib');
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
          aria-label={copy.title} disabled={blocked}
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
          <div role="alert" className="mt-2 text-center text-[10px] font-bold uppercase tracking-wider text-red-500">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={handleVerify}
        disabled={blocked || !isComplete}
        className="relative z-10 h-11 w-full -translate-y-0.5 rounded-lg border border-white/10 bg-[#00965e] text-[13px] font-black uppercase tracking-wider text-white shadow-[0_2px_0_rgb(0,100,60)] transition-all active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
      >
        Təsdiqlə
      </button>
    </div>
  );
}
