import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeTrialSubscription, SUPER_ADMIN_EMAIL } from "./license.js";

export async function registerNewHotel(hotelData, email, password) {
  let cred = null;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const hotelId = "hotel_" + user.uid.substring(0, 8);

    await initializeTrialSubscription(hotelId, hotelData.name, email, user.uid);
    await setDoc(doc(db, "hotels", hotelId), {
      address: hotelData.address || "Station Road, West Bengal",
      gstin: hotelData.gstin || "19ABCDE1234F1Z5",
      phone: hotelData.phone || "+91 98320 XXXXX",
      checkInTime: "12:00 PM",
      checkOutTime: "11:00 AM",
      defaultWifi: "Welcome@123",
      floors: ["Floor 1", "Floor 2", "Floor 3"]
    }, { merge: true });

    const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid, email, hotelId, role: isSuper ? "superadmin" : "owner",
      createdAt: new Date().toISOString()
    });
    return { success: true, hotelId };
  } catch (err) {
    if (cred && cred.user) {
      try { await deleteDoc(doc(db, "users", cred.user.uid)); } catch(e){}
      try { await cred.user.delete(); } catch(e){}
    }
    throw new Error(err.message || "Registration failed");
  }
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  if (!snap.exists()) { await signOut(auth); throw new Error("User record not found."); }
  return { success: true, user: cred.user, profile: snap.data() };
}

export async function logoutUser() {
  await signOut(auth);
  window.location.href = "index.html";
}

export function monitorAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      if (!snap || !snap.exists()) { await signOut(auth); callback(null); return; }
      callback({ user, profile: snap.data() });
    } else {
      callback(null);
    }
  });
}
