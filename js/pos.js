import { db } from "./firebase-config.js";
import { doc, setDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const FOODING_GST_RATE = 5;

export function computeOrderTax(items = []) {
  const grossTotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
  const taxable = grossTotal / (1 + FOODING_GST_RATE / 100);
  const totalTax = grossTotal - taxable;
  return {
    taxable: Number(taxable.toFixed(2)), cgst: Number((totalTax / 2).toFixed(2)),
    sgst: Number((totalTax / 2).toFixed(2)), grandTotal: Number(grossTotal.toFixed(2))
  };
}

export async function createPosOrder(hotelId, orderDetails) {
  const orderId = "KOT_" + Date.now().toString(36).toUpperCase();
  const tax = computeOrderTax(orderDetails.items);
  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), {
    ...orderDetails, orderId, tax, settled: false, status: "served", createdAt: new Date().toISOString()
  });
  return { success: true, orderId, tax };
}

export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    const q = query(collection(db, "hotels", hotelId, "pos_orders"), where("roomNumber", "==", roomNumber));
    const snap = await getDocs(q);
    const unsettledOrders = [];
    let totals = { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 };

    snap.forEach(d => {
      const data = d.data();
      if (data.settled === true) return;
      unsettledOrders.push(data);
      const t = data.tax || computeOrderTax(data.items || []);
      totals.taxable += Number(t.taxable) || 0;
      totals.cgst += Number(t.cgst) || 0;
      totals.sgst += Number(t.sgst) || 0;
      totals.grandTotal += Number(t.grandTotal) || 0;
    });
    Object.keys(totals).forEach(k => totals[k] = Number(totals[k].toFixed(2)));
    return { unsettledOrders, totals };
  } catch (e) { return { unsettledOrders: [], totals: { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 } }; }
}
