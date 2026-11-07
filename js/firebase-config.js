// SmartFix HMS - Firebase Modular SDK Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Production Firebase Configuration for SmartFix HMS
const firebaseConfig = {
  apiKey: "AIzaSyD1AHWnACQLXm_sr7lERgPov1ZM6yOLP4k",
  authDomain: "smartfix-hms.firebaseapp.com",
  projectId: "smartfix-hms",
  storageBucket: "smartfix-hms.firebasestorage.app",
  messagingSenderId: "239785995748",
  appId: "1:239785995748:web:8d05011acfa6f972752bf1"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore & Auth
const db = getFirestore(app);
const auth = getAuth(app);

// Enable Offline Persistence for Local Caching (PWA Support)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("SmartFix HMS: Multiple tabs open, persistence enabled in first tab only.");
  } else if (err.code === 'unimplemented') {
    console.warn("SmartFix HMS: Current browser does not support offline persistence.");
  }
});

// Set Auth Persistence to LocalStorage (Persist login session across reloads)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("SmartFix HMS Auth Persistence Error:", error);
});

export { app, db, auth };
