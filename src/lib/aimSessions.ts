import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

export interface AimSession {
  email: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalDuration: number; // milliseconds
  totalDurationSeconds: number; // seconds (for backward compatibility)
  gameMode: 'normal' | 'drag-drop' | 'dual-targets' | 'moving-targets';
  score: number;
  misses: number;
  expiredTargets: number;
  accuracy: number;
  level: number;
  createdAt: Timestamp;
}

// Save aim session to Firestore
export const saveAimSession = async (session: Omit<AimSession, 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'aimSessions'), {
      ...session,
      createdAt: Timestamp.now(),
    });
    return { id: docRef.id, error: null };
  } catch (error: any) {
    console.error('Error saving aim session:', error);
    return { id: null, error: error.message };
  }
};

// Kullanıcının simulyasiya oturumlarını sayfa ilə getir
export const getUserAimSessions = async (email: string, pageSize: number = 10, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, 'aimSessions'),
        where('email', '==', email),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, 'aimSessions'),
        where('email', '==', email),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }

    const querySnapshot = await getDocs(q);
    const sessions: (AimSession & { id: string })[] = [];
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data() as AimSession,
      });
    });

    return { sessions, lastDoc: lastVisible, error: null };
  } catch (error: any) {
    console.error('Error fetching aim sessions:', error);
    return { sessions: [], lastDoc: null, error: error.message };
  }
};
