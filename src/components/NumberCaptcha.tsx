'use client';
import type { CaptchaCondition } from '@/lib/captcha-metrics';
import NumericCaptcha from './NumericCaptcha';
export default function NumberCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void; onReady?: (condition: CaptchaCondition) => void }) {
  return <NumericCaptcha mode="number" {...props} />;
}
