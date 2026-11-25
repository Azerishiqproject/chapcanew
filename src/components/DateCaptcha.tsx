'use client';
import NumericCaptcha from './NumericCaptcha';
export default function DateCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void }) {
  return <NumericCaptcha key={props.correctDate ?? 'default'} mode="date" {...props} />;
}
