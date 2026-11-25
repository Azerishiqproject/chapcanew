'use client';
import NumericCaptcha from './NumericCaptcha';
export default function DateCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void }) {
  return <NumericCaptcha mode="date" {...props} />;
}
