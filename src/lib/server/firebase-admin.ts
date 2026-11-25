import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function adminServices() {
  if (typeof window !== 'undefined') throw new Error('Server-only module');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('Firebase server/client project configuration is missing or inconsistent.');
  }
  let app = getApps().find((app) => app.name === 'chapca-server');
  if (!app) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const emulator = process.env.CHAPCA_EMULATORS === 'true' && projectId.startsWith('demo-');
    if (emulator) {
      if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') ||
          !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
        throw new Error('Both localhost emulators are required.');
      }
      app = initializeApp({ projectId }, 'chapca-server');
    } else {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST ||
          !clientEmail || !privateKey) throw new Error('Firebase Admin credentials are missing.');
      app = initializeApp({ projectId, credential: cert({ projectId, clientEmail, privateKey }) }, 'chapca-server');
    }
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
