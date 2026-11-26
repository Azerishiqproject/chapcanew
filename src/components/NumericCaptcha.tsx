'use client';
import type { CaptchaCondition } from '@/lib/captcha-metrics';
import { useState } from 'react';
import { matchesAnswer, dateText } from '@/lib/captcha-config';
import { createDateChallenge, dateEntryParts, dateInputLength, enteredDate, DATE_PARTS, DATE_LABELS, DATE_WIDTHS } from '@/lib/date-challenge';
import { useCaptchaFeedback } from './useCaptchaFeedback';

function keypad() {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (let i = digits.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [digits[i], digits[j]] = [digits[j], digits[i]]; }
  return [...digits.slice(0, 9), 'backspace', digits[9], 'clear'];
}
function newNumber() { return Math.floor(100000 + Math.random() * 900000).toString(); }
const DigitBox = ({ value, fixed = false }: { value: string; fixed?: boolean }) => (
    <div className="flex flex-col items-center">
      <div className={`w-8 h-11 border rounded-lg shadow-sm flex items-center justify-center text-[17px] font-black relative italic ${fixed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-800'}`}>
        {value ? value : <span className="absolute bottom-2 text-gray-300 font-normal italic text-sm">_</span>}
      </div>
    </div>
  );

interface Props { mode: 'date' | 'birthdate' | 'number'; correctDate?: string; onVerify?: (correct: boolean) => void; onReady?: (condition: CaptchaCondition) => void }
export default function NumericCaptcha({ mode, correctDate, onVerify, onReady }: Props) {
  const makeDate = () => mode === 'number' ? null : createDateChallenge(correctDate || (mode === 'date' ? dateText() : '25/08/1990'));
  const [challenge, setChallenge] = useState(makeDate);
  const [input, setInput] = useState('');
  const [target, setTarget] = useState(newNumber);
  const [keypadLayout, setKeypad] = useState(keypad);
  const { blocked, error, submit, clearError } = useCaptchaFeedback(onVerify, () => { setInput(''); setTarget(newNumber()); setKeypad(keypad()); setChallenge(makeDate()); }, () => onReady?.(challenge ? { variant: challenge.fixed ?? 'full', inputLength: dateInputLength(challenge) } : { variant: 'standard', inputLength: 6 }));
  const parts = challenge ? dateEntryParts(challenge, input) : null;
  const customDate = mode === 'date' && challenge?.expected !== dateText();
  const activePart = challenge ? DATE_PARTS.find(part => part !== challenge.fixed && (parts?.[part].length ?? 0) < DATE_WIDTHS[part]) : null;
  function handleClear() { if (!blocked) { setInput(''); clearError(); } }
  function handleBackspace() { if (!blocked) { setInput(value => value.slice(0, -1)); clearError(); } }
  function handleNumberClick(digit: string) {
    const length = challenge ? dateInputLength(challenge) : 6;
    if (blocked || input.length >= length) return;
    const next = input + digit; setInput(next); clearError();
    if (next.length !== length) return;
    const entered = challenge ? enteredDate(challenge, next) : next;
    const expected = challenge?.expected ?? target;
    submit(matchesAnswer(mode, entered, expected), mode === 'number' ? 'Rəqəm düzgün daxil edilməyib' : 'Tarix düzgün daxil edilməyib');
  }

  return (
    <div className="w-full font-sans bg-white h-auto flex flex-col pt-5 pb-6 px-4 relative rounded-[24px] shadow-xl overflow-hidden border border-gray-100">
      {/* Top Gradient Overlay from image */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#e0f7fa] to-transparent pointer-events-none opacity-60" />

      <h3 className="text-[14px] font-bold text-gray-900 mb-5 relative z-10 leading-snug px-1">
        {mode === 'number' ? 'Aşağıdakı rəqəmi daxil edin:' : mode === 'birthdate' ? 'Doğum tarixinizi aşağıdakı düymələr vasitəsilə daxil edin:' : customDate ? 'Təyin etdiyiniz tarixi aşağıdakı düymələr vasitəsilə daxil edin:' : 'Bugünkü tarixi aşağıdakı düymələr vasitəsilə daxil edin:'}
      </h3>

      {customDate && <p role="note" className="text-[11px] text-gray-600 mb-3 px-1 relative z-10">Bu yoxlamada ayarlarda saxladığınız tarix istifadə olunur. Bugünkü tarix üçün ayarı yeniləyin.</p>}
      {mode === 'number' && <div className="text-[24px] font-black text-[#00965e] mb-5 tracking-[0.2em] text-center relative z-10 font-mono italic">{target}</div>}
      {/* Input Area */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 mb-5 relative z-10 shadow-sm mx-0.5">
        <div className="flex justify-between items-end gap-1.5 px-0">
          {mode === 'number' ? <div className="flex justify-center w-full gap-1">{Array.from({ length: 6 }, (_, i) => <DigitBox key={i} value={input[i]} />)}</div> : <>
          {DATE_PARTS.map(part => <div key={part} role="group" aria-current={activePart === part ? 'step' : undefined} aria-label={`${DATE_LABELS[part]}${challenge?.fixed === part ? ', hazır' : ''}`} className={`flex flex-col items-center ${part === 'year' ? 'flex-[1.4]' : 'flex-1'} ${part === 'month' ? 'border-x border-gray-100 px-1' : ''} ${activePart === part ? 'rounded-lg ring-2 ring-sky-300 ring-offset-2' : ''}`}>
            <div className="flex gap-1">{Array.from({ length: DATE_WIDTHS[part] }, (_, i) => <DigitBox key={i} value={parts?.[part][i] ?? ''} fixed={challenge?.fixed === part} />)}</div>
            <span className={`text-[8px] mt-1 font-bold uppercase tracking-widest ${challenge?.fixed === part ? 'text-emerald-600' : 'text-gray-400'}`}>{DATE_LABELS[part]}{challenge?.fixed === part ? ' · hazır' : ''}</span>
          </div>)}
          </>}
        </div>

        {error && (
          <div role="alert" className="absolute -bottom-6 left-0 right-0 text-center text-red-500 text-[10px] font-bold uppercase tracking-wider transition-all">
            {error}
          </div>
        )}
      </div>

      {challenge?.fixed && <p className="text-[11px] text-emerald-700 mb-3 px-1" role="status">{DATE_LABELS[challenge.fixed]} hazırdır. Hazır hissəni təkrar yazmadan qalan sahələri doldurun.</p>}
      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2.5 relative z-10 mt-1">
        {keypadLayout.flat().map((key, idx) => {
          if (key === 'backspace') {
            return (
              <button
                key="bs"
                onClick={handleBackspace}
                aria-label="Geri sil" disabled={blocked}
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
                aria-label="Təmizlə" disabled={blocked}
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
              disabled={blocked}
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
