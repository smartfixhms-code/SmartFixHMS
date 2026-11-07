// SmartFix HMS - Authentication & Email Verification Engine
import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
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
 * Register a new hotel, initiate trial and trigger verification email
 */
export async function registerNewHotel(hotelData, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const hotelId = "hotel_" + user.uid.substring(0, 8);

    // Send Real Verification Email Link
    await sendEmailVerification(user);

    // Initialize 30-Day trial profile
    await initializeTrialSubscription(hotelId, hotelData.name, email, user.uid);

    // Save extra hotel parameters
    await setDoc(doc(db, "hotels", hotelId), {
      address: hotelData.address || "Station Road, West Bengal",
      gstin: hotelData.gstin || "19ABCDE1234F1Z5",
      phone: hotelData.phone || "+91 98320 XXXXX",
      policyNote: "Standard check-in: 12:00 PM | Check-out: 11:00 AM.",
      floors: ["Floor 1", "Floor 2", "Floor 3"]
    }, { merge: true });

    // Store user reference
    const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      hotelId: hotelId,
      role: isSuper ? "superadmin" : "owner",
      createdAt: new Date().toISOString()
    });

    return { 
      success: true, 
      hotelId, 
      emailSent: true,
      message: "Registration successful! A verification link has been dispatched to your email." 
    };
  } catch (error) {
    console.error("Registration Error:", error);
    throw error;
  }
}

/**
 * Sign in existing user with email verification gate
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Super admin bypasses verification check
    const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    if (!user.emailVerified && !isSuper) {
      await signOut(auth);
      throw new Error("Email not verified! Please check your inbox and verify your email before signing in.");
    }

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      throw new Error("User profile not found in system.");
    }

    return { success: true, user, profile: userDocSnap.data() };
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Sign Out Error:", error);
  }
}

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
        callback({ user, profile: null });
      }
    } else {
      callback(null);
    }
  });
}
