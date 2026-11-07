// SmartFix HMS - Interactive Room Grid & Floor Tape Chart Engine
import { db } from "./firebase-config.js";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Initialize default room inventory for a newly registered hotel
 * @param {string} hotelId 
 */
export async function initializeDefaultRooms(hotelId) {
  const roomsRef = collection(db, "hotels", hotelId, "rooms");
  const existingRooms = await getDocs(roomsRef);
  
  if (!existingRooms.empty) return; // Skip if rooms already exist

  const sampleRooms = [
    // Floor 1
    { roomId: "101", roomNumber: "101", floor: "Floor 1", type: "Deluxe AC", rate: 2200, status: "vacant" },
    { roomId: "102", roomNumber: "102", floor: "Floor 1", type: "Deluxe AC", rate: 2200, status: "vacant" },
    { roomId: "103", roomNumber: "103", floor: "Floor 1", type: "Super Deluxe", rate: 2800, status: "vacant" },
    { roomId: "104", roomNumber: "104", floor: "Floor 1", type: "Standard Non-AC", rate: 1500, status: "vacant" },
    // Floor 2
    { roomId: "201", roomNumber: "201", floor: "Floor 2", type: "Executive Suite", rate: 3500, status: "vacant" },
    { roomId: "202", roomNumber: "202", floor: "Floor 2", type: "Deluxe AC", rate: 2200, status: "vacant" },
    { roomId: "203", roomNumber: "203", floor: "Floor 2", type: "Deluxe AC", rate: 2200, status: "vacant" },
    { roomId: "204", roomNumber: "204", floor: "Floor 2", type: "Super Deluxe", rate: 2800, status: "vacant" },
    // Floor 3
    { roomId: "301", roomNumber: "301", floor: "Floor 3", type: "Presidential Suite", rate: 5000, status: "vacant" },
    { roomId: "302", roomNumber: "302", floor: "Floor 3", type: "Deluxe AC", rate: 2200, status: "vacant" }
  ];

  for (const r of sampleRooms) {
    await setDoc(doc(db, "hotels", hotelId, "rooms", r.roomId), r);
  }
}

/**
 * Subscribe to realtime room updates and render dynamic tape chart
 * @param {string} hotelId 
 * @param {Function} onRoomClickCallback 
 */
export function listenToRoomGrid(hotelId, onRoomClickCallback) {
  const roomsRef = collection(db, "hotels", hotelId, "rooms");

  return onSnapshot(roomsRef, (snapshot) => {
    const rooms = [];
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    let cleaningRooms = 0;

    snapshot.forEach((docSnap) => {
      const roomData = docSnap.data();
      rooms.push(roomData);
      totalRooms++;

      if (roomData.status === "occupied") occupiedRooms++;
      else if (roomData.status === "cleaning") cleaningRooms++;
      else vacantRooms++;
    });

    // Update live counter badges on dashboard
    const elTotal = document.getElementById("statTotalRooms");
    const elOccupied = document.getElementById("statOccupiedRooms");
    const elVacant = document.getElementById("statVacantRooms");
    const elOccupancyRate = document.getElementById("statOccupancyRate");

    if (elTotal) elTotal.innerText = totalRooms;
    if (elOccupied) elOccupied.innerText = occupiedRooms;
    if (elVacant) elVacant.innerText = vacantRooms;
    if (elOccupancyRate && totalRooms > 0) {
      const rate = Math.round((occupiedRooms / totalRooms) * 100);
      elOccupancyRate.innerText = `${rate}%`;
    }

    renderTapeChartUI(rooms, onRoomClickCallback);
  }, (error) => {
    console.error("SmartFix HMS: Realtime Room Listener Error:", error);
  });
}

/**
 * Render floor-wise layout inside DOM
 */
function renderTapeChartUI(rooms, onRoomClickCallback) {
  const container = document.getElementById("roomGridContainer");
  if (!container) return;

  // Group rooms by floor
  const floors = {};
  rooms.forEach(r => {
    const floorKey = r.floor || "Floor 1";
    if (!floors[floorKey]) floors[floorKey] = [];
    floors[floorKey].push(r);
  });

  // Sort floors
  const sortedFloors = Object.keys(floors).sort();
  let html = "";

  sortedFloors.forEach(floor => {
    // Sort room numbers numerically
    floors[floor].sort((a, b) => (parseInt(a.roomNumber) || 0) - (parseInt(b.roomNumber) || 0));

    html += `
      <div class="mb-6">
        <div class="text-xs font-semibold tracking-wider text-cyan-400 uppercase mb-3 flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full bg-cyan-400"></span>
          ${floor}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
    `;

    floors[floor].forEach(room => {
      // Color coding & styling
      let statusBg = "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400";
      let statusBadge = "bg-emerald-500/20 text-emerald-400";
      let label = "Vacant";

      if (room.status === "occupied") {
        statusBg = "bg-rose-950/40 border-rose-500/40 text-rose-300 hover:border-rose-400";
        statusBadge = "bg-rose-500/20 text-rose-400";
        label = room.guestName ? room.guestName.split(" ")[0] : "Occupied";
      } else if (room.status === "cleaning") {
        statusBg = "bg-amber-950/40 border-amber-500/40 text-amber-300 hover:border-amber-400";
        statusBadge = "bg-amber-500/20 text-amber-400";
        label = "Cleaning";
      } else if (room.status === "maintenance") {
        statusBg = "bg-gray-800/60 border-gray-700 text-gray-400";
        statusBadge = "bg-gray-700 text-gray-300";
        label = "Out of Order";
      }

      html += `
        <div onclick="window.handleRoomClick('${room.roomId}')" 
             class="cursor-pointer border rounded-xl p-3.5 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-lg ${statusBg}">
          <div class="flex justify-between items-start mb-2">
            <span class="font-black text-lg text-white font-mono">${room.roomNumber}</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge}">${label}</span>
          </div>
          <div class="text-xs text-gray-400 truncate">${room.type}</div>
          <div class="text-xs font-semibold text-cyan-300 mt-1">₹${room.rate}/night</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind global click handler
  window.handleRoomClick = (roomId) => {
    const targetRoom = rooms.find(r => r.roomId === roomId);
    if (targetRoom && typeof onRoomClickCallback === "function") {
      onRoomClickCallback(targetRoom);
    }
  };
}

/**
 * Toggle Room Housekeeping Status directly to Vacant
 * @param {string} hotelId 
 * @param {string} roomId 
 */
export async function markRoomCleaned(hotelId, roomId) {
  const roomRef = doc(db, "hotels", hotelId, "rooms", roomId);
  await updateDoc(roomRef, {
    status: "vacant"
  });
}
