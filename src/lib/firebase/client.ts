"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  type Auth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Single Auth instance with explicit persistence (IndexedDB → localStorage).
 * Avoids relying on implicit init ordering and helps sessions survive refresh on mobile
 * and embedded WebViews where defaults behave inconsistently.
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    try {
      auth = initializeAuth(firebaseApp, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        // Required: without this, signInWithRedirect / getRedirectResult throw
        // auth/argument-error silently on any browser (mobile and desktop).
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
      if (code === "auth/already-initialized") {
        auth = getAuth(firebaseApp);
      } else {
        throw e;
      }
    }
  }
  return auth;
}

/**
 * Single Firestore instance (default in-memory local cache).
 * We intentionally avoid `persistentLocalCache` + multi-tab IndexedDB here:
 * that stack has been linked to rare INTERNAL ASSERTION failures and odd
 * watch-pipeline state when combined with dev HMR, mobile WebViews, and rapid
 * listener churn during gameplay. Default memory cache keeps watches stable;
 * realtime sync is server-driven via snapshots anyway.
 */
export function getFirebaseDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}
