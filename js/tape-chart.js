import { db } from "./firebase-config.js";
import { collection, doc, setDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize default rooms for a new hotel
export async function initializeDefaultRooms(hotelId) {
  const roomsRef = collection(db, "hotels", hotelId, "rooms");
  const snap = await getDocs(roomsRef);
  
  // Only create defaults if the hotel has no rooms yet
  if (!snap.empty) return;

  const defaults = [
    { roomId: "101", roomNumber: "101", floor: "Floor 1", type: "Deluxe AC", rate: 800, foodRate: 1000, status: "vacant" },
    { roomId: "102", roomNumber: "102", floor: "Floor 1", type: "Deluxe AC", rate: 800, foodRate: 1000, status: "vacant" },
    { roomId: "201", roomNumber: "201", floor: "Floor 2", type: "Super Deluxe", rate: 1200, foodRate: 1000, status: "vacant" },
    { roomId: "202", roomNumber: "202", floor: "Floor 2", type: "Executive Suite", rate: 1500, foodRate: 1000, status: "vacant" }
  ];
  
  for (const r of defaults) {
    await setDoc(doc(db, "hotels", hotelId, "rooms", r.roomId), r);
  }
}

// Mark a room as clean (changes status from 'cleaning' to 'vacant')
export async function markRoomCleaned(hotelId, roomId) {
  await updateDoc(doc(db, "hotels", hotelId, "rooms", roomId), { 
    status: "vacant",
    currentBookingId: null,
    guestName: null
  });
}
