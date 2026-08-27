import fs from 'node:fs/promises';
import path from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  Bytes,
  GeoPoint,
  Timestamp,
  doc,
  getFirestore,
  writeBatch,
} from 'firebase/firestore';

function decodeFirestoreValue(value, db) {
  if (Array.isArray(value)) {
    return value.map((nestedValue) => decodeFirestoreValue(nestedValue, db));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value.__firestoreType === 'timestamp') {
    return new Timestamp(value.seconds, value.nanoseconds);
  }

  if (value.__firestoreType === 'geopoint') {
    return new GeoPoint(value.latitude, value.longitude);
  }

  if (value.__firestoreType === 'bytes') {
    return Bytes.fromBase64String(value.base64);
  }

  if (value.__firestoreType === 'reference') {
    return doc(db, value.path);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      decodeFirestoreValue(nestedValue, db),
    ]),
  );
}

const backupArgument = process.argv[2];
const confirmationArgument = process.argv.find((argument) =>
  argument.startsWith('--confirm-project='),
);

if (!backupArgument) {
  throw new Error(
    'Usage: node scripts/import-firestore.mjs <backup.json> --confirm-project=<project-id>',
  );
}

const firebaseConfig = {
  apiKey: process.env.TARGET_FIREBASE_API_KEY,
  authDomain: process.env.TARGET_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.TARGET_FIREBASE_PROJECT_ID,
  storageBucket: process.env.TARGET_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.TARGET_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.TARGET_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('TARGET_FIREBASE_API_KEY and TARGET_FIREBASE_PROJECT_ID are required.');
}

const confirmedProjectId = confirmationArgument?.split('=').slice(1).join('=');
if (confirmedProjectId !== firebaseConfig.projectId) {
  throw new Error(
    `Target project confirmation does not match ${firebaseConfig.projectId}.`,
  );
}

const backupPath = path.resolve(backupArgument);
const backup = JSON.parse(await fs.readFile(backupPath, 'utf8'));

if (backup.formatVersion !== 1 || !backup.collections) {
  throw new Error('Unsupported or invalid Firestore backup file.');
}

const app = initializeApp(firebaseConfig, `import-${Date.now()}`);
const db = getFirestore(app);
const documents = Object.entries(backup.collections).flatMap(
  ([collectionName, collectionDocuments]) =>
    collectionDocuments.map((documentData) => ({
      collectionName,
      ...documentData,
    })),
);

for (let offset = 0; offset < documents.length; offset += 500) {
  const batch = writeBatch(db);
  const chunk = documents.slice(offset, offset + 500);

  for (const documentData of chunk) {
    const documentReference = doc(
      db,
      documentData.collectionName,
      documentData.id,
    );
    batch.set(
      documentReference,
      decodeFirestoreValue(documentData.data, db),
    );
  }

  await batch.commit();
  console.log(`Imported ${Math.min(offset + chunk.length, documents.length)}/${documents.length}`);
}

for (const [collectionName, collectionDocuments] of Object.entries(backup.collections)) {
  console.log(`${collectionName}: ${collectionDocuments.length} documents`);
}

console.log(`SOURCE: ${backup.sourceProjectId}`);
console.log(`TARGET: ${firebaseConfig.projectId}`);
console.log(`TOTAL: ${documents.length} documents`);

await deleteApp(app);
