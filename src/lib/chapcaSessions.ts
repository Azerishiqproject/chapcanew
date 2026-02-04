import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

export interface ChapcaAttempt {
  type: 'tarih' | 'dogum' | 'text' | 'rakam';
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number; // milisaniye cinsinden
  durationSeconds: number; // saniye cinsinden (geriye dönük uyumluluk için)
  isCorrect: boolean;
}

export interface ChapcaSession {
  email: string;
  startTime: Timestamp;
  endTime: Timestamp;
  totalDuration: number; // milisaniye cinsinden
  totalDurationSeconds: number; // saniye cinsinden (geriye dönük uyumluluk için)
  chapcas: ChapcaAttempt[];
  createdAt: Timestamp;
}

// Chapca oturumunu Firestore'a kaydet
export const saveChapcaSession = async (session: Omit<ChapcaSession, 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'chapcaSessions'), {
      ...session,
      createdAt: Timestamp.now(),
    });
    return { id: docRef.id, error: null };
  } catch (error: any) {
    console.error('Error saving chapca session:', error);
    return { id: null, error: error.message };
  }
};

// Kullanıcının chapca oturumlarını sayfa ilə getir
export const getUserChapcaSessions = async (email: string, pageSize: number = 10, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
  try {
    // Not: orderBy ve where bir arada olunca index tələb edə bilər. 
    // Əgər xəta verərsə, createdAt üzrə index yaradılmalıdır.
    let q;
    if (lastDoc) {
      q = query(
        collection(db, 'chapcaSessions'),
        where('email', '==', email),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, 'chapcaSessions'),
        where('email', '==', email),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }

    const querySnapshot = await getDocs(q);
    const sessions: (ChapcaSession & { id: string })[] = [];
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    querySnapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data() as ChapcaSession,
      });
    });

    return { sessions, lastDoc: lastVisible, error: null };
  } catch (error: any) {
    console.error('Error fetching chapca sessions:', error);
    return { sessions: [], lastDoc: null, error: error.message };
  }
};
