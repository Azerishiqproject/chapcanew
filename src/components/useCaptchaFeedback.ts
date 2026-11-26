'use client';
import { useEffect, useRef, useState } from 'react';

/** Local feedback owns its retry timer; input is locked before notifying parents. */
export function useCaptchaFeedback(onVerify: ((correct: boolean) => void) | undefined, retry: () => void, onReady?: () => void) {
  const ready = useRef(onReady); ready.current = onReady;
  const [cycle, setCycle] = useState(0);
  useEffect(() => { ready.current?.(); }, [cycle]);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function submit(correct: boolean, message: string) {
    if (locked.current) return;
    locked.current = true; setBlocked(true);
    if (!correct) {
      setError(message);
      timer.current = setTimeout(() => { retry(); setCycle(value => value + 1); setError(null); locked.current = false; setBlocked(false); }, 1500);
    }
    onVerify?.(correct);
  }
  return { blocked, error, submit, clearError: () => setError(null) };
}
