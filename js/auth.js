import { auth, db } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeTrialSubscription, SUPER_ADMIN_EMAIL } from "./license.js";

export async function registerNewHotel(hotelData, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const hotelId = "hotel_" + user.uid.substring(0, 8);

  // Send Email Verification
  await sendEmailVerification(user);

  await initializeTrialSubscription(hotelId, hotelData.name, email, user.uid);
  await setDoc(doc(db, "hotels", hotelId), {
    address: hotelData.address || "Station Road, West Bengal",
    gstin: hotelData.gstin || "19ABCDE1234F1Z5",
    phone: hotelData.phone || "+91 98320 XXXXX",
    policyNote: "Standard check-in: 12:00 PM | Check-out: 11:00 AM.",
    floors: ["Floor 1", "Floor 2", "Floor 3"]
  }, { merge: true });

  const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid, email, hotelId, role: isSuper ? "superadmin" : "owner",
    createdAt: new Date().toISOString()
  });
  return { success: true, hotelId, emailVerified: false };
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists()) throw new Error("User record not found.");
  return { success: true, user: cred.user, profile: snap.data(), emailVerified: cred.user.emailVerified };
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

export function monitorAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      callback({ 
        user, 
        profile: snap && snap.exists() ? snap.data() : null,
        emailVerified: user.emailVerified
      });
    } else {
      callback(null);
    }
  });
}
