import { db } from "./firebase-config.js";
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const SUPER_ADMIN_EMAIL = "admin@smartfix.com";
export const SUPPORT_WHATSAPP_NUMBER = "+919046356631"; 

export async function initializeTrialSubscription(hotelId, hotelName, ownerEmail, ownerUid) {
  const currentDate = new Date();
  const trialExpiryDate = new Date();
  trialExpiryDate.setDate(currentDate.getDate() + 30);

  const hotelData = {
    hotelId, 
    hotelName, 
    ownerEmail, 
    ownerId: ownerUid,
    status: "trial", 
    createdAt: currentDate.toISOString(),
    planExpiresAt: trialExpiryDate.toISOString(), 
    planType: "30_DAYS_TRIAL"
  };
  await setDoc(doc(db, "hotels", hotelId), hotelData, { merge: true });
  return hotelData;
}

export async function verifyLicenseStatus(hotelId) {
  try {
    const hotelRef = doc(db, "hotels", hotelId);
    const snap = await getDoc(hotelRef);
    
    if (!snap.exists()) {
      return { isValid: false, isSuspended: false, isExpired: true, daysRemaining: 0, details: null };
    }
    
    const data = snap.data();
    const now = new Date();
    const exp = new Date(data.planExpiresAt);
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check for Suspended Status
    if (data.status === "suspended") {
      return { isValid: false, isSuspended: true, isExpired: false, daysRemaining: 0, details: data };
    }

    // Check for Expired Status
    if (now > exp || data.status === "expired") {
      if (data.status !== "expired") {
        await updateDoc(hotelRef, { status: "expired" });
      }
      return { isValid: false, isSuspended: false, isExpired: true, daysRemaining: 0, details: data };
    }
    
    return { isValid: true, isSuspended: false, isExpired: false, daysRemaining: days, details: data };
  } catch (err) {
    console.error("License Check Error:", err);
    return { isValid: false, isSuspended: false, isExpired: true, daysRemaining: 0, details: null };
  }
}

export async function renewHotelLicense(hotelId, months) {
  const hotelRef = doc(db, "hotels", hotelId);
  const snap = await getDoc(hotelRef);
  
  if (!snap.exists()) throw new Error("Hotel not found");
  
  const data = snap.data();
  let baseDate = new Date();
  const currentExpiry = new Date(data.planExpiresAt);
  
  if (currentExpiry > baseDate) {
    baseDate = currentExpiry;
  }
  
  baseDate.setMonth(baseDate.getMonth() + months);

  await updateDoc(hotelRef, {
    status: "active", 
    planExpiresAt: baseDate.toISOString(),
    planType: months === 12 ? "1_YEAR_PAID" : "6_MONTHS_PAID"
  });
  
  return { success: true, newExpiryDate: baseDate.toISOString() };
}

export function getWhatsAppSupportLink(hotelName, hotelId) {
  const message = encodeURIComponent(`Hello SmartFix Support,\nMy hotel "${hotelName}" (ID: ${hotelId}) requires attention. Please help.`);
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${message}`;
}
