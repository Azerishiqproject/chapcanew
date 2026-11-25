import { api, errorMessage, type PageCursor } from './api-client';

export type UserStatus = 'admin' | 'user';
export interface User {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
}
export type UserUpdate = Partial<Pick<User, 'email' | 'name' | 'phone' | 'status'>> & { password?: string };
export async function createUser(email: string, password: string, userData: Pick<User, 'name' | 'phone' | 'status'>) {
  try {
    const { user } = await api<{ user: User }>('users', 'POST', { ...userData, email, password });
    return { id: user.id!, userId: null, user, error: null };
  } catch (error) { return { id: null, userId: null, user: null, error: errorMessage(error) }; }
}
export async function getUserByEmail(email: string) {
  try { return { ...await api<{ user: User | null }>(`users?${new URLSearchParams({ email })}`), error: null }; }
  catch (error) { return { user: null, error: errorMessage(error) }; }
}
export async function getAllUsers(pageSize = 20, lastDoc: PageCursor | null = null) {
  try {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (lastDoc) params.set('cursor', lastDoc);
    return { ...await api<{ users: User[]; lastDoc: PageCursor | null }>(`users?${params}`), error: null };
  } catch (error) { return { users: [], lastDoc: null, error: errorMessage(error) }; }
}
export async function updateUser(userId: string, userData: UserUpdate) {
  try { return { ...await api<{ user: User }>(`users/${encodeURIComponent(userId)}`, 'PATCH', userData), error: null }; }
  catch (error) { return { user: null, error: errorMessage(error) }; }
}
export async function deleteUser(userId: string) {
  try { await api(`users/${encodeURIComponent(userId)}`, 'DELETE', {}); return { error: null }; }
  catch (error) { return { error: errorMessage(error) }; }
}
