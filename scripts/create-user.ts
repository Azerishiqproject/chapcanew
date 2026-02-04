import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCZV_z2_kXGqZwsBbJPDDq_kfUQZ1pM16Y",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "worktodemo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "worktodemo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "worktodemo.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1091257161152",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1091257161152:web:3e8262a5df1e2a8b742425",
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

