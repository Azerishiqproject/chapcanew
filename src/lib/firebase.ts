import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

// No fallback to the previous Firebase project. Initialize only on admin login.
export function getFirebaseAuth() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId || !config.authDomain) {
    throw new Error('Firebase yapılandırması henüz tamamlanmadı.');
  }
  const auth = getAuth(getApps().length ? getApp() : initializeApp(config));
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && process.env.NODE_ENV === 'development' && config.projectId.startsWith('demo-') && !auth.emulatorConfig) {
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(emulator)) throw new Error('Invalid local Auth emulator URL.');
    connectAuthEmulator(auth, emulator, { disableWarnings: true });
  }
  return auth;
}
