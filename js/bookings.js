// SmartFix HMS - Booking & GST Calculation Engine
import { db } from "./firebase-config.js";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Standard GST Rates
export const LODGING_GST_RATE = 12; // 12% for hotel rooms (SAC 996311)
export const FOODING_GST_RATE = 5;  // 5% for restaurant & meals (SAC 996331)

/**
 * Live Tax & Package Calculation
 * @param {number} roomRatePerNight 
 * @param {string} packageType ('lodging_only' | 'fooding_lodging')
 * @param {number} foodRatePerGuestPerNight 
 * @param {number} numberOfGuests 
 * @param {number} numberOfNights 
 * @param {string} gstMode ('extra' | 'inclusive')
 */
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
  const rawRoomRate = parseFloat(roomRatePerNight) || 0;
  
  // Food component applies only if Fooding + Lodging is chosen
  const isFoodingIncluded = packageType === "fooding_lodging";
  const rawFoodRatePerNight = isFoodingIncluded ? (parseFloat(foodRatePerGuestPerNight) * guests) : 0;

  let lodgingTaxable = 0;
  let lodgingCgst = 0;
  let lodgingSgst = 0;
  let lodgingTotal = 0;

  let foodingTaxable = 0;
  let foodingCgst = 0;
  let foodingSgst = 0;
  let foodingTotal = 0;

  if (gstMode === "extra") {
    // 1. Extra GST: Base rates are taxable, GST is appended on top
    lodgingTaxable = rawRoomRate * nights;
    const lodgingTotalTax = (lodgingTaxable * LODGING_GST_RATE) / 100;
    lodgingCgst = lodgingTotalTax / 2;
    lodgingSgst = lodgingTotalTax / 2;
    lodgingTotal = lodgingTaxable + lodgingTotalTax;

    if (isFoodingIncluded) {
      foodingTaxable = rawFoodRatePerNight * nights;
      const foodingTotalTax = (foodingTaxable * FOODING_GST_RATE) / 100;
      foodingCgst = foodingTotalTax / 2;
      foodingSgst = foodingTotalTax / 2;
      foodingTotal = foodingTaxable + foodingTotalTax;
    }
  } else {
    // 2. Included GST: Entered prices already include GST; extract taxable component
    lodgingTotal = rawRoomRate * nights;
    lodgingTaxable = lodgingTotal / (1 + (LODGING_GST_RATE / 100));
    const lodgingTotalTax = lodgingTotal - lodgingTaxable;
    lodgingCgst = lodgingTotalTax / 2;
    lodgingSgst = lodgingTotalTax / 2;

    if (isFoodingIncluded) {
      foodingTotal = rawFoodRatePerNight * nights;
      foodingTaxable = foodingTotal / (1 + (FOODING_GST_RATE / 100));
      const foodingTotalTax = foodingTotal - foodingTaxable;
      foodingCgst = foodingTotalTax / 2;
      foodingSgst = foodingTotalTax / 2;
    }
  }

  const grandTaxable = lodgingTaxable + foodingTaxable;
  const totalCgst = lodgingCgst + foodingCgst;
  const totalSgst = lodgingSgst + foodingSgst;
  const grandTax = totalCgst + totalSgst;
  const grandTotal = lodgingTotal + foodingTotal;

  return {
    packageType,
    gstMode,
    nights,
    guests,
    lodging: {
      ratePerNight: rawRoomRate,
      taxable: lodgingTaxable,
      cgst: lodgingCgst,
      sgst: lodgingSgst,
      total: lodgingTotal
    },
    fooding: {
      ratePerNight: rawFoodRatePerNight,
      taxable: foodingTaxable,
      cgst: foodingCgst,
      sgst: foodingSgst,
      total: foodingTotal
    },
    summary: {
      grandTaxable: Number(grandTaxable.toFixed(2)),
      totalCgst: Number(totalCgst.toFixed(2)),
      totalSgst: Number(totalSgst.toFixed(2)),
      grandTax: Number(grandTax.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2))
    }
  };
}

/**
 * Create a new guest reservation and mark room status
 */
export async function createNewBooking(hotelId, bookingData) {
  try {
    const bookingId = "BK_" + Date.now().toString().slice(-6);
    const bookingRef = doc(db, "hotels", hotelId, "bookings", bookingId);

    const payload = {
      bookingId,
      ...bookingData,
      status: "checked_in", // 'reserved' | 'checked_in' | 'checked_out' | 'cancelled'
      createdAt: new Date().toISOString()
    };

    // Save booking record
    await setDoc(bookingRef, payload);

    // Update room availability status
    const roomRef = doc(db, "hotels", hotelId, "rooms", bookingData.roomId);
    await updateDoc(roomRef, {
      status: "occupied",
      currentBookingId: bookingId,
      guestName: bookingData.guestName
    });

    return { success: true, bookingId };
  } catch (error) {
    console.error("Booking Creation Error:", error);
    throw error;
  }
}

/**
 * Process Guest Check-Out and Free up the Room
 */
export async function processCheckOut(hotelId, bookingId, roomId, settlementData) {
  try {
    const bookingRef = doc(db, "hotels", hotelId, "bookings", bookingId);
    await updateDoc(bookingRef, {
      status: "checked_out",
      settledAt: new Date().toISOString(),
      paymentMode: settlementData.paymentMode || "UPI",
      paidAmount: settlementData.paidAmount,
      balanceDue: 0
    });

    // Mark room as needing housekeeping
    const roomRef = doc(db, "hotels", hotelId, "rooms", roomId);
    await updateDoc(roomRef, {
      status: "cleaning",
      currentBookingId: null,
      guestName: null
    });

    return { success: true };
  } catch (error) {
    console.error("Checkout Settlement Error:", error);
    throw error;
  }
}

/**
 * Fetch all active bookings for the hotel
 */
export async function fetchActiveBookings(hotelId) {
  const bookingsRef = collection(db, "hotels", hotelId, "bookings");
  const q = query(bookingsRef, where("status", "==", "checked_in"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  
  const bookings = [];
  snap.forEach(docSnap => bookings.push({ id: docSnap.id, ...docSnap.data() }));
  return bookings;
}
