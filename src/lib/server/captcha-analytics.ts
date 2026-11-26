import { adminServices } from './firebase-admin';
import { requireAdmin, type Identity } from './session';
import { normalizeCaptchaRun, type AnalyticsSource, type CaptchaDataset } from '../captcha-analytics';
import { emailAddress } from './security';
/** Read all matching summaries; working state, expected answers and credentials are never returned. */
export async function captchaAnalytics(identity: Identity, email: string | null): Promise<CaptchaDataset> {
  requireAdmin(identity);
  const { db } = adminServices(); const target = email ? emailAddress(email) : null;
  const users = await (target ? db.collection('users').where('email', '==', target) : db.collection('users')).select('email', 'name').get();
  const names = new Map(users.docs.map(doc => [String(doc.data().email), String(doc.data().name)]));
  if (identity.status === 'admin') names.set(identity.email, identity.name);
  const sources = [['training', 'chapcaSessions'], ['sales', 'salesSessions']] as const;
  const data = await Promise.all(sources.map(async ([source, collection]: readonly [AnalyticsSource, string]) => {
    const query = target ? db.collection(collection).where('email', '==', target) : db.collection(collection);
    const snapshot = await query.select('email', 'startTime', 'createdAt', 'status', 'metricsVersion', 'plan', 'order', 'captchaConfig.enabled', 'captchaConfig.plan', 'captchaQuestions', 'totalDuration', 'interactionDurationMs', 'correctCaptchas', 'incorrectCaptchas', 'chapcas').get();
    return snapshot.docs.filter(doc => names.has(String(doc.data().email))).map(doc => normalizeCaptchaRun(doc.id, source, doc.data(), names.get(String(doc.data().email)) ?? String(doc.data().email)));
  }));
  return { runs: data.flat(), generatedAt: Date.now() };
}
