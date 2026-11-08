import { db } from "./firebase-config.js";
import { doc, setDoc, getDocs, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function createPosOrder(hotelId, orderDetails) {
  const orderId = "KOT_" + Date.now().toString().slice(-6);
  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), {
    orderId, 
    ...orderDetails, 
    status: "served",
    isSettled: false, // নতুন: খাবার বিল শুরুতেই আনসেটেল থাকবে
    createdAt: new Date().toISOString()
  });
  return { success: true, orderId };
}

export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(
      collection(db, "hotels", hotelId, "pos_orders"), 
      where("roomNumber", "==", roomNumber)
    );
    const snap = await getDocs(q);
    const unsettledOrders = [];
    let totalFoodCost = 0;
    
    snap.forEach(d => {
      const data = d.data();
      // শুধুমাত্র আনসেটেল অর্ডারগুলো নেওয়া হবে
      if (data.isSettled === false) {
        unsettledOrders.push({ id: d.id, ...data });
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(i => totalFoodCost += (i.price * i.quantity));
        }
      }
    });
    return { unsettledOrders, totalFoodCost };
  } catch (e) {
    return { unsettledOrders: [], totalFoodCost: 0 };
  }
}

export async function settleRoomFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(
      collection(db, "hotels", hotelId, "pos_orders"), 
      where("roomNumber", "==", roomNumber),
      where("isSettled", "==", false)
    );
    const snap = await getDocs(q);
    const promises = [];
    snap.forEach(d => {
      const docRef = doc(db, "hotels", hotelId, "pos_orders", d.id);
      promises.push(updateDoc(docRef, { isSettled: true, settledAt: new Date().toISOString() }));
    });
    await Promise.all(promises);
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}
