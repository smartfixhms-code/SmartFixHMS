// SmartFix HMS - Restaurant POS, KOT & Room Service Engine
import { db } from "./firebase-config.js";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Standard 5% GST for Restaurant & Room Service (SAC 996331)
const RESTAURANT_GST_RATE = 5;

// Default Food & Beverage Catalog
export const DEFAULT_MENU_ITEMS = [
  { id: "M1", name: "Masala Chai / Milk Tea", category: "Beverages", price: 30 },
  { id: "M2", name: "Filter Coffee", category: "Beverages", price: 50 },
  { id: "M3", name: "Veg Club Sandwich", category: "Snacks", price: 120 },
  { id: "M4", name: "Crispy French Fries", category: "Snacks", price: 100 },
  { id: "M5", name: "Paneer Butter Masala", category: "Main Course", price: 240 },
  { id: "M6", name: "Chicken Curry (Bengali Style)", category: "Main Course", price: 280 },
  { id: "M7", name: "Butter Naan (2 Pcs)", category: "Breads", price: 80 },
  { id: "M8", name: "Steamed Basmati Rice", category: "Rice", price: 90 },
  { id: "M9", name: "Mineral Water (1 Litre)", category: "Beverages", price: 25 },
  { id: "M10", name: "Special Bengali Fish Thali", category: "Thali", price: 320 }
];

/**
 * Calculate POS Cart Totals with 5% Restaurant GST
 * @param {Array<{id: string, name: string, price: number, quantity: number}>} cartItems 
 */
export function calculatePosTotals(cartItems) {
  let subtotal = 0;

  cartItems.forEach(item => {
    subtotal += (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
  });

  const totalTax = (subtotal * RESTAURANT_GST_RATE) / 100;
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const grandTotal = subtotal + totalTax;

  return {
    itemsCount: cartItems.length,
    subtotal: Number(subtotal.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2))
  };
}

/**
 * Place a Room Service KOT or Walk-in Dining Order
 * @param {string} hotelId 
 * @param {object} orderDetails 
 */
export async function createPosOrder(hotelId, {
  orderType = "room_service", // 'room_service' | 'walk_in'
  roomNumber = "",
  bookingId = "",
  guestName = "Walk-in Guest",
  items = [],
  paymentMode = "Room Folio", // 'Room Folio' | 'Cash' | 'UPI'
  settled = false
}) {
  try {
    if (!items || items.length === 0) {
      throw new Error("Cannot place an empty food order.");
    }

    const orderId = "KOT_" + Date.now().toString().slice(-6);
    const totals = calculatePosTotals(items);

    const orderPayload = {
      orderId,
      orderType,
      roomNumber,
      bookingId,
      guestName,
      items,
      totals,
      paymentMode,
      settled: orderType === "room_service" ? false : settled, // Room service bills settle at checkout
      status: "preparing", // 'preparing' | 'served' | 'cancelled'
      createdAt: new Date().toISOString()
    };

    // Save order inside hotel POS collection
    const orderRef = doc(db, "hotels", hotelId, "pos_orders", orderId);
    await setDoc(orderRef, orderPayload);

    return { success: true, orderId, orderPayload };
  } catch (error) {
    console.error("SmartFix HMS: POS Order Creation Failed:", error);
    throw error;
  }
}

/**
 * Fetch all unbilled POS food charges for a specific room to add to checkout folio
 * @param {string} hotelId 
 * @param {string} roomNumber 
 */
export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    const ordersRef = collection(db, "hotels", hotelId, "pos_orders");
    const q = query(
      ordersRef, 
      where("roomNumber", "==", roomNumber),
      where("orderType", "==", "room_service"),
      where("settled", "==", false)
    );

    const snapshot = await getDocs(q);
    const unsettledOrders = [];
    let totalFoodCost = 0;

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      unsettledOrders.push(data);
      totalFoodCost += (data.totals?.grandTotal || 0);
    });

    return {
      unsettledOrders,
      totalFoodCost: Number(totalFoodCost.toFixed(2))
    };
  } catch (error) {
    console.error("SmartFix HMS: Failed to fetch room food orders:", error);
    return { unsettledOrders: [], totalFoodCost: 0 };
  }
}
