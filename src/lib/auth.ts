import { inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { api } from './api-client';
import { ADMIN_EMAIL } from './auth-config';
import { getFirebaseAuth } from './firebase';

export interface SessionUser { uid: string; email: string; name: string; status: 'admin' | 'user' }
export async function signIn(email: string, password: string): Promise<SessionUser> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== ADMIN_EMAIL) {
    return (await api<{ user: SessionUser }>('auth/login', 'POST', { email: normalizedEmail, password })).user;
  }
  const auth = getFirebaseAuth();
  await setPersistence(auth, inMemoryPersistence);
  try {
    const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    const idToken = await credential.user.getIdToken(true);
    return (await api<{ user: SessionUser }>('auth/admin', 'POST', { idToken })).user;
  } finally {
    await firebaseSignOut(auth);
  }
}
export async function getSession() {
  return (await api<{ user: SessionUser }>('auth/session')).user;
}
export async function signOut() { await api('auth/logout', 'POST', {}); }
