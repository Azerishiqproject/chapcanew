import { canonicalDate } from './captcha-config';
export const DATE_PARTS = ['day', 'month', 'year'] as const;
export type DatePart = typeof DATE_PARTS[number];
export const DATE_WIDTHS = { day: 2, month: 2, year: 4 } as const;
export const DATE_LABELS = { day: 'Gün', month: 'Ay', year: 'İl' } as const;
export interface DateChallenge { expected: string; fixed: DatePart | null; values: Record<DatePart, string> }
/** Empty, day, month and year variants each have equal probability. Only one part can be fixed. */
export function createDateChallenge(date: string, random = Math.random): DateChallenge {
  const expected = canonicalDate(date);
  if (!expected) throw new Error('Etibarlı tarix daxil edin.');
  const [day, month, year] = expected.split('/');
  return { expected, fixed: ([null, ...DATE_PARTS] as const)[Math.floor(random() * 4)], values: { day, month, year } };
}
export function dateInputLength(challenge: DateChallenge) { return 8 - (challenge.fixed ? DATE_WIDTHS[challenge.fixed] : 0); }
export function dateEntryParts(challenge: DateChallenge, input: string): Record<DatePart, string> {
  let offset = 0;
  return Object.fromEntries(DATE_PARTS.map(part => {
    if (part === challenge.fixed) return [part, challenge.values[part]];
    const value = input.slice(offset, offset + DATE_WIDTHS[part]); offset += DATE_WIDTHS[part];
    return [part, value];
  })) as Record<DatePart, string>;
}
export function enteredDate(challenge: DateChallenge, input: string) {
  const parts = dateEntryParts(challenge, input);
  return `${parts.day}/${parts.month}/${parts.year}`;
}
