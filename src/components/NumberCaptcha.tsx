'use client';
import NumericCaptcha from './NumericCaptcha';
export default function NumberCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void }) {
  return <NumericCaptcha mode="number" {...props} />;
}
