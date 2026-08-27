import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CaptchaState, CaptchaType } from '@/store/slices/captchaSlice';

const VALID_CAPTCHA_TYPES: CaptchaType[] = [
  'date',
  'number',
  'text',
  'birthdate',
  'fin',
  'religion',
  'favoriteCar',
];

export type CaptchaSettingsInput = Pick<
  CaptchaState,
  'allowedTypes' | 'requiredCount' | 'dateConfig' | 'personalConfig' | 'enabled'
>;

export async function getUserCaptchaSettings(userId: string) {
  try {
    const snapshot = await getDoc(doc(db, 'captchaSettings', userId));
    if (!snapshot.exists()) {
      return { settings: null, error: null };
    }

    const data = snapshot.data();
    const allowedTypes = Array.isArray(data.allowedTypes)
      ? data.allowedTypes.filter((type): type is CaptchaType =>
          VALID_CAPTCHA_TYPES.includes(type as CaptchaType),
        )
      : undefined;

    const settings: Partial<CaptchaState> = {
      allowedTypes: allowedTypes?.length ? allowedTypes : undefined,
      requiredCount:
        typeof data.requiredCount === 'number'
          ? Math.min(5, Math.max(1, data.requiredCount))
          : undefined,
      dateConfig: data.dateConfig,
      personalConfig: data.personalConfig,
      enabled: typeof data.enabled === 'boolean' ? data.enabled : undefined,
    };

    return { settings, error: null };
  } catch (error: unknown) {
    return {
      settings: null,
      error: error instanceof Error ? error.message : 'Captcha ayarları yüklənmədi',
    };
  }
}

export async function saveUserCaptchaSettings(
  userId: string,
  settings: CaptchaSettingsInput,
) {
  try {
    await setDoc(
      doc(db, 'captchaSettings', userId),
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { error: null };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : 'Captcha ayarları yadda saxlanılmadı',
    };
  }
}
