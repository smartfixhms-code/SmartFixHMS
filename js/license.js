// license.js - SmartFix HMS
// Hotel license/subscription lifecycle management.
// Returns THREE states for isValid: true (active), false (expired), null (unknown/network).
import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, setDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const SUPER_ADMIN_EMAIL = "admin@smartfix.com";

// ---------- Firestore doc ID from UID ----------
function hotelIdFromUid(uid) {
  return "hotel_" + uid.substring(0, 8);
}

// ---------- Initialize 30-day trial on registration ----------
export async function initializeTrialSubscription(hotelId, hotelName, ownerEmail, ownerUid) {
  if (!hotelId) throw new Error("hotelId required for trial initialization");
  const currentDate = new Date();
  const trialExpiryDate = new Date(currentDate.getTime());
  trialExpiryDate.setDate(trialExpiryDate.getDate() + 30);

  const hotelData = {
    hotelId,
    hotelName: hotelName || "Unnamed Property",
    ownerEmail: ownerEmail || "",
    ownerId: ownerUid || "",
    status: "trial",
    createdAt: currentDate.toISOString(),
    planExpiresAt: trialExpiryDate.toISOString(),
    planType: "30_DAYS_TRIAL"
  };
  await setDoc(doc(db, "hotels", hotelId), hotelData, { merge: true });
  return hotelData;
}

// ---------- License verification ----------
/**
 * Returns:
 *   { isValid: true,  daysRemaining: N, details }  — active
 *   { isValid: false, daysRemaining: 0, details }  — explicitly expired
 *   { isValid: null,  daysRemaining: null, details: null, error } — unknown (network/permission)
 *
 * Dashboard MUST treat `isValid === null` as "allow but warn",
 * and `isValid === false` as "block + logout".
 */
export async function verifyLicenseStatus(hotelId) {
  if (!hotelId) {
    return { isValid: false, daysRemaining: 0, details: null, error: "Missing hotelId" };
  }

  let snap;
  try {
    snap = await getDoc(doc(db, "hotels", hotelId));
  } catch (err) {
    // Network / permissions → UNKNOWN. Do NOT force-logout; transient glitch.
    console.warn("verifyLicenseStatus: fetch failed:", err?.message);
    return {
      isValid: null,
      daysRemaining: null,
      details: null,
      error: err?.code || "network-error"
    };
  }

  if (!snap.exists()) {
    // Hotel doc doesn't exist — this is a definite "invalid" state.
    return { isValid: false, daysRemaining: 0, details: null, error: "hotel-not-found" };
  }

  const data = snap.data();

  // ---------- Edge case: planExpiresAt missing or invalid ----------
  if (!data.planExpiresAt) {
    // Old/malformed record. Treat as expired so admin gets notified, but flag it.
    return {
      isValid: false,
      daysRemaining: 0,
      details: { ...data, _warning: "missing-expiry" },
      error: "missing-expiry"
    };
  }

  const now = new Date();
  const exp = new Date(data.planExpiresAt);

  if (isNaN(exp.getTime())) {
    return {
      isValid: false,
      daysRemaining: 0,
      details: { ...data, _warning: "invalid-expiry" },
      error: "invalid-expiry"
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const rawDays = Math.ceil((exp.getTime() - now.getTime()) / msPerDay);
  const daysRemaining = Math.max(0, rawDays);

  // ---------- Explicit expiry ----------
  // `now > exp` means truly past. Same-instant or same-day = still valid (daysRemaining=0).
  const isActuallyExpired = now.getTime() > exp.getTime() || data.status === "expired";

  if (isActuallyExpired) {
    // Best-effort: sync Firestore status to "expired" (don't fail verify if update fails)
    if (data.status !== "expired") {
      updateDoc(doc(db, "hotels", hotelId), { status: "expired" }).catch((e) => {
        console.warn("verifyLicenseStatus: could not mark expired:", e.message);
      });
    }
    return { isValid: false, daysRemaining: 0, details: { ...data, status: "expired" } };
  }

  return { isValid: true, daysRemaining, details: data };
}

// ---------- Renew license ----------
/**
 * Renew by N months. Uses max(now, currentExpiry) as base so early renewal
 * doesn't lose paid time.
 *
 * @param {string} hotelId
 * @param {number} months - 6 or 12 typically
 * @returns {{ success: boolean, newExpiryDate: string, planType: string }}
 */
export async function renewHotelLicense(hotelId, months) {
  if (!hotelId) throw new Error("hotelId required");
  const m = parseInt(months, 10);
  if (!Number.isFinite(m) || m <= 0) throw new Error("months must be a positive integer");

  const hotelRef = doc(db, "hotels", hotelId);
  const snap = await getDoc(hotelRef);
  if (!snap.exists()) throw new Error("Hotel not found");

  const data = snap.data();

  // ---------- Base date: later of now / current expiry ----------
  const now = new Date();
  let baseDate = new Date(now.getTime());
  if (data.planExpiresAt) {
    const currentExpiry = new Date(data.planExpiresAt);
    if (!isNaN(currentExpiry.getTime()) && currentExpiry.getTime() > baseDate.getTime()) {
      baseDate = currentExpiry;
    }
  }

  // ---------- Add months carefully (handle month-end overflow) ----------
  // e.g. Jan 31 + 1 month → Feb 28/29 (JS native would roll to Mar 3)
  const targetDay = baseDate.getDate();
  baseDate.setMonth(baseDate.getMonth() + m);
  if (baseDate.getDate() < targetDay) {
    // Rolled into next month due to overflow; pull back to last day of intended month
    baseDate.setDate(0);
  }

  const planType = m === 12 ? "1_YEAR_PAID"
                 : m === 6  ? "6_MONTHS_PAID"
                 : `${m}_MONTHS_PAID`;

  await updateDoc(hotelRef, {
    status: "active",
    planExpiresAt: baseDate.toISOString(),
    planType,
    lastRenewedAt: now.toISOString()
  });

  return {
    success: true,
    newExpiryDate: baseDate.toISOString(),
    planType,
    months: m
  };
}

// ---------- Admin helper: list all hotels with license status ----------
/**
 * For super-admin dashboard use. Aggregates with per-hotel computed validity
 * WITHOUT writing to Firestore (read-only).
 */
export async function listAllLicenseStatuses() {
  try {
    const snap = await getDocs(collection(db, "hotels"));
    const now = new Date().getTime();
    const rows = [];
    snap.forEach((d) => {
      const data = d.data() || {};
      const expMs = data.planExpiresAt ? new Date(data.planExpiresAt).getTime() : NaN;
      const days = Number.isFinite(expMs)
        ? Math.max(0, Math.ceil((expMs - now) / (1000 * 60 * 60 * 24)))
        : 0;
      const expired = !Number.isFinite(expMs) || now > expMs || data.status === "expired";
      rows.push({
        id: d.id,
        ...data,
        computedStatus: expired ? "expired" : "active",
        daysRemaining: days
      });
    });
    return { success: true, rows };
  } catch (err) {
    return { success: false, rows: [], error: err.message };
  }
}
