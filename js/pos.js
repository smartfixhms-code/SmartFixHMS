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
    // FIXED: Removed composite index requirement by removing 'isSettled' from where clause
    const q = query(
      collection(db, "hotels", hotelId, "pos_orders"), 
      where("roomNumber", "==", roomNumber)
    );
    const snap = await getDocs(q);
    const unsettledOrders = [];
    let totalFoodCost = 0;
    
    snap.forEach(d => {
      const data = d.data();
      // Filter manually in JS to avoid Firestore composite index errors
      if (data.isSettled === false) {
        unsettledOrders.push({ id: d.id, ...data });
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(i => totalFoodCost += (i.price * i.quantity));
        }
      }
    });
    return { unsettledOrders, totalFoodCost };
  } catch (e) {
    console.error("Error fetching unsettled POS orders:", e);
    return { unsettledOrders: [], totalFoodCost: 0 };
  }
}

export async function getBookingFoodOrders(hotelId, bookingId) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("bookingId", "==", bookingId));
    const snap = await getDocs(q);
    const orders = [];
    snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
    return { orders };
  } catch (e) {
    console.error("Error fetching booking POS orders:", e);
    return { orders: [] };
  }
}

export async function settleRoomFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber));
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.isSettled === false) {
        const docRef = doc(db, "hotels", hotelId, "pos_orders", d.id);
        promises.push(updateDoc(docRef, { isSettled: true, settledAt: new Date().toISOString() }));
      }
    });
    await Promise.all(promises);
    return { success: true };
  } catch (e) {
    console.error("Error settling POS orders:", e);
    return { success: false };
  }
}
