import { db } from "./firebase-config.js";
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const LODGING_GST_RATE = 12, FOODING_GST_RATE = 5;

export function calculateBookingCharges({ roomRatePerNight = 0, packageType = "lodging_only", foodRatePerHead = 500, numberOfAdults = 1, numberOfNights = 1, gstMode = "extra" }) {
  const nights = Math.max(1, parseInt(numberOfNights) || 1), adults = Math.max(1, parseInt(numberOfAdults) || 1);
  const rawRoomRate = parseFloat(roomRatePerNight) || 0, isFood = packageType === "fooding_lodging";
  const rawFoodRate = isFood ? (parseFloat(foodRatePerHead) * adults) : 0;

  let lodgingTaxable, lodgingTotal, lTax, foodingTaxable, foodingTotal, fTax;

  if (gstMode === "included") {
    lodgingTotal = rawRoomRate * nights; lodgingTaxable = lodgingTotal / (1 + LODGING_GST_RATE / 100); lTax = lodgingTotal - lodgingTaxable;
    if (isFood) { foodingTotal = rawFoodRate * nights; foodingTaxable = foodingTotal / (1 + FOODING_GST_RATE / 100); fTax = foodingTotal - foodingTaxable; } 
    else { foodingTotal = 0; foodingTaxable = 0; fTax = 0; }
  } else {
    lodgingTaxable = rawRoomRate * nights; lTax = (lodgingTaxable * LODGING_GST_RATE) / 100; lodgingTotal = lodgingTaxable + lTax;
    if (isFood) { foodingTaxable = rawFoodRate * nights; fTax = (foodingTaxable * FOODING_GST_RATE) / 100; foodingTotal = foodingTaxable + fTax; } 
    else { foodingTotal = 0; foodingTaxable = 0; fTax = 0; }
  }

  return {
    packageType, nights, adults, gstMode,
    lodging: { ratePerNight: rawRoomRate, taxable: Number(lodgingTaxable.toFixed(2)), cgst: Number((lTax/2).toFixed(2)), sgst: Number((lTax/2).toFixed(2)), total: Number(lodgingTotal.toFixed(2)) },
    fooding: { ratePerHead: rawFoodRate / adults || 0, taxable: Number(foodingTaxable.toFixed(2)), cgst: Number((fTax/2).toFixed(2)), sgst: Number((fTax/2).toFixed(2)), total: Number(foodingTotal.toFixed(2)) },
    summary: {
      grandTaxable: Number((lodgingTaxable + foodingTaxable).toFixed(2)),
      totalCgst: Number(((lTax/2) + (fTax/2)).toFixed(2)), totalSgst: Number(((lTax/2) + (fTax/2)).toFixed(2)),
      grandTax: Number((lTax + fTax).toFixed(2)), grandTotal: Number((lodgingTotal + foodingTotal).toFixed(2))
    }
  };
}

export async function createNewBooking(hotelId, bookingData) {
  const bookingId = "BK_" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const now = new Date().toISOString(), batch = writeBatch(db);

  batch.set(doc(db, "hotels", hotelId, "bookings", bookingId), { ...bookingData, bookingId, roomId: bookingData.roomDocId, status: "checked_in", createdAt: now });
  batch.update(doc(db, "hotels", hotelId, "rooms", bookingData.roomDocId), { status: "occupied", currentBookingId: bookingId, guestName: bookingData.guestName, guestPhone: bookingData.phone });
  await batch.commit();
  return { success: true, bookingId };
}

export async function processCheckOut(hotelId, bookingId, roomDocId, settlementData) {
  const now = new Date().toISOString(), batch = writeBatch(db);
  batch.update(doc(db, "hotels", hotelId, "bookings", bookingId), { status: "checked_out", checkOutTime: now, settledAt: now, ...settlementData });
  batch.update(doc(db, "hotels", hotelId, "rooms", roomDocId), { status: "cleaning", currentBookingId: null, guestName: null, guestPhone: null });
  await batch.commit();

  try {
    const bSnap = await getDoc(doc(db, "hotels", hotelId, "bookings", bookingId));
    if (bSnap.data()?.roomNumber) {
      const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", bSnap.data().roomNumber));
      const snap = await getDocs(q);
      if (!snap.empty) { const pb = writeBatch(db); snap.forEach(d => { if (!d.data().settled) pb.update(d.ref, { settled: true, settledAt: now }); }); await pb.commit(); }
    }
  } catch (e) {}
  return { success: true };
}
