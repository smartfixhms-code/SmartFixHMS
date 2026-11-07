import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const SUPER_ADMIN_EMAIL = "admin@smartfix.com";

export async function initializeTrialSubscription(hotelId, hotelName, ownerEmail, ownerUid) {
  const exp = new Date(); exp.setDate(exp.getDate() + 30);
  const data = { hotelId, hotelName, ownerEmail, ownerId: ownerUid, status: "trial", createdAt: new Date().toISOString(), planExpiresAt: exp.toISOString(), planType: "30_DAYS_TRIAL" };
  await setDoc(doc(db, "hotels", hotelId), data, { merge: true });
  return data;
}

export async function verifyLicenseStatus(hotelId) {
  if (!hotelId) return { isValid: false, daysRemaining: 0, details: null };
  try {
    const snap = await getDoc(doc(db, "hotels", hotelId));
    if (!snap.exists()) return { isValid: false, daysRemaining: 0, details: null };
    const data = snap.data(), now = new Date(), exp = new Date(data.planExpiresAt);
    if (isNaN(exp.getTime())) return { isValid: false, daysRemaining: 0, details: data };
    
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (now.getTime() > exp.getTime() || data.status === "expired") {
      if (data.status !== "expired") updateDoc(doc(db, "hotels", hotelId), { status: "expired" }).catch(() => {});
      return { isValid: false, daysRemaining: 0, details: data };
    }
    return { isValid: true, daysRemaining: days, details: data };
  } catch (err) { return { isValid: null, daysRemaining: null, details: null, error: err.message }; }
}

export async function renewHotelLicense(hotelId, months) {
  const ref = doc(db, "hotels", hotelId), snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Hotel not found");
  let base = new Date(); const curr = new Date(snap.data().planExpiresAt);
  if (!isNaN(curr.getTime()) && curr > base) base = curr;
  base.setMonth(base.getMonth() + months);
  await updateDoc(ref, { status: "active", planExpiresAt: base.toISOString(), planType: months === 12 ? "1_YEAR_PAID" : "6_MONTHS_PAID" });
  return { success: true, newExpiryDate: base.toISOString() };
}

export async function listAllLicenseStatuses() {
  const snap = await getDocs(collection(db, "hotels"));
  const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  return { success: true, rows };
}
