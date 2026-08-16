import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app = null;
let authInstance = null;
let googleProviderInstance = null;

export async function getFirebaseAuth() {
  if (authInstance) return authInstance;
  if (!firebaseConfig.apiKey) return null;
  if (!app) app = initializeApp(firebaseConfig);
  const { getAuth } = await import("firebase/auth");
  authInstance = getAuth(app);
  return authInstance;
}

export async function getGoogleProvider() {
  if (googleProviderInstance) return googleProviderInstance;
  const { GoogleAuthProvider } = await import("firebase/auth");
  googleProviderInstance = new GoogleAuthProvider();
  return googleProviderInstance;
}

export { authInstance as auth };
