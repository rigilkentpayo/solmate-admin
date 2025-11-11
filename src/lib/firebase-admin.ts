// src/lib/firebase-admin.ts
import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const projectId   = process.env.FIREBASE_PROJECT_ID ?? "";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";
// Replace escaped \n with real newlines for multiline keys
const privateKey  = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
// Prefer server var, fall back to public one if needed
const databaseURL = process.env.FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FB_DB_URL ?? "";

const adminApp: App =
    getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
            databaseURL,
        });

export const adminAuth = getAuth(adminApp);
export const adminDb   = getDatabase(adminApp);
export { adminApp };
