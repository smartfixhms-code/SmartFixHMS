import { db } from "./firebase-config.js";
import { doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const LODGING_GST_RATE = 12; // SAC 996311
export const FOODING_GST_RATE = 5;  // SAC 996331

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

  // --- LODGING CALCULATION ---
  let lodgingTotalInput = rawRoom * nights;
  let lodgingTaxable = 0;
  let lodgingTaxAmount = 0;

  if (gstMode === "included") {
    // Tax is already inside the room rate (e.g., Room rate ₹800 includes 12% GST)
    lodgingTaxable = lodgingTotalInput / (1 + (LODGING_GST_RATE / 100));
    lodgingTaxAmount = lodgingTotalInput - lodgingTaxable;
  } else {
    // Tax is extra (e.g., Room rate ₹800 + 12% GST)
    lodgingTaxable = lodgingTotalInput;
    lodgingTaxAmount = lodgingTaxable * (LODGING_GST_RATE / 100);
  }

  const lodgingCgst = lodgingTaxAmount / 2;
  const lodgingSgst = lodgingTaxAmount / 2;
  const lodgingTotal = lodgingTaxable + lodgingTaxAmount;

  // --- FOODING CALCULATION ---
  let foodingTaxable = 0, foodingCgst = 0, foodingSgst = 0, foodingTotal = 0, foodingTaxAmount = 0;
  
  if (isFood) {
    let foodingTotalInput = rawFood * nights;
    
    if (gstMode === "included") {
      foodingTaxable = foodingTotalInput / (1 + (FOODING_GST_RATE / 100));
      foodingTaxAmount = foodingTotalInput - foodingTaxable;
    } else {
      foodingTaxable = foodingTotalInput;
      foodingTaxAmount = foodingTaxable * (FOODING_GST_RATE / 100);
    }
    
    foodingCgst = foodingTaxAmount / 2;
    foodingSgst = foodingTaxAmount / 2;
    foodingTotal = foodingTaxable + foodingTaxAmount;
  }

  const totalCgst = lodgingCgst + foodingCgst;
  const totalSgst = lodgingSgst + foodingSgst;
  const grandTax = lodgingTaxAmount + foodingTaxAmount;
  const grandTaxable = lodgingTaxable + foodingTaxable;
  const grandTotal = lodgingTotal + foodingTotal;

  return {
    packageType, 
    gstMode, 
    nights, 
    guests,
    lodging: { 
      ratePerNight: rawRoom, 
      taxable: Number(lodgingTaxable.toFixed(2)), 
      cgst: Number(lodgingCgst.toFixed(2)), 
      sgst: Number(lodgingSgst.toFixed(2)), 
      total: Number(lodgingTotal.toFixed(2)) 
    },
    fooding: { 
      ratePerNight: rawFood, 
      taxable: Number(foodingTaxable.toFixed(2)), 
      cgst: Number(foodingCgst.toFixed(2)), 
      sgst: Number(foodingSgst.toFixed(2)), 
      total: Number(foodingTotal.toFixed(2)) 
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

export async function createNewBooking(hotelId, bookingData) {
  const bookingId = "BK_" + Date.now().toString().slice(-6);
  
  // Save booking with all details (including roomType which fixes the undefined print bug)
  await setDoc(doc(db, "hotels", hotelId, "bookings", bookingId), {
    bookingId, 
    ...bookingData, 
    status: "checked_in", 
    createdAt: new Date().toISOString()
  });
  
  // Update Room Status to Occupied
  await updateDoc(doc(db, "hotels", hotelId, "rooms", bookingData.roomId), {
    status: "occupied", 
    currentBookingId: bookingId, 
    guestName: bookingData.guestName
  });
  
  return { success: true, bookingId };
}

export async function processCheckOut(hotelId, bookingId, roomId, settlementData) {
  // 1. Update Booking Status
  await updateDoc(doc(db, "hotels", hotelId, "bookings", bookingId), {
    status: "checked_out", 
    settledAt: new Date().toISOString(), 
    ...settlementData
  });
  
  // 2. Move Room to Cleaning Status (Not Vacant immediately)
  await updateDoc(doc(db, "hotels", hotelId, "rooms", roomId), {
    status: "cleaning", 
    currentBookingId: null, 
    guestName: null
  });
  
  return { success: true };
}
