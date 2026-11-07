// auth.js - SmartFix HMS
// Firebase auth + hotel registration with safe rollback.
import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeTrialSubscription, SUPER_ADMIN_EMAIL } from "./license.js";

// ---------- Firestore doc ID from UID ----------
function hotelIdFromUid(uid) {
  return "hotel_" + uid.substring(0, 8);
}

// ---------- Human-friendly Firebase error translator ----------
function friendlyAuthError(err) {
  const code = err?.code || "";
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    default:
      return err?.message || "Something went wrong. Please try again.";
  }
}

// ---------- Register a new hotel + owner account ----------
export async function registerNewHotel(hotelData, email, password) {
  if (!hotelData || !hotelData.name) throw new Error("Hotel name is required.");
  if (!email || !password) throw new Error("Email and password are required.");

  let cred = null;
  const cleanup = { userCreated: false, hotelDocCreated: false, userDocCreated: false };
  const hotelIdPlaceholder = "hotel_pending";

  try {
    // STEP 1: Create auth user
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw new Error(friendlyAuthError(e));
    }
    const user = cred.user;
    cleanup.userCreated = true;
    const hotelId = hotelIdFromUid(user.uid);

    // STEP 2: Initialize trial subscription (writes to hotels/{hotelId})
    try {
      await initializeTrialSubscription(hotelId, hotelData.name, email, user.uid);
      cleanup.hotelDocCreated = true;
    } catch (e) {
      throw new Error("Could not initialize hotel trial: " + (e.message || e));
    }

    // STEP 3: Merge additional hotel operational fields
    try {
      await setDoc(
        doc(db, "hotels", hotelId),
        {
          address: hotelData.address || "Station Road, West Bengal",
          gstin: hotelData.gstin || "19ABCDE1234F1Z5",
          phone: hotelData.phone || "+91 98320 XXXXX",
          policyNote: "Standard check-in: 12:00 PM | Check-out: 11:00 AM.",
          floors: ["Floor 1", "Floor 2", "Floor 3"],
          defaultWifi: "Welcome@123"
        },
        { merge: true }
      );
    } catch (e) {
      throw new Error("Could not save hotel profile: " + (e.message || e));
    }

    // STEP 4: Create the user profile document (the critical link)
    const isSuper = String(email).toLowerCase() === String(SUPER_ADMIN_EMAIL).toLowerCase();
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        hotelId,
        role: isSuper ? "superadmin" : "owner",
        createdAt: new Date().toISOString()
      });
      cleanup.userDocCreated = true;
    } catch (e) {
      throw new Error("Could not save user profile: " + (e.message || e));
    }

    return { success: true, hotelId };
  } catch (err) {
    // ---------- BUG FIX #6: ROLLBACK ----------
    // If any step failed after the auth user was created, we MUST clean up.
    // Otherwise the user is stuck: auth account exists but no profile → every
    // subsequent login shows "User record not found".
    if (cleanup.userCreated && cred?.user) {
      try {
        // Delete any Firestore docs we managed to write
        const uid = cred.user.uid;
        if (cleanup.userDocCreated) {
          await deleteDoc(doc(db, "users", uid)).catch(() => {});
        }
        if (cleanup.hotelDocCreated) {
          await deleteDoc(doc(db, "hotels", hotelIdFromUid(uid))).catch(() => {});
        }
        // Finally delete the auth user so re-registration works cleanly
        await deleteUser(cred.user);
      } catch (cleanupErr) {
        // If deleteUser fails (e.g. session invalid), user may still be
        // signed in. Force a sign-out so next attempt starts fresh.
        console.warn("Rollback incomplete:", cleanupErr?.message);
        try { await signOut(auth); } catch {}
      }
    }
    throw err;
  }
}

// ---------- Login ----------
export async function loginUser(email, password) {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw new Error(friendlyAuthError(e));
  }

  // Load profile
  let snap;
  try {
    snap = await getDoc(doc(db, "users", cred.user.uid));
  } catch (e) {
    // Network / permissions issue — sign out so we don't leave a half-logged-in state
    await signOut(auth).catch(() => {});
    throw new Error("Could not load user profile. Please try again.");
  }

  if (!snap.exists()) {
    // Orphan auth user (registration was interrupted before the fix above was deployed,
    // or Firestore permissions blocked the initial write).
    // Sign out so user is not stuck.
    await signOut(auth).catch(() => {});
    throw new Error(
      "Your account profile is missing. Please contact support or re-register with a different email."
    );
  }

  return { success: true, user: cred.user, profile: snap.data() };
}

// ---------- Logout ----------
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Sign-out error:", e.message);
  }
  window.location.href = "index.html";
}

// ---------- Auth state monitor ----------
export function monitorAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        // Profile missing → force logout, avoid infinite redirect loop.
        await signOut(auth).catch(() => {});
        callback(null);
        return;
      }
      callback({ user, profile: snap.data() });
    } catch (e) {
      // Network failure while reading profile: still emit user (without profile)
      // so pages can decide what to do.
      console.warn("monitorAuthState profile fetch failed:", e.message);
      callback({ user, profile: null });
    }
  });
}
