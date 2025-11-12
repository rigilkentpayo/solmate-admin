// src/lib/firebase-config.ts
export const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY ?? "AIzaSyCjc3IGcsbBQd3BwZ3Rn8VaDOq1IP-ort4",
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN ?? "solmate-app1.firebaseapp.com",
    databaseURL: process.env.NEXT_PUBLIC_FB_DB_URL ?? "https://solmate-app1-default-rtdb.firebaseio.com",
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID ?? "solmate-app1",
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET ?? "solmate-app1.appspot.com",
    messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID ?? "834511417503",
    appId: process.env.NEXT_PUBLIC_FB_APP_ID ?? "1:834511417503:web:fe6c0eae4d134c81998223",
};
