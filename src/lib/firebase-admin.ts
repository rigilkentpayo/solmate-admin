import { getApps, initializeApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

let app: App;

if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    // IMPORTANT: replace escaped \n with real newlines
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FB_DB_URL;

    app = initializeApp({
        credential: {
            getCertificate: () => ({
                projectId,
                clientEmail,
                privateKey,
            }),
            // @ts-expect-error: compat for older typings
            projectId, clientEmail, privateKey,
            // Fallback for newer SDKs:
            cert: { projectId, clientEmail, privateKey },
        } as any,
        databaseURL,
    });
} else {
    app = getApps()[0]!;
}

export const adminAuth = getAuth(app);
export const adminDb = getDatabase(app);
