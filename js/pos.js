import { db } from "./firebase-config.js";
import { doc, setDoc, getDocs, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function createPosOrder(hotelId, orderDetails) {
  const orderId = "KOT_" + Date.now().toString().slice(-6);
  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), {
    orderId, ...orderDetails, status: "served", isSettled: false, createdAt: new Date().toISOString()
  });
  return { success: true, orderId };
}

export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber), where("isSettled", "==", false));
    const snap = await getDocs(q);
    const unsettledOrders = [];
    let totalFoodCost = 0;
    snap.forEach(d => {
      const data = d.data();
      unsettledOrders.push({ id: d.id, ...data });
      if (data.items) data.items.forEach(i => totalFoodCost += (i.price * i.quantity));
    });
    return { unsettledOrders, totalFoodCost };
  } catch (e) { return { unsettledOrders: [], totalFoodCost: 0 }; }
}

// নতুন ফাংশন: প্রিন্ট করার জন্য নির্দিষ্ট বুকিং এর সব খাবার খুঁজে বের করবে
export async function getBookingFoodOrders(hotelId, bookingId) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("bookingId", "==", bookingId));
    const snap = await getDocs(q);
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    return { orders };
  } catch (e) { return { orders: [] }; }
}

export async function settleRoomFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber), where("isSettled", "==", false));
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach(d => {
      promises.push(updateDoc(doc(db, "hotels", hotelId, "pos_orders", d.id), { isSettled: true, settledAt: new Date().toISOString() }));
    });
    await Promise.all(promises);
    return { success: true };
  } catch (e) { return { success: false }; }
}
