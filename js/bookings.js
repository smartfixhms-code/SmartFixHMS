// bookings.js - SmartFix HMS
// All booking creation + checkout logic with atomic writes and POS auto-settlement.
import { db } from "./firebase-config.js";
import {
  doc, setDoc, updateDoc, getDoc,
  collection, query, where, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------- GST Rates (SAC-based, India) ----------
export const LODGING_GST_RATE = 12; // SAC 996311 – Hotel Accommodation
export const FOODING_GST_RATE = 5;  // SAC 996331 – Restaurant Service

// ---------- Charge calculator (unchanged – verified correct) ----------
export function calculateBookingCharges({
  roomRatePerNight = 0,
  packageType = "lodging_only",
  foodRatePerGuestPerNight = 500,
  numberOfGuests = 1,
  numberOfNights = 1,
  gstMode = "extra"
}) {
  const nights = Math.max(1, parseInt(numberOfNights) || 1);
  const guests = Math.max(1, parseInt(numberOfGuests) || 1);
  const rawRoom = parseFloat(roomRatePerNight) || 0;
  const isFood = packageType === "fooding_lodging";
  const rawFood = isFood ? (parseFloat(foodRatePerGuestPerNight) * guests) : 0;

  let lodgingTaxable = rawRoom * nights;
  let lTax = (lodgingTaxable * LODGING_GST_RATE) / 100;
  let lodgingCgst = lTax / 2;
  let lodgingSgst = lTax / 2;
  let lodgingTotal = lodgingTaxable + lTax;

  let foodingTaxable = 0, foodingCgst = 0, foodingSgst = 0, foodingTotal = 0;
  if (isFood) {
    foodingTaxable = rawFood * nights;
    const fTax = (foodingTaxable * FOODING_GST_RATE) / 100;
    foodingCgst = fTax / 2;
    foodingSgst = fTax / 2;
    foodingTotal = foodingTaxable + fTax;
  }

  return {
    packageType, gstMode, nights, guests,
    lodging: {
      ratePerNight: rawRoom,
      taxable: lodgingTaxable,
      cgst: lodgingCgst, sgst: lodgingSgst, total: lodgingTotal
    },
    fooding: {
      ratePerNight: rawFood,
      taxable: foodingTaxable,
      cgst: foodingCgst, sgst: foodingSgst, total: foodingTotal
    },
    summary: {
      grandTaxable: Number((lodgingTaxable + foodingTaxable).toFixed(2)),
      totalCgst: Number((lodgingCgst + foodingCgst).toFixed(2)),
      totalSgst: Number((lodgingSgst + foodingSgst).toFixed(2)),
      grandTax: Number((lTax + (isFood ? foodingCgst * 2 : 0)).toFixed(2)),
      grandTotal: Number((lodgingTotal + foodingTotal).toFixed(2))
    }
  };
}

// ---------- BUG FIX #18: Collision-safe ID generator ----------
// Format: BK_<base36 timestamp>_<4-char random>
// e.g. BK_LQ5X2P_A7F3 — short, sortable, unique.
function generateBookingId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BK_${ts}_${rand}`;
}

// ---------- Create new booking (atomic: booking + room together) ----------
export async function createNewBooking(hotelId, bookingData) {
  if (!hotelId) throw new Error("Missing hotelId");
  if (!bookingData || !bookingData.guestName) throw new Error("Guest name required");

  // BUG FIX #4: prefer roomDocId (Firestore doc ID), fallback to roomId
  // (After a room-number edit, the doc ID is stable while the number changes.)
  const roomDocId = bookingData.roomDocId || bookingData.roomId;
  if (!roomDocId) throw new Error("Room document ID is missing in booking payload");

  const bookingId = generateBookingId();
  const now = new Date().toISOString();

  // BUG FIX: use batch → booking doc and room doc are written atomically.
  // If the room doesn't exist, BOTH writes fail → no orphan booking.
  const batch = writeBatch(db);

  batch.set(doc(db, "hotels", hotelId, "bookings", bookingId), {
    ...bookingData,
    bookingId,
    roomId: roomDocId,     // normalized: roomId always equals doc ID
    roomDocId,             // explicit alias for clarity
    status: "checked_in",
    createdAt: now
  });

  batch.update(doc(db, "hotels", hotelId, "rooms", roomDocId), {
    status: "occupied",
    currentBookingId: bookingId,
    guestName: bookingData.guestName
  });

  await batch.commit();

  return { success: true, bookingId };
}

// ---------- Checkout (booking + room + POS settle) ----------
export async function processCheckOut(hotelId, bookingId, roomDocId, settlementData) {
  if (!hotelId) throw new Error("Missing hotelId");
  if (!bookingId) throw new Error("Missing booking ID");
  if (!roomDocId) throw new Error("Missing room doc ID");

  const now = new Date().toISOString();

  // STEP 1: Atomically update booking → checked_out and room → cleaning.
  const batch = writeBatch(db);

  batch.update(doc(db, "hotels", hotelId, "bookings", bookingId), {
    status: "checked_out",
    settledAt: now,
    ...settlementData
  });

  batch.update(doc(db, "hotels", hotelId, "rooms", roomDocId), {
    status: "cleaning",
    currentBookingId: null,
    guestName: null
  });

  await batch.commit();

  // STEP 2: BUG FIX #2 + #13 — auto-settle any open POS food orders for this room.
  // Reason: without this, the NEXT guest checking into the same room would see
  // stale food bills from the previous guest (GST/accounting data leak).
  // Filter is done client-side because legacy POS docs may not have `settled` field.
  try {
    const bSnap = await getDoc(doc(db, "hotels", hotelId, "bookings", bookingId));
    const roomNumber = bSnap.data()?.roomNumber;

    if (roomNumber) {
      const q = query(
        collection(db, "hotels", hotelId, "pos_orders"),
        where("roomNumber", "==", roomNumber)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const posBatch = writeBatch(db);
        let settleCount = 0;

        snap.forEach((d) => {
          const data = d.data();
          // Treat missing `settled` field as unsettled (legacy docs).
          if (data.settled !== true) {
            posBatch.update(d.ref, {
              settled: true,
              settledAt: now,
              settledBookingId: bookingId
            });
            settleCount++;
          }
        });

        if (settleCount > 0) await posBatch.commit();
      }
    }
  } catch (e) {
    // Non-fatal: booking is already checked out. Just log.
    console.warn("POS auto-settle failed (non-blocking):", e.message);
  }

  return { success: true };
}
