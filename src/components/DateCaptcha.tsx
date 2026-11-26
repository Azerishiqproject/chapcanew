'use client';
import type { CaptchaCondition } from '@/lib/captcha-metrics';
import NumericCaptcha from './NumericCaptcha';
export default function DateCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void; onReady?: (condition: CaptchaCondition) => void }) {
  return <NumericCaptcha key={props.correctDate ?? 'default'} mode="date" {...props} />;
}
