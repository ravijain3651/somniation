import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let client: FirebaseClient | undefined;

/**
 * Browser-only Firebase bootstrap. Always loaded through a dynamic import so the
 * SDK stays out of the initial bundle and never runs during prerender.
 * Emulators are connected exactly once because the client is memoised.
 */
export function getFirebase(): FirebaseClient {
  if (client) return client;
  const app = initializeApp(environment.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (environment.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  client = { app, auth, db, storage };
  return client;
}
