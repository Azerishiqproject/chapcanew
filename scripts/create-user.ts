import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD0SU6QHx4hbgVf9Arj_dFTzwU5ypCwUm0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mida-traninig.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mida-traninig",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mida-traninig.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "450096530520",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:450096530520:web:7c07414ffd6873c661362d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createUser() {
  try {
    // Admin kullanıcının bilgileri
    const email = 'rzayevumud80@gmail.com';
    const password = '11111111';
    const name = 'Admin User';
    const status: 'admin' = 'admin';

    console.log('Saving admin user to Firestore (no Firebase Auth)...');
    const docRef = await addDoc(collection(db, 'users'), {
      email,
      password,
      name,
      status,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log('✅ Admin user saved to Firestore:', docRef.id);
    console.log('\n🎉 Admin user created successfully!');
    console.log('Email:', email);
    console.log('Status:', status);
    console.log('Firestore Document ID:', docRef.id);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating user:', error.message);
    process.exit(1);
  }
}

createUser();
