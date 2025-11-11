// src/lib/firebase-client.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
  databaseURL: process.env.NEXT_PUBLIC_FB_DB_URL!, // <= RTDB URL
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET!,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
  // measurementId: process.env.NEXT_PUBLIC_FB_MEASUREMENT_ID, // optional
};

const app = getApps().length ? getApps()[0] : initializeApp(config);

export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
