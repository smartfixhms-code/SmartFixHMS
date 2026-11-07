import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const SUPER_ADMIN_EMAIL = "admin@smartfix.com";

export async function initializeTrialSubscription(hotelId, hotelName, ownerEmail, ownerUid) {
  const currentDate = new Date();
  const trialExpiryDate = new Date(currentDate.getTime());
  trialExpiryDate.setDate(trialExpiryDate.getDate() + 30);

  const hotelData = {
    hotelId, hotelName, ownerEmail, ownerId: ownerUid,
    status: "trial", createdAt: currentDate.toISOString(),
    planExpiresAt: trialExpiryDate.toISOString(), planType: "30_DAYS_TRIAL"
  };
  await setDoc(doc(db, "hotels", hotelId), hotelData, { merge: true });
  return hotelData;
}

export async function verifyLicenseStatus(hotelId) {
  if (!hotelId) return { isValid: false, daysRemaining: 0, details: null };
  try {
    const snap = await getDoc(doc(db, "hotels", hotelId));
    if (!snap.exists()) return { isValid: false, daysRemaining: 0, details: null };
    const data = snap.data();
    const now = new Date();
    const exp = new Date(data.planExpiresAt);
    
    if (isNaN(exp.getTime())) return { isValid: false, daysRemaining: 0, details: data, error: "invalid-date" };
    
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = now.getTime() > exp.getTime() || data.status === "expired";
    
    if (isExpired) {
      if (data.status !== "expired") updateDoc(doc(db, "hotels", hotelId), { status: "expired" }).catch(() => {});
      return { isValid: false, daysRemaining: 0, details: data };
    }
    return { isValid: true, daysRemaining: days, details: data };
  } catch (err) {
    return { isValid: null, daysRemaining: null, details: null, error: err.message };
  }
}

export async function renewHotelLicense(hotelId, months) {
  const hotelRef = doc(db, "hotels", hotelId);
  const snap = await getDoc(hotelRef);
  if (!snap.exists()) throw new Error("Hotel not found");
  const data = snap.data();
  let baseDate = new Date();
  const currentExpiry = new Date(data.planExpiresAt);
  if (!isNaN(currentExpiry.getTime()) && currentExpiry > baseDate) baseDate = currentExpiry;
  baseDate.setMonth(baseDate.getMonth() + months);

  await updateDoc(hotelRef, {
    status: "active", planExpiresAt: baseDate.toISOString(),
    planType: months === 12 ? "1_YEAR_PAID" : "6_MONTHS_PAID"
  });
  return { success: true, newExpiryDate: baseDate.toISOString() };
}

export async function listAllLicenseStatuses() {
  const snap = await getDocs(collection(db, "hotels"));
  const rows = [];
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  return { success: true, rows };
}
