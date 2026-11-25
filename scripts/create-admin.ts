import { ADMIN_EMAIL } from '../src/lib/auth-config';
import { adminServices } from '../src/lib/server/firebase-admin';
import { passwordInput } from '../src/lib/server/security';

async function main() {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project || process.argv.find((arg) => arg.startsWith('--confirm-project=')) !== `--confirm-project=${project}`) {
    throw new Error('Hedefi belirtin: npm run setup:admin -- --confirm-project=YENI_PROJE_ID');
  }
  const { auth } = adminServices();
  let user;
  try { user = await auth.getUserByEmail(ADMIN_EMAIL); }
  catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({
      email: ADMIN_EMAIL, password: passwordInput(process.env.ADMIN_INITIAL_PASSWORD, true), displayName: 'Admin',
    });
  }
  // Existing passwords are not overwritten. The account may be created in Console.
  if (user.disabled) throw new Error('Admin hesabı devre dışı; Firebase Console üzerinden kontrol edin.');
  if (process.env.FIREBASE_ADMIN_UID && process.env.FIREBASE_ADMIN_UID !== user.uid) {
    throw new Error('Admin UID yapılandırması Auth kaydıyla eşleşmiyor.');
  }
  console.log(`FIREBASE_ADMIN_UID=${user.uid}`);
  console.log(`Admin hazır: ${ADMIN_EMAIL} (${project}). Firestore users kaydı oluşturulmadı.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
