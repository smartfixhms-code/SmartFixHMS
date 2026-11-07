import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1AHWnACQLXm_sr7lERgPov1ZM6yOLP4k",
  authDomain: "smartfix-hms.firebaseapp.com",
  projectId: "smartfix-hms",
  storageBucket: "smartfix-hms.firebasestorage.app",
  messagingSenderId: "239785995748",
  appId: "1:239785995748:web:8d05011acfa6f972752bf1"
};

const app = initializeApp(firebaseConfig);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
  db = getFirestore(app);
}

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
export { app, db, auth };
