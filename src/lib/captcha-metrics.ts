import { CAPTCHA_TYPES, type CaptchaType } from './captcha-config';
export const CAPTCHA_LABELS: Record<CaptchaType, string> = { date: 'Tarix', birthdate: 'Doğum tarixi', number: 'Rəqəm', text: 'Mətn', puzzle: 'Şəkil sürüşdürmə', fin: 'FİN', religion: 'Din', favoriteCar: 'Sevimli maşın' };
export interface CaptchaCondition { variant: 'full' | 'day' | 'month' | 'year' | 'standard' | 'short' | 'medium' | 'long' | 'unknown'; inputLength?: number }
export interface CaptchaQuestion { index: number; type: CaptchaType; stage?: string; attempts: number; incorrect: number; activeMs: number; completed: boolean; conditions: string[] }
export const conditionKey = (condition: CaptchaCondition) => `${condition.variant}${condition.inputLength == null ? '' : `:${condition.inputLength}`}`;
export function conditionLabel(key: string) {
  const [variant, length] = key.split(':');
  const label: Record<string, string> = { full: 'Tam tarix', day: 'Gün hazır', month: 'Ay hazır', year: 'İl hazır', standard: 'Standart', short: 'Qısa məsafə', medium: 'Orta məsafə', long: 'Uzun məsafə', unknown: 'Şərt bilinmir' };
  return `${label[variant] ?? variant}${length ? ` · ${length} simvol` : ''}`;
}
export function validCondition(type: CaptchaType, value: unknown): CaptchaCondition {
  if (!value || typeof value !== 'object') throw new Error('Geçersiz CAPTCHA koşulu.');
  const { variant, inputLength } = value as CaptchaCondition;
  if (variant === 'unknown' && inputLength == null) return { variant };
  if (type === 'date' || type === 'birthdate') {
    const lengths = { full: 8, day: 6, month: 6, year: 4 };
    if (!(variant in lengths) || inputLength !== lengths[variant as keyof typeof lengths]) throw new Error('Geçersiz tarih koşulu.');
  } else if (type === 'puzzle') {
    if (!['short', 'medium', 'long', 'standard'].includes(variant) || inputLength != null) throw new Error('Geçersiz resim koşulu.');
  } else if (variant !== 'standard' || !Number.isInteger(inputLength) || inputLength! < 1 || inputLength! > 40 || (type === 'number' && inputLength !== 6) || (type === 'text' && inputLength !== 5) || (type === 'fin' && inputLength !== 7)) throw new Error('Geçersiz CAPTCHA koşulu.');
  return { variant, ...(inputLength == null ? {} : { inputLength }) };
}
export function addQuestionAttempt(questions: CaptchaQuestion[], index: number, type: CaptchaType, durationMs: number, correct: boolean, condition: CaptchaCondition, stage?: string) {
  let question = questions.find(item => item.index === index);
  if (!question) { question = { index, type, ...(stage ? { stage } : {}), attempts: 0, incorrect: 0, activeMs: 0, completed: false, conditions: [] }; questions.push(question); }
  if (question.completed || question.type !== type) throw new Error('CAPTCHA sıra/türü uyuşmuyor.');
  question.attempts++; question.incorrect += correct ? 0 : 1; question.activeMs += durationMs; question.completed = correct;
  const key = conditionKey(condition); if (!question.conditions.includes(key)) question.conditions.push(key);
}
export const legacyType = (type: string): CaptchaType | null => ({ tarih: 'date', dogum: 'birthdate', rakam: 'number' } as Record<string, CaptchaType>)[type] ?? (CAPTCHA_TYPES.includes(type as CaptchaType) ? type as CaptchaType : null);
