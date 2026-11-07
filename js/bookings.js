import { db } from "./firebase-config.js";
import { doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const LODGING_GST_RATE = 12;
export const FOODING_GST_RATE = 5;

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

  let lodgingTotalInput = rawRoom * nights;
  let lodgingTaxable = 0;
  let lodgingTaxAmount = 0;

  if (gstMode === "included") {
    lodgingTaxable = lodgingTotalInput / (1 + (LODGING_GST_RATE / 100));
    lodgingTaxAmount = lodgingTotalInput - lodgingTaxable;
  } else {
    lodgingTaxable = lodgingTotalInput;
    lodgingTaxAmount = lodgingTaxable * (LODGING_GST_RATE / 100);
  }

  const lodgingCgst = lodgingTaxAmount / 2;
  const lodgingSgst = lodgingTaxAmount / 2;
  const lodgingTotal = lodgingTaxable + lodgingTaxAmount;

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
    packageType, gstMode, nights, guests,
    lodging: { 
      ratePerNight: rawRoom, taxable: Number(lodgingTaxable.toFixed(2)), 
      cgst: Number(lodgingCgst.toFixed(2)), sgst: Number(lodgingSgst.toFixed(2)), total: Number(lodgingTotal.toFixed(2)) 
    },
    fooding: { 
      ratePerNight: rawFood, taxable: Number(foodingTaxable.toFixed(2)), 
      cgst: Number(foodingCgst.toFixed(2)), sgst: Number(foodingSgst.toFixed(2)), total: Number(foodingTotal.toFixed(2)) 
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
  
  // Calculate Due Amount
  const advancePaid = parseFloat(bookingData.advancePaid) || 0;
  const balanceDue = bookingData.summary.grandTotal - advancePaid;
  const isSettled = balanceDue <= 0;

  await setDoc(doc(db, "hotels", hotelId, "bookings", bookingId), {
    bookingId, 
    ...bookingData, 
    advancePaid,
    balanceDue,
    isSettled,
    status: "checked_in", 
    createdAt: new Date().toISOString()
  });
  
  await updateDoc(doc(db, "hotels", hotelId, "rooms", bookingData.roomId), {
    status: "occupied", 
    currentBookingId: bookingId, 
    guestName: bookingData.guestName
  });
  
  return { success: true, bookingId };
}

export async function processCheckOut(hotelId, bookingId, roomId, settlementData) {
  // settlementData will contain finalPaidAmount, totalPaid, balanceDue, isSettled
  await updateDoc(doc(db, "hotels", hotelId, "bookings", bookingId), {
    status: "checked_out", 
    settledAt: new Date().toISOString(), 
    checkOutTime: settlementData.checkOutTime,
    totalPaid: settlementData.totalPaid,
    balanceDue: settlementData.balanceDue,
    isSettled: settlementData.isSettled,
    settled: settlementData.isSettled
  });
  
  await updateDoc(doc(db, "hotels", hotelId, "rooms", roomId), {
    status: "cleaning", 
    currentBookingId: null, 
    guestName: null
  });
  
  return { success: true };
}
