// pos.js - SmartFix HMS
// Restaurant / KOT POS orders for room-service food billing.
// Every order stores its GST breakdown so thermal/A4 invoices stay CA-compliant.
import { db } from "./firebase-config.js";
import {
  doc, setDoc, getDocs, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------- Fooding GST (SAC 996331) ----------
export const FOODING_GST_RATE = 5; // total – split into CGST 2.5% + SGST 2.5%

// ---------- Collision-safe order ID ----------
function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KOT_${ts}_${rand}`;
}

/**
 * Compute food-order totals with GST, given an items array.
 * Each item: { name, price, quantity }
 * `price` is treated as GST-inclusive (typical restaurant menu).
 * If you store pre-tax prices, pass `pricesAreTaxInclusive = false`.
 */
export function computeOrderTax(items = [], pricesAreTaxInclusive = true) {
  const grossTotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );

  let taxable, totalTax, cgst, sgst, grand;
  if (pricesAreTaxInclusive) {
    // Extract tax out of the gross amount
    grand = grossTotal;
    taxable = grossTotal / (1 + FOODING_GST_RATE / 100);
    totalTax = grand - taxable;
  } else {
    // Add tax on top of pre-tax price
    taxable = grossTotal;
    totalTax = taxable * FOODING_GST_RATE / 100;
    grand = taxable + totalTax;
  }
  cgst = totalTax / 2;
  sgst = totalTax / 2;

  return {
    taxable: Number(taxable.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    totalTax: Number(totalTax.toFixed(2)),
    grandTotal: Number(grand.toFixed(2))
  };
}

// ---------- Create POS order ----------
export async function createPosOrder(hotelId, orderDetails) {
  if (!hotelId) throw new Error("Missing hotelId");
  if (!orderDetails || !Array.isArray(orderDetails.items) || orderDetails.items.length === 0) {
    throw new Error("POS order must have at least one item");
  }

  const orderId = generateOrderId();
  const tax = computeOrderTax(orderDetails.items, orderDetails.pricesAreTaxInclusive !== false);

  await setDoc(doc(db, "hotels", hotelId, "pos_orders", orderId), {
    ...orderDetails,
    orderId,
    // BUG FIX #9: persist GST breakdown so invoices don't have to recompute
    tax,
    // BUG FIX #13: default unsettled → auto-settled only at checkout
    settled: false,
    settledAt: null,
    settledBookingId: null,
    status: "served",
    createdAt: new Date().toISOString()
  });

  return { success: true, orderId, tax };
}

// ---------- Fetch unsettled food orders for a room ----------
export async function getRoomUnsettledFoodOrders(hotelId, roomNumber) {
  try {
    if (!hotelId || !roomNumber) {
      return { unsettledOrders: [], totals: emptyTotals() };
    }

    const q = query(
      collection(db, "hotels", hotelId, "pos_orders"),
      where("roomNumber", "==", roomNumber)
    );
    const snap = await getDocs(q);

    const unsettledOrders = [];
    const totals = emptyTotals();

    snap.forEach((d) => {
      const data = d.data();
      // BUG FIX #2: only include orders that were never settled.
      // Missing `settled` field = legacy order → treat as unsettled only if
      // not marked otherwise. Safer: legacy orders were shown before, so keep
      // the same behavior (include them) but they'll be auto-settled on next
      // checkout by `processCheckOut` in bookings.js.
      if (data.settled === true) return;

      unsettledOrders.push(data);

      // Aggregate using stored tax if present, else recompute on the fly.
      const t = data.tax || computeOrderTax(data.items || []);
      totals.taxable += Number(t.taxable) || 0;
      totals.cgst += Number(t.cgst) || 0;
      totals.sgst += Number(t.sgst) || 0;
      totals.grandTotal += Number(t.grandTotal) || 0;
      totals.itemsCount += (data.items || []).reduce(
        (n, it) => n + (Number(it.quantity) || 0), 0
      );
    });

    // Round to 2 decimals for display safety
    Object.keys(totals).forEach(k => {
      totals[k] = Number(totals[k].toFixed(2));
    });

    return { unsettledOrders, totals };
  } catch (e) {
    console.warn("getRoomUnsettledFoodOrders failed:", e.message);
    return { unsettledOrders: [], totals: emptyTotals() };
  }
}

function emptyTotals() {
  return { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0, itemsCount: 0 };
}

// ---------- Mark a POS order settled (called from checkout flow optionally) ----------
export async function settlePosOrder(hotelId, orderId, bookingId) {
  if (!hotelId || !orderId) throw new Error("Missing hotelId or orderId");
  await setDoc(
    doc(db, "hotels", hotelId, "pos_orders", orderId),
    {
      settled: true,
      settledAt: new Date().toISOString(),
      settledBookingId: bookingId || null
    },
    { merge: true }
  );
  return { success: true };
}
