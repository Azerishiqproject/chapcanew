'use client';
import NumericCaptcha from './NumericCaptcha';
export default function BirthDateCaptcha(props: { correctDate?: string; onVerify?: (correct: boolean) => void }) {
  return <NumericCaptcha key={props.correctDate ?? 'default'} mode="birthdate" {...props} />;
}
