// SmartFix HMS - Authentication & Role Routing Engine
import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeTrialSubscription, SUPER_ADMIN_EMAIL } from "./license.js";

/**
 * Register a new hotel with automatic 30-day trial
 * @param {string} hotelName 
 * @param {string} email 
 * @param {string} password 
 */
export async function registerNewHotel(hotelName, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const hotelId = "hotel_" + user.uid.substring(0, 8);

    // Initialize the 30-Day trial inside hotels collection
    await initializeTrialSubscription(hotelId, hotelName, email, user.uid);

    // Assign role
    const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const userRole = isSuper ? "superadmin" : "owner";

    // Store user reference
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      hotelId: hotelId,
      role: userRole,
      createdAt: new Date().toISOString()
    });

    return { success: true, hotelId: hotelId, role: userRole };
  } catch (error) {
    console.error("Registration Error:", error);
    throw error;
  }
}

/**
 * Sign in existing hotel owner or super admin
 * @param {string} email 
 * @param {string} password 
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      throw new Error("User record not found in system.");
    }

    const userData = userDocSnap.data();
    return { success: true, user: user, profile: userData };
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("Sign Out Error:", error);
  }
}

/**
 * Auth state observer
 * @param {Function} callback 
 */
export function monitorAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          callback({ user, profile: userDocSnap.data() });
        } else {
          callback({ user, profile: null });
        }
      } catch (err) {
        console.error("Auth state fetch error:", err);
        callback({ user, profile: null });
      }
    } else {
      callback(null);
    }
  });
}
