import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';

// Check if the config is still using placeholders
export const isFirebaseConfigured = config && 
  config.apiKey && 
  !Object.values(config).some(v => typeof v === 'string' && v.includes('PLACEHOLDER'));

const firebaseConfig = isFirebaseConfigured ? config : {
  apiKey: "dummy-key",
  authDomain: "dummy.firebaseapp.com",
  projectId: "dummy-project",
  storageBucket: "dummy.appspot.com",
  messagingSenderId: "12345",
  appId: "1:12345:web:12345",
  firestoreDatabaseId: "(default)"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export default app;
