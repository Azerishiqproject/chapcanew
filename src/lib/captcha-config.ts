export const CAPTCHA_TYPES = ['date', 'number', 'text', 'birthdate', 'fin', 'religion', 'favoriteCar', 'puzzle'] as const;
export type CaptchaType = typeof CAPTCHA_TYPES[number];
export interface CaptchaState {
  allowedTypes: CaptchaType[];
  requiredCount: number;
  enabled: boolean;
  dateConfig: { todayDate: string; birthDate: string };
  personalConfig: { fin: string; religion: string; favoriteCar: string };
}
export function dateText(date = new Date()) { return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`; }
export function canonicalDate(value: string): string | null {
  const input = value.trim();
  const match = input.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${match[3]}`;
}
export function normalizeAnswer(value: string) { return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('az'); }
export function matchesAnswer(type: CaptchaType, value: string, expected: string) {
  if (type === 'date' || type === 'birthdate') { const date = canonicalDate(expected); return date !== null && canonicalDate(value) === date; }
  if (type === 'text' || type === 'number') return !!value.trim() && value.trim().toLowerCase() === expected.trim().toLowerCase();
  if (type === 'fin') return /^[A-Z0-9]{7}$/.test(value.trim().toUpperCase()) && value.trim().toUpperCase() === expected.trim().toUpperCase();
  return value.trim().length > 0 && normalizeAnswer(value) === normalizeAnswer(expected);
}
export function defaultCaptchaSettings(now = new Date()): CaptchaState {
  return { enabled: true, requiredCount: 1, allowedTypes: ['date', 'number', 'text', 'birthdate'], dateConfig: { todayDate: dateText(now), birthDate: '25/08/1990' }, personalConfig: { fin: '69SZNKO', religion: 'İslam', favoriteCar: 'Mercedes' } };
}
/** A fresh default per load; missing user settings never inherit another user's Redux state. */
export function resolveCaptchaSettings(settings?: Partial<CaptchaState> | null, now = new Date()): CaptchaState {
  const defaults = defaultCaptchaSettings(now);
  return { enabled: settings?.enabled ?? defaults.enabled, requiredCount: settings?.requiredCount ?? defaults.requiredCount,
    allowedTypes: [...new Set(settings?.allowedTypes ?? defaults.allowedTypes)],
    dateConfig: { todayDate: settings?.dateConfig?.todayDate ?? defaults.dateConfig.todayDate, birthDate: settings?.dateConfig?.birthDate ?? defaults.dateConfig.birthDate },
    personalConfig: { fin: settings?.personalConfig?.fin ?? defaults.personalConfig.fin, religion: settings?.personalConfig?.religion ?? defaults.personalConfig.religion, favoriteCar: settings?.personalConfig?.favoriteCar ?? defaults.personalConfig.favoriteCar },
  };
}
export function normalizeCaptchaSettings(settings: CaptchaState): CaptchaState {
  return { ...settings, allowedTypes: [...new Set(settings.allowedTypes)],
    dateConfig: { todayDate: canonicalDate(settings.dateConfig.todayDate) ?? settings.dateConfig.todayDate.trim(), birthDate: canonicalDate(settings.dateConfig.birthDate) ?? settings.dateConfig.birthDate.trim() },
    personalConfig: { fin: settings.personalConfig.fin.trim().toUpperCase(), religion: settings.personalConfig.religion.trim().replace(/\s+/g, ' '), favoriteCar: settings.personalConfig.favoriteCar.trim().replace(/\s+/g, ' ') },
  };
}
export function captchaSettingsErrors(settings: CaptchaState): string[] {
  const errors: string[] = [];
  if (typeof settings.enabled !== 'boolean' || settings.allowedTypes.some(type => !CAPTCHA_TYPES.includes(type))) errors.push('CAPTCHA ayarları düzgün deyil.');
  if (!Number.isInteger(settings.requiredCount) || settings.requiredCount < 1 || settings.requiredCount > 5) errors.push('CAPTCHA sayı 1–5 arasında tam ədəd olmalıdır.');
  if (settings.personalConfig.fin.length > 7 || settings.personalConfig.religion.length > 40 || settings.personalConfig.favoriteCar.length > 40) errors.push('Şəxsi cavablar icazə verilən uzunluğu aşır.');
  if (!settings.enabled) return errors;
  if (!settings.allowedTypes.length) errors.push('Ən azı bir CAPTCHA növü seçin.');
  if (settings.allowedTypes.includes('date') && !canonicalDate(settings.dateConfig.todayDate)) errors.push('Bugünkü tarix etibarlı GG/AA/İİİİ formatında olmalıdır.');
  if (settings.allowedTypes.includes('birthdate') && !canonicalDate(settings.dateConfig.birthDate)) errors.push('Doğum tarixi etibarlı GG/AA/İİİİ formatında olmalıdır.');
  if (settings.allowedTypes.includes('fin') && !/^[A-Z0-9]{7}$/.test(settings.personalConfig.fin.trim().toUpperCase())) errors.push('FİN kodu 7 hərf və ya rəqəmdən ibarət olmalıdır.');
  for (const [type, label] of [['religion', 'Din'], ['favoriteCar', 'Sevimli maşın']] as const) {
    if (settings.allowedTypes.includes(type) && !settings.personalConfig[type].trim()) errors.push(`${label} cavabını daxil edin.`);
  }
  return errors;
}
