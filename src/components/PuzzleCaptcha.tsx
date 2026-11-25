'use client';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { createPuzzleChallenge, PUZZLE, puzzleMatches, puzzlePosition } from '@/lib/puzzle-challenge';
import { useCaptchaFeedback } from './useCaptchaFeedback';

interface Drag { pointer: number; clientX: number; start: number; travelCss: number; moved: boolean }
export default function PuzzleCaptcha({ onVerify }: { onVerify?: (correct: boolean) => void }) {
  const helpId = useId();
  const [challenge, setChallenge] = useState(createPuzzleChallenge);
  const [position, setPosition] = useState(0);
  const [success, setSuccess] = useState(false);
  const track = useRef<HTMLDivElement>(null), drag = useRef<Drag | null>(null);
  const currentPosition = useRef(0), keyboardMoved = useRef(false);
  function updatePosition(next: number) { currentPosition.current = next; setPosition(next); }
  const { blocked, error, submit } = useCaptchaFeedback(onVerify, () => { setChallenge(createPuzzleChallenge()); updatePosition(0); keyboardMoved.current = false; });
  const ratio = position / PUZZLE.travel;
  function verify(next: number) { const correct = puzzleMatches(challenge, next); setSuccess(correct); submit(correct, 'Parça boşluğa uyğun gəlmədi. Yenidən sınayın.'); }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (blocked || drag.current || event.isPrimary === false || event.button !== 0) return;
    const bounds = track.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= PUZZLE.handleSize + 4) return;
    event.preventDefault(); event.currentTarget.focus();
    drag.current = { pointer: event.pointerId, clientX: event.clientX, start: currentPosition.current, travelCss: bounds.width - PUZZLE.handleSize - 4, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movement(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId || blocked) return null;
    const delta = event.clientX - active.clientX;
    if (Math.abs(delta) >= 3) active.moved = true;
    const next = puzzlePosition(active.start, delta, active.travelCss); updatePosition(next); return next;
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const next = movement(event); drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (next !== null && active.moved) verify(next);
  }
  function cancel(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null; updatePosition(0); keyboardMoved.current = false;
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (blocked || drag.current) return;
    const steps: Record<string, number> = { ArrowLeft: -3, ArrowDown: -3, ArrowRight: 3, ArrowUp: 3 };
    if (event.key in steps || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? PUZZLE.travel : Math.max(0, Math.min(PUZZLE.travel, currentPosition.current + steps[event.key]));
      if (next !== currentPosition.current) keyboardMoved.current = true;
      updatePosition(next);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (keyboardMoved.current) verify(currentPosition.current);
    }
  }
  return <div className="w-full rounded-[24px] border border-gray-100 bg-white px-4 pb-4 pt-5 shadow-xl text-gray-800">
    <h3 className="mb-4 px-1 text-[14px] font-bold leading-snug">Oxu sürüşdürərək şəkil parçasını boş yerə yerləşdirin:</h3>
    <svg viewBox={`0 0 ${PUZZLE.width} ${PUZZLE.height}`} role="img" aria-label="Parçası çatışmayan mənzərə" className="block w-full rounded-xl border border-gray-200 select-none" style={{ touchAction: 'pan-y' }}>
      <image href="/captcha/landscape.svg" width={PUZZLE.width} height={PUZZLE.height} />
      <rect x={challenge.x} y={challenge.y} width={PUZZLE.size} height={PUZZLE.size} rx={2} fill="#102c34" fillOpacity={.65} stroke="white" strokeOpacity={.85} strokeWidth={1.5} strokeDasharray="4 3" />
      <svg x={PUZZLE.startX + position} y={challenge.y} width={PUZZLE.size} height={PUZZLE.size} viewBox={`${challenge.x} ${challenge.y} ${PUZZLE.size} ${PUZZLE.size}`} overflow="hidden"><image href="/captcha/landscape.svg" width={PUZZLE.width} height={PUZZLE.height} /></svg>
      <rect x={PUZZLE.startX + position} y={challenge.y} width={PUZZLE.size} height={PUZZLE.size} rx={2} fill="none" stroke={success ? '#00965e' : 'white'} strokeWidth={2} />
    </svg>
    <div ref={track} className={`relative mt-4 h-[50px] rounded-lg border ${success ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-100 border-gray-200'}`}>
      <span className="absolute inset-0 flex items-center justify-center pl-8 text-[12px] text-gray-400 select-none" aria-hidden="true">{success ? 'Təsdiqləndi' : 'Oxu sağa sürüşdürün'}</span>
      <div role="slider" tabIndex={blocked ? -1 : 0} aria-label="Şəkil parçasını sürüşdürün" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-valuetext={`${Math.round(ratio * 100)} faiz`} aria-disabled={blocked} aria-describedby={helpId}
        onPointerDown={start} onPointerMove={movement} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={keyDown}
        className={`absolute top-[1px] flex h-[46px] w-[46px] items-center justify-center rounded-md border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${blocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${success ? 'bg-[#00965e] border-[#00965e] text-white' : 'bg-white border-gray-200 text-[#00965e]'}`}
        style={{ left: `calc(2px + ${ratio * 100}% - ${(PUZZLE.handleSize + 4) * ratio}px)`, touchAction: 'none', userSelect: 'none' }}>
        {success ? <Check size={22} /> : <ArrowRight size={22} />}
      </div>
    </div>
    <p id={helpId} className="sr-only">Ox düymələri ilə hərəkət etdirin, Enter ilə təsdiqləyin.</p>
    <div className="min-h-8 pt-2 text-center text-[11px]" aria-live="polite">{error && <span role="alert" className="text-red-500">{error}</span>}{success && <span className="font-bold text-emerald-600">Parça düzgün yerləşdirildi.</span>}</div>
  </div>;
}
