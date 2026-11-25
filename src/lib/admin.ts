import { getSession } from './auth';

export async function checkUserStatus(email: string) {
  try {
    const user = await getSession();
    return user.email === email.trim().toLowerCase() ? user.status : null;
  } catch { return null; }
}
export async function isAdmin(email: string) { return await checkUserStatus(email) === 'admin'; }
export async function isUser(email: string) { return await checkUserStatus(email) === 'user'; }
