import { api, errorMessage } from './api-client';
import type { CaptchaState } from '@/store/slices/captchaSlice';

export type CaptchaSettingsInput = Pick<CaptchaState, 'allowedTypes' | 'requiredCount' | 'dateConfig' | 'personalConfig' | 'enabled'>;
export async function getUserCaptchaSettings(userId: string) {
  try { return { ...await api<{ settings: Partial<CaptchaState> | null }>(`captcha-settings/${encodeURIComponent(userId)}`), error: null }; }
  catch (error) { return { settings: null, error: errorMessage(error) }; }
}
export async function saveUserCaptchaSettings(userId: string, settings: CaptchaSettingsInput) {
  try { await api(`captcha-settings/${encodeURIComponent(userId)}`, 'PUT', settings); return { error: null }; }
  catch (error) { return { error: errorMessage(error) }; }
}
