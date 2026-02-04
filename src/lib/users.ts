import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserStatus = 'admin' | 'user';

export interface User {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  // Not: Demo amaçlı direkt saklanıyor, production'da HASH kullanılmalı
  password?: string;
  status: UserStatus;
  createdAt?: string; // ISO string formatında
  updatedAt?: string; // ISO string formatında
}

// Sadece Firestore'da kullanıcı oluştur
export const createUser = async (
  email: string,
  password: string,
  userData: Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>,
  adminEmail?: string,
  adminPassword?: string
) => {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      email,
      password,
      ...userData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return { id: docRef.id, userId: null, error: null };
  } catch (error: any) {
    return { id: null, userId: null, error: error.message };
  }
};

// Email'e göre kullanıcı bilgilerini Firestore'dan getir
export const getUserByEmail = async (email: string) => {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { user: null, error: null };
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    const user: User = {
      id: doc.id,
      email: data.email,
      password: data.password || '',
      name: data.name,
      phone: data.phone || '',
      status: data.status as UserStatus,
      createdAt: data.createdAt?.toDate()?.toISOString(),
      updatedAt: data.updatedAt?.toDate()?.toISOString(),
    };

    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

// Tüm kullanıcıları sayfa ilə getir
export const getAllUsers = async (pageSize: number = 20, lastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
  try {
    let q;
    if (lastDoc) {
      q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(pageSize)
      );
    } else {
      q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
    }

    const querySnapshot = await getDocs(q);
    const users: User[] = [];
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: data.email,
        name: data.name,
        phone: data.phone || '',
        status: data.status as UserStatus,
        createdAt: data.createdAt?.toDate()?.toISOString(),
        updatedAt: data.updatedAt?.toDate()?.toISOString(),
      });
    });
    return { users, lastDoc: lastVisible, error: null };
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return { users: [], lastDoc: null, error: error.message };
  }
};

// Kullanıcı güncelle
export const updateUser = async (userId: string, userData: Partial<User>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: Timestamp.now(),
    });
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Kullanıcı sil
export const deleteUser = async (userId: string) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// Backward compatibility için eski fonksiyonlar
export const createNormalUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
  return createUser('', '', { ...userData, status: 'user' });
};

export const getAllNormalUsers = getAllUsers;
export const updateNormalUser = updateUser;
export const deleteNormalUser = deleteUser;
