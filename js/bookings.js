import { db } from "./firebase-config.js";
import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const LODGING_GST_RATE = 12;
export const FOODING_GST_RATE = 5;

export function calculateBookingCharges({ 
  roomRatePerNight = 0, 
  packageType = "lodging_only", 
  foodRatePerAdult = 500, 
  numberOfAdults = 1, 
  numberOfNights = 1, 
  gstMode = "extra",
  discount = 0 
}) {
  const nights = Math.max(1, parseInt(numberOfNights) || 1);
  const adults = Math.max(1, parseInt(numberOfAdults) || 1);
  const disc = Math.max(0, parseFloat(discount) || 0);
  
  let lodgingTotalInput = (parseFloat(roomRatePerNight) || 0) * nights;
  lodgingTotalInput = Math.max(0, lodgingTotalInput - disc);

  const isFood = packageType === "fooding_lodging";
  const rawFood = isFood ? (parseFloat(foodRatePerAdult) * adults) : 0;

  let lodgingTaxable = 0, lodgingTaxAmount = 0;
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

  return {
    packageType, gstMode, nights, adults, discount: disc,
    lodging: { 
      ratePerNight: Number(roomRatePerNight), 
      taxable: Number(lodgingTaxable.toFixed(2)), 
      cgst: Number(lodgingCgst.toFixed(2)), 
      sgst: Number(lodgingSgst.toFixed(2)), 
      total: Number(lodgingTotal.toFixed(2)) 
    },
    fooding: { 
      ratePerAdult: rawFood / adults, 
      taxable: Number(foodingTaxable.toFixed(2)), 
      cgst: Number(foodingCgst.toFixed(2)), 
      sgst: Number(foodingSgst.toFixed(2)), 
      total: Number(foodingTotal.toFixed(2)) 
    },
    summary: {
      grandTaxable: Number((lodgingTaxable + foodingTaxable).toFixed(2)),
      totalCgst: Number((lodgingCgst + foodingCgst).toFixed(2)),
      totalSgst: Number((lodgingSgst + foodingSgst).toFixed(2)),
      grandTax: Number((lodgingTaxAmount + foodingTaxAmount).toFixed(2)),
      grandTotal: Number((lodgingTotal + foodingTotal).toFixed(2))
    }
  };
}

export async function createNewBooking(hotelId, bookingData) {
  const bookingId = "BK_" + Date.now().toString().slice(-6);
  
  const advancePaid = parseFloat(bookingData.advancePaid) || 0;
  const balanceDue = Math.max(0, bookingData.summary.grandTotal - advancePaid);
  const isSettled = balanceDue <= 0;

  // Status: Future booking হলে "confirmed", আজকের হলে "checked_in"
  const bookingStatus = bookingData.isFutureBooking ? "confirmed" : "checked_in";

  const payload = {
    ...bookingData,
    bookingId,
    advancePaid,
    totalPaid: advancePaid, // শুরুতে অ্যাডভান্স পেমেন্টই মোট পেমেন্ট
    balanceDue,
    isSettled,
    status: bookingStatus, 
    createdAt: new Date().toISOString()
  };

  await setDoc(doc(db, "hotels", hotelId, "bookings", bookingId), payload);
  
  // ফিউচার বুকিং হলে রুম কি occupied হবে? না! আজকের বুকিং হলে occupied হবে।
  if (!bookingData.isFutureBooking) {
    await updateDoc(doc(db, "hotels", hotelId, "rooms", bookingData.roomId), {
      status: "occupied", 
      currentBookingId: bookingId, 
      guestName: bookingData.guestName
    });
  }
  
  return { success: true, bookingId };
}

export async function processCheckOut(hotelId, bookingId, roomId, settlementData) {
  await updateDoc(doc(db, "hotels", hotelId, "bookings", bookingId), {
    status: "checked_out", 
    settledAt: new Date().toISOString(), 
    ...settlementData
  });
  
  await updateDoc(doc(db, "hotels", hotelId, "rooms", roomId), {
    status: "cleaning", 
    currentBookingId: null, 
    guestName: null
  });
  
  return { success: true };
}
