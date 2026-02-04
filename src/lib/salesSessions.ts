import { collection, addDoc, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';

export interface SalesSession {
    email: string;
    startTime: Timestamp;
    endTime: Timestamp;
    totalDuration: number; // milisaniye
    totalDurationSeconds: number;
    step1Duration: number;
    step2Duration: number;
    captchaDuration: number;
    correctCaptchas: number;
    incorrectCaptchas: number;
    project: string;
    createdAt: Timestamp;
}

// Save sales session to Firestore
export const saveSalesSession = async (session: Omit<SalesSession, 'createdAt'>) => {
    try {
        const docRef = await addDoc(collection(db, 'salesSessions'), {
            ...session,
            createdAt: Timestamp.now(),
        });
        return { id: docRef.id, error: null };
    } catch (error: any) {
        console.error('Error saving sales session:', error);
        return { id: null, error: error.message };
    }
};

// Get user sales sessions
export const getUserSalesSessions = async (email: string, pageSize: number = 10, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
    try {
        let q;
        if (lastDoc) {
            q = query(
                collection(db, 'salesSessions'),
                where('email', '==', email),
                orderBy('createdAt', 'desc'),
                startAfter(lastDoc),
                limit(pageSize)
            );
        } else {
            q = query(
                collection(db, 'salesSessions'),
                where('email', '==', email),
                orderBy('createdAt', 'desc'),
                limit(pageSize)
            );
        }

        const querySnapshot = await getDocs(q);
        const sessions: (SalesSession & { id: string })[] = [];
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

        querySnapshot.forEach((doc) => {
            sessions.push({
                id: doc.id,
                ...doc.data() as SalesSession,
            });
        });

        return { sessions, lastDoc: lastVisible, error: null };
    } catch (error: any) {
        console.error('Error fetching sales sessions:', error);
        return { sessions: [], lastDoc: null, error: error.message };
    }
};
