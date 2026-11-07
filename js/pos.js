import { db } from "./firebase-config.js";
import { doc, setDoc, getDocs, collection, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Create a new POS order (KOT)
export async function createPosOrder(hotelId, orderDetails) {
  const orderId = "KOT_" + Date.now().toString().slice(-6);
  
  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), {
    orderId, 
    ...orderDetails, 
    status: "served", 
    createdAt: new Date().toISOString()
  });
  
  return { success: true, orderId };
}

// Fetch all unsettled food orders for a specific room to add to the main bill
export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    // Query orders by room number
    const q = query(
      collection(db, "hotels", hotelId, "pos_orders"), 
      where("roomNumber", "==", roomNumber)
    );
    
    const snap = await getDocs(q);
    const unsettledOrders = [];
    let totalFoodCost = 0;

    snap.forEach(d => {
      const data = d.data();
      
      // Only include orders that are served and not yet settled (billed)
      if (data.status === "served" && !data.isSettled) {
        unsettledOrders.push({ id: d.id, ...data });
        
        // Calculate total food cost
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(i => {
            totalFoodCost += (i.price * i.quantity);
          });
        }
      }
    });

    return { unsettledOrders, totalFoodCost };
  } catch (e) {
    console.error("Error fetching POS orders:", e);
    return { unsettledOrders: [], totalFoodCost: 0 };
  }
}

// Optional: Mark food orders as settled once the guest checks out
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
    console.error("Error settling POS orders:", e);
    return { success: false, error: e.message };
  }
}
