/**
 * Firebase web client configuration.
 * Prefer NEXT_PUBLIC_* env vars in production; defaults match the project you provided.
 *
 * Email link sign-in: enable "Email link" in Firebase Console → Authentication → Sign-in method → Email/Password,
 * add authorized domains, and (optional) set `NEXT_PUBLIC_EMAIL_SIGNIN_CONTINUE_URL` if the public URL differs
 * from `window.location.origin` (e.g. custom domain vs default hosting URL).
 */
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyD91ZuZTiQp7hDos-djjZisxkINB1xlItQ",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "whoami-76238.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "whoami-76238",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "whoami-76238.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1025205037441",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:1025205037441:web:277d3ee3fcdd0903d6a080",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-ZESC1FN33S",
};
