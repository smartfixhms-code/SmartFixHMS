// firebase-config.js - SmartFix HMS
// Firebase modular SDK v10.8.0 initialization with modern persistent cache.
//
// Why this file uses `initializeFirestore` + `persistentLocalCache` instead of
// the deprecated `enableIndexedDbPersistence`:
//   • enableIndexedDbPersistence is deprecated since Firebase v9.22
//   • It only enables persistence in ONE tab — all other tabs get no cache
//   • persistentLocalCache + persistentMultipleTabManager shares one IndexedDB
//     across ALL tabs → true multi-tab realtime sync + offline support

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ---------------------------------------------------------------------------
// Firebase project credentials
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD1AHWnACQLXm_sr7lERgPov1ZM6yOLP4k",
  authDomain: "smartfix-hms.firebaseapp.com",
  projectId: "smartfix-hms",
  storageBucket: "smartfix-hms.firebasestorage.app",
  messagingSenderId: "239785995748",
  appId: "1:239785995748:web:8d05011acfa6f972752bf1"
};

// ---------------------------------------------------------------------------
// Initialize Firebase App
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);

// ---------------------------------------------------------------------------
// Initialize Firestore with persistent cache shared across tabs
// ---------------------------------------------------------------------------
// `initializeFirestore` throws if called twice for the same app, so wrap it.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback: if persistent cache setup fails (rare — e.g. corrupted IndexedDB,
  // private mode with storage blocked), fall back to the default in-memory cache
  // so the app still works online.
  console.warn(
    "SmartFix HMS: Persistent cache unavailable, falling back to memory cache.",
    e?.message
  );
  // Import getFirestore lazily to avoid double-init issues
  const { getFirestore } = await import(
    "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
  );
  db = getFirestore(app);
}

// ---------------------------------------------------------------------------
// Initialize Auth with persistent session (survives page reloads)
// ---------------------------------------------------------------------------
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  // Non-fatal: user will just need to log in again after reload.
  console.warn("SmartFix HMS: Auth persistence failed:", err?.message);
});

// ---------------------------------------------------------------------------
// OPTIONAL: Local emulator hook (DEV ONLY)
// Uncomment the block below when running `firebase emulators:start`.
// This prevents local testing from writing garbage into the production project.
// ---------------------------------------------------------------------------
// if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
//   const { connectFirestoreEmulator } = await import(
//     "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
//   );
//   const { connectAuthEmulator } = await import(
//     "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
//   );
//   try {
//     connectFirestoreEmulator(db, "localhost", 8080);
//     connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
//     console.info("SmartFix HMS: Connected to Firebase emulators.");
//   } catch (e) {
//     console.warn("Emulator connection failed:", e.message);
//   }
// }

export { app, db, auth };
