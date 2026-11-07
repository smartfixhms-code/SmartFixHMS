import { db } from "./firebase-config.js";
import { doc, setDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const FOODING_GST_RATE = 5;

export function computeOrderTax(items = []) {
  const gross = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const taxable = gross / (1 + FOODING_GST_RATE / 100), tax = gross - taxable;
  return { taxable: Number(taxable.toFixed(2)), cgst: Number((tax/2).toFixed(2)), sgst: Number((tax/2).toFixed(2)), grandTotal: Number(gross.toFixed(2)) };
}

export async function createPosOrder(hotelId, orderDetails) {
  const orderId = "KOT_" + Date.now().toString(36).toUpperCase(), tax = computeOrderTax(orderDetails.items);
  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), { ...orderDetails, orderId, tax, settled: false, status: "served", createdAt: new Date().toISOString() });
  return { success: true, orderId, tax };
}

export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber));
    const snap = await getDocs(q), unsettled = []; let totals = { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 };
    snap.forEach(d => {
      if (d.data().settled) return;
      unsettled.push(d.data()); const t = d.data().tax || computeOrderTax(d.data().items || []);
      totals.taxable += t.taxable; totals.cgst += t.cgst; totals.sgst += t.sgst; totals.grandTotal += t.grandTotal;
    });
    Object.keys(totals).forEach(k => totals[k] = Number(totals[k].toFixed(2)));
    return { unsettledOrders: unsettled, totals };
  } catch (e) { return { unsettledOrders: [], totals: { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 } }; }
}
