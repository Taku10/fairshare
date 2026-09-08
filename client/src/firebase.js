// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, inMemoryPersistence, setPersistence } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const runtimeEnv = window.__ENV__ || {};

const firebaseConfig = {
  apiKey: runtimeEnv.FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: runtimeEnv.FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeEnv.FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: runtimeEnv.FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeEnv.FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeEnv.FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: runtimeEnv.FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Initialize analytics (not used directly but important for Firebase tracking)
try {
  if (typeof window !== 'undefined') {
    getAnalytics(app);
  }
} catch (e) {
  console.warn('Analytics initialization skipped:', e);
}
const auth = getAuth(app);

// Prevent cross-tab auth mirroring by scoping auth state per-tab.
// Use sessionStorage (per-tab) or in-memory (per-window) based on env flag.
{
  const useMemory = import.meta.env.VITE_AUTH_IN_MEMORY === 'true';
  // Avoid top-level await: fire-and-forget with catch
  setPersistence(auth, useMemory ? inMemoryPersistence : browserSessionPersistence)
    .catch((e) => {
      console.warn('Auth persistence setup failed, falling back to default:', e);
    });
}

export { auth };
