// src/lib/firebase-client.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

/**
 * Fallback helper: uses process.env value if defined, otherwise uses the known SolMate production key.
 */
function safeEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (!v) {
    console.warn(`[Firebase] Missing env var ${name}. Using fallback.`);
    return fallback;
  }
  return v;
}

// --- Firebase Web configuration ---
const firebaseConfig = {
  apiKey: safeEnv("NEXT_PUBLIC_FB_API_KEY", "AIzaSyCjc3IGcsbBQd3BwZ3Rn8VaDOq1IP-ort4"),
  authDomain: safeEnv("NEXT_PUBLIC_FB_AUTH_DOMAIN", "solmate-app1.firebaseapp.com"),
  databaseURL: safeEnv("NEXT_PUBLIC_FB_DB_URL", "https://solmate-app1-default-rtdb.firebaseio.com"),
  projectId: safeEnv("NEXT_PUBLIC_FB_PROJECT_ID", "solmate-app1"),
  storageBucket: safeEnv("NEXT_PUBLIC_FB_STORAGE_BUCKET", "solmate-app1.appspot.com"),
  messagingSenderId: safeEnv("NEXT_PUBLIC_FB_MESSAGING_SENDER_ID", "834511417503"),
  appId: safeEnv("NEXT_PUBLIC_FB_APP_ID", "1:834511417503:web:fe6c0eae4d134c81998223"),
};

// --- Ensure a single initialized app ---
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// --- Exports used across your app ---
export const auth: Auth = getAuth(app);
export const db: Database = getDatabase(app);
export default app;
