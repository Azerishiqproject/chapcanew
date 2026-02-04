import { getUserByEmail } from './users';
import type { UserStatus } from './users';

// Firestore'dan kullanıcı status'unu kontrol et
export const checkUserStatus = async (email: string): Promise<UserStatus | null> => {
  try {
    const { user, error } = await getUserByEmail(email);
    if (error || !user) {
      return null;
    }
    return user.status;
  } catch (error) {
    return null;
  }
};

// Admin kontrolü
export const isAdmin = async (email: string): Promise<boolean> => {
  const status = await checkUserStatus(email);
  return status === 'admin';
};

// User kontrolü
export const isUser = async (email: string): Promise<boolean> => {
  const status = await checkUserStatus(email);
  return status === 'user';
};
