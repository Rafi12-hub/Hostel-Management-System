// Firebase initialization. Credentials are provided via environment variables
// (.env.local). Never commit real credentials to source control.
import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Cloud Firestore database.
export const db = getFirestore(app);

// Keep the user signed in across browser restarts.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set Firebase auth persistence", err);
});

// Dynamic analytics import (firebase/analytics is browser-only and optional).
export async function getAppAnalytics() {
  try {
    const { getAnalytics } = await import("firebase/analytics");
    return getAnalytics(app);
  } catch (err) {
    console.warn("Analytics unavailable", err);
    return null;
  }
}
