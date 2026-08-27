import fs from 'node:fs/promises';
import path from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  Bytes,
  DocumentReference,
  GeoPoint,
  Timestamp,
  collection,
  getDocs,
  getFirestore,
} from 'firebase/firestore';

const DEFAULT_COLLECTIONS = [
  'users',
  'chapcaSessions',
  'salesSessions',
  'aimSessions',
  'captchaSettings',
];

async function readEnvFile(filename) {
  const env = {};

  try {
    const source = await fs.readFile(filename, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;

      env[match[1].trim()] = match[2]
        .trim()
        .replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  return env;
}

function encodeFirestoreValue(value) {
  if (value instanceof Timestamp) {
    return {
      __firestoreType: 'timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }

  if (value instanceof GeoPoint) {
    return {
      __firestoreType: 'geopoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (value instanceof Bytes) {
    return {
      __firestoreType: 'bytes',
      base64: value.toBase64(),
    };
  }

  if (value instanceof DocumentReference) {
    return {
      __firestoreType: 'reference',
      path: value.path,
    };
  }

  if (Array.isArray(value)) {
    return value.map(encodeFirestoreValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        encodeFirestoreValue(nestedValue),
      ]),
    );
  }

  return value;
}

const fileEnv = await readEnvFile(path.resolve('.env.local'));
const env = { ...fileEnv, ...process.env };
const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase configuration is missing from .env.local.');
}

const collectionNames = env.FIRESTORE_COLLECTIONS
  ? env.FIRESTORE_COLLECTIONS.split(',').map((name) => name.trim()).filter(Boolean)
  : DEFAULT_COLLECTIONS;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const exportedAt = new Date();
const exportData = {
  formatVersion: 1,
  sourceProjectId: firebaseConfig.projectId,
  exportedAt: exportedAt.toISOString(),
  collections: {},
};

for (const collectionName of collectionNames) {
  const snapshot = await getDocs(collection(db, collectionName));
  exportData.collections[collectionName] = snapshot.docs.map((snapshotDocument) => ({
    id: snapshotDocument.id,
    path: snapshotDocument.ref.path,
    data: encodeFirestoreValue(snapshotDocument.data()),
  }));
  console.log(`${collectionName}: ${snapshot.size} documents`);
}

const safeTimestamp = exportedAt.toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const outputDirectory = path.resolve('backups');
const outputPath = path.join(
  outputDirectory,
  `firestore-${firebaseConfig.projectId}-${safeTimestamp}.json`,
);

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(exportData, null, 2)}\n`, {
  mode: 0o600,
});

const totalDocuments = Object.values(exportData.collections)
  .reduce((total, documents) => total + documents.length, 0);

console.log(`TOTAL: ${totalDocuments} documents`);
console.log(`OUTPUT: ${outputPath}`);

await deleteApp(app);
