// SmartFix HMS - License & Subscription Verification Engine
import { db } from "./firebase-config.js";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  collection, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Designated Super Admin Email
export const SUPER_ADMIN_EMAIL = "admin@smartfix.com";

/**
 * Initializes a 30-Day Free Trial for a freshly registered hotel
 * @param {string} hotelId 
 * @param {string} hotelName 
 * @param {string} ownerEmail 
 * @param {string} ownerUid 
 */
export async function initializeTrialSubscription(hotelId, hotelName, ownerEmail, ownerUid) {
  const currentDate = new Date();
  const trialExpiryDate = new Date();
  trialExpiryDate.setDate(currentDate.getDate() + 30); // 30 Days Free Trial

  const hotelData = {
    hotelId: hotelId,
    hotelName: hotelName,
    ownerEmail: ownerEmail,
    ownerId: ownerUid,
    status: "trial", // 'trial' | 'active' | 'expired'
    createdAt: currentDate.toISOString(),
    trialStartedAt: currentDate.toISOString(),
    planExpiresAt: trialExpiryDate.toISOString(),
    planType: "30_DAYS_TRIAL"
  };

  await setDoc(doc(db, "hotels", hotelId), hotelData, { merge: true });
  return hotelData;
}

/**
 * Validates whether the hotel's license is active or expired
 * @param {string} hotelId 
 * @returns {Promise<{isValid: boolean, daysRemaining: number, details: object}>}
 */
export async function verifyLicenseStatus(hotelId) {
  try {
    const hotelRef = doc(db, "hotels", hotelId);
    const hotelSnap = await getDoc(hotelRef);

    if (!hotelSnap.exists()) {
      return { isValid: false, daysRemaining: 0, details: null, message: "Hotel not found" };
    }

    const data = hotelSnap.data();
    const now = new Date();
    const expiryDate = new Date(data.planExpiresAt);

    // Calculate days remaining
    const diffTime = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (now > expiryDate || data.status === "expired") {
      // License expired - mark status in database if not already marked
      if (data.status !== "expired") {
        await updateDoc(hotelRef, { status: "expired" });
      }
      return { 
        isValid: false, 
        daysRemaining: 0, 
        details: data, 
        message: "Your software license or trial has expired." 
      };
    }

    return { 
      isValid: true, 
      daysRemaining: daysRemaining, 
      details: data, 
      message: "License active" 
    };
  } catch (error) {
    console.error("SmartFix HMS: License Verification Error", error);
    return { isValid: false, daysRemaining: 0, details: null, message: error.message };
  }
}

/**
 * Super Admin Utility: Extend/Renew Subscription by specified months
 * @param {string} hotelId 
 * @param {number} months (e.g. 6 or 12)
 */
export async function renewHotelLicense(hotelId, months) {
  const hotelRef = doc(db, "hotels", hotelId);
  const hotelSnap = await getDoc(hotelRef);

  if (!hotelSnap.exists()) {
    throw new Error("Hotel profile does not exist.");
  }

  const data = hotelSnap.data();
  let baseDate = new Date();
  const currentExpiry = new Date(data.planExpiresAt);

  // If existing license has not yet expired, add months onto current expiry date
  if (currentExpiry > baseDate) {
    baseDate = currentExpiry;
  }

  baseDate.setMonth(baseDate.getMonth() + months);

  const updatePayload = {
    status: "active",
    planExpiresAt: baseDate.toISOString(),
    planType: months === 12 ? "1_YEAR_PAID" : "6_MONTHS_PAID",
    lastRenewedAt: new Date().toISOString()
  };

  await updateDoc(hotelRef, updatePayload);
  return { success: true, newExpiryDate: baseDate.toISOString() };
}

/**
 * Fetch all tenant hotels for Developer Super-Admin Console
 */
export async function fetchAllTenantsForAdmin() {
  const tenantsCollection = collection(db, "hotels");
  const snapshot = await getDocs(tenantsCollection);
  const tenants = [];

  snapshot.forEach((docSnap) => {
    tenants.push({ id: docSnap.id, ...docSnap.data() });
  });

  return tenants;
}
