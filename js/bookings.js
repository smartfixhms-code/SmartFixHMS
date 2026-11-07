import { db } from "./firebase-config.js";
import { doc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const LODGING_GST_RATE = 12; // SAC 996311
export const FOODING_GST_RATE = 5;  // SAC 996331

export function calculateBookingCharges({
  roomRatePerNight = 0, packageType = "lodging_only", foodRatePerHead = 500, numberOfAdults = 1, numberOfNights = 1
}) {
  const nights = Math.max(1, parseInt(numberOfNights) || 1);
  const adults = Math.max(1, parseInt(numberOfAdults) || 1);
  const rawRoomRate = parseFloat(roomRatePerNight) || 0;
  const isFood = packageType === "fooding_lodging";
  const rawFoodRate = isFood ? (parseFloat(foodRatePerHead) * adults) : 0;

  let lodgingTaxable = rawRoomRate * nights;
  let lTax = (lodgingTaxable * LODGING_GST_RATE) / 100;
  let lodgingCgst = lTax / 2;
  let lodgingSgst = lTax / 2;
  let lodgingTotal = lodgingTaxable + lTax;

  let foodingTaxable = 0, foodingCgst = 0, foodingSgst = 0, foodingTotal = 0;
  if (isFood) {
    foodingTaxable = rawFoodRate * nights;
    let fTax = (foodingTaxable * FOODING_GST_RATE) / 100;
    foodingCgst = fTax / 2;
    foodingSgst = fTax / 2;
    foodingTotal = foodingTaxable + fTax;
  }

  return {
    packageType, nights, adults,
    lodging: { ratePerNight: rawRoomRate, taxable: lodgingTaxable, cgst: lodgingCgst, sgst: lodgingSgst, total: lodgingTotal },
    fooding: { ratePerHead: rawFoodRate / adults || 0, taxable: foodingTaxable, cgst: foodingCgst, sgst: foodingSgst, total: foodingTotal },
    summary: {
      grandTaxable: Number((lodgingTaxable + foodingTaxable).toFixed(2)),
      totalCgst: Number((lodgingCgst + foodingCgst).toFixed(2)),
      totalSgst: Number((lodgingSgst + foodingSgst).toFixed(2)),
      grandTax: Number((lTax + (isFood ? foodingCgst * 2 : 0)).toFixed(2)),
      grandTotal: Number((lodgingTotal + foodingTotal).toFixed(2))
    }
  };
}

export async function createNewBooking(hotelId, bookingData) {
  const roomDocId = bookingData.roomDocId;
  const bookingId = "BK_" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(doc(db, "hotels", hotelId, "bookings", bookingId), {
    ...bookingData, bookingId, roomId: roomDocId, status: "checked_in", createdAt: now
  });
  batch.update(doc(db, "hotels", hotelId, "rooms", roomDocId), {
    status: "occupied", currentBookingId: bookingId, guestName: bookingData.guestName, guestPhone: bookingData.phone
  });
  await batch.commit();
  return { success: true, bookingId };
}

export async function processCheckOut(hotelId, bookingId, roomDocId, settlementData) {
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.update(doc(db, "hotels", hotelId, "bookings", bookingId), { status: "checked_out", settledAt: now, ...settlementData });
  batch.update(doc(db, "hotels", hotelId, "rooms", roomDocId), { status: "cleaning", currentBookingId: null, guestName: null, guestPhone: null });
  await batch.commit();

  try {
    const bSnap = await getDoc(doc(db, "hotels", hotelId, "bookings", bookingId));
    const roomNumber = bSnap.data()?.roomNumber;
    if (roomNumber) {
      const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const posBatch = writeBatch(db);
        snap.forEach(d => { if (d.data().settled !== true) posBatch.update(d.ref, { settled: true, settledAt: now }); });
        await posBatch.commit();
      }
    }
  } catch (e) {}
  return { success: true };
}
