import { getUserByEmail } from './users';

// Firestore tabanlı login
export const signIn = async (email: string, password: string) => {
  try {
    const { user, error } = await getUserByEmail(email);

    if (error) {
      return { user: null, error };
    }

    if (!user) {
      // Login sayfasındaki hata mesajları için Firebase benzeri kodlar
      return { user: null, error: 'auth/user-not-found' };
    }

    if (!user.password || user.password !== password) {
      return { user: null, error: 'auth/wrong-password' };
    }

    // Firebase User benzeri minimal obje
    return {
      user: {
        uid: user.id || '',
        email: user.email,
      },
      error: null,
    };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

// Artık gerçek Firebase oturumu yok, sadece frontend state'i temizleyeceğiz
export const signOut = async () => {
  return { error: null };
};

