import { db } from "./firebase-config.js";
import { collection, doc, setDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function initializeDefaultRooms(hotelId) {
  const snap = await getDocs(collection(db, "hotels", hotelId, "rooms"));
  if (!snap.empty) return;
  const defaults = [
    { roomId: "101", roomNumber: "101", floor: "Floor 1", type: "Deluxe AC", rate: 2200, foodRate: 1000, status: "vacant" },
    { roomId: "102", roomNumber: "102", floor: "Floor 1", type: "Deluxe AC", rate: 2200, foodRate: 1000, status: "vacant" },
    { roomId: "201", roomNumber: "201", floor: "Floor 2", type: "Super Deluxe", rate: 2800, foodRate: 1000, status: "vacant" },
    { roomId: "202", roomNumber: "202", floor: "Floor 2", type: "Suite", rate: 5000, foodRate: 1000, status: "vacant" }
  ];
  for (const r of defaults) await setDoc(doc(db, "hotels", hotelId, "rooms", r.roomId), r);
}

export async function markRoomCleaned(hotelId, roomId) { await updateDoc(doc(db, "hotels", hotelId, "rooms", roomId), { status: "vacant" }); }
