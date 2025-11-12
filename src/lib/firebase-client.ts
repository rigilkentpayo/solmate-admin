// src/lib/firebase-client.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

// Safety helper for required env vars
function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[Firebase] Missing environment variable: ${name}`);
    return "";
  }
  return v;
}

const firebaseConfig = {
  apiKey: env("NEXT_PUBLIC_FB_API_KEY"),
  authDomain: env("NEXT_PUBLIC_FB_AUTH_DOMAIN"),
  projectId: env("NEXT_PUBLIC_FB_PROJECT_ID"),
  databaseURL: env("NEXT_PUBLIC_FB_DB_URL"),
  storageBucket: env("NEXT_PUBLIC_FB_STORAGE_BUCKET"),
  appId: env("NEXT_PUBLIC_FB_APP_ID"),
  messagingSenderId: env("NEXT_PUBLIC_FB_MESSAGING_SENDER_ID"),
};

// Ensure single app instance
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Export same names your existing pages use
export const auth: Auth = getAuth(app);
export const db: Database = getDatabase(app);

export default app;
