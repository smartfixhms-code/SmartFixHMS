// SmartFix HMS - Unified Thermal & A4 Engine with Floor-Wise WiFi & Monochrome Logo

function openPrintWindow(htmlContent, title = "Print Bill") {
  const printWindow = window.open("", "_blank", "width=850,height=950");
  if (!printWindow) {
    alert("Please allow popups to print invoices.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, monospace, sans-serif; }
        @media print {
          body { background: transparent !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body onload="window.print(); setTimeout(() => { window.close(); }, 600);">
      ${htmlContent}
    </body>
    </html>
  `);
  printWindow.document.close();
}

const MONO_FOOTER_LOGO = `
  <div style="text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px solid #000;">
    <svg width="130" height="30" viewBox="0 0 460 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(10, 5)">
        <rect x="0" y="32" width="22" height="58" rx="2" stroke="#000" stroke-width="4" fill="none" />
        <rect x="68" y="32" width="22" height="58" rx="2" stroke="#000" stroke-width="4" fill="none" />
        <path d="M26 24 L45 8 L64 24 L64 90 L26 90 Z" stroke="#000" stroke-width="5" fill="none" />
        <circle cx="45" cy="50" r="18" fill="none" stroke="#000" stroke-width="4" />
        <polyline points="37,50 43,56 55,42" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <text x="110" y="52" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="44" fill="#000">SmartFix</text>
      <rect x="300" y="18" width="94" height="38" rx="6" fill="#000" />
      <text x="347" y="45" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" fill="#fff" text-anchor="middle">HMS</text>
      <text x="112" y="80" font-family="'Segoe UI', sans-serif" font-weight="700" font-size="12" fill="#000" letter-spacing="3.5">HOTEL MANAGEMENT SYSTEM</text>
    </svg>
    <div style="font-size: 8px; color: #333; margin-top: 2px;">Smart Cloud Property Management</div>
  </div>
`;

function getFloorWifiString(hotel, floor) {
  const targetFloor = floor || "Floor 1";
  const pass = (hotel.floorWifi && hotel.floorWifi[targetFloor]) ? hotel.floorWifi[targetFloor] : (hotel.defaultWifi || "Welcome@123");
  return `<div style="padding: 3px 0; font-size: 10px; border-bottom: 1px dashed #000;">📶 <b>Free WiFi (${targetFloor}):</b> ${pass}</div>`;
}

/**
 * 58mm Thermal Print
 */
export function print58mmThermalReceipt(hotel, booking, foodOrders = []) {
  const isFooding = booking.packageType === "fooding_lodging";
  const inTime = booking.checkInTime || new Date().toLocaleString("en-IN");
  const outTime = booking.checkOutTime || new Date().toLocaleString("en-IN");

  let foodTotal = 0;
  let foodRows = "";
  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(ord => {
      ord.items.forEach(it => {
        const amt = it.price * it.quantity;
        foodTotal += amt;
        foodRows += `<div style="display:flex; justify-content:space-between; font-size:10px;"><span>${it.quantity}x ${it.name.substring(0, 13)}</span><span>₹${amt.toFixed(2)}</span></div>`;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 48mm; max-width: 48mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; line-height: 1.25; color: #000;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="font-weight: 900; font-size: 15px; text-transform: uppercase;">${hotel.hotelName || "HOTEL PARADISE"}</div>
        <div style="font-size: 9px;">${hotel.address || "Station Road, West Bengal"}</div>
        <div style="font-size: 9px;">GSTIN: ${hotel.gstin || "19ABCDE1234F1Z5"}</div>
        <div style="font-size: 9px;">Ph: ${hotel.phone || "+91 9876543210"}</div>
      </div>

      <div style="font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div>Inv: <b>${booking.bookingId}</b></div>
        <div>Guest: <b>${booking.guestName}</b></div>
        <div>ID: <b>${booking.idType} (${booking.idNumber})</b></div>
        <div>Guests: ${booking.adults || 1} Adult(s), ${booking.children || 0} Child</div>
        <div>Room: <b>${booking.roomNumber}</b> (${booking.floor || 'Floor 1'})</div>
        <div>In: ${inTime}</div>
        <div>Out: ${outTime}</div>
      </div>

      ${getFloorWifiString(hotel, booking.floor)}

      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="display:flex; justify-content:space-between; font-size:10px;">
          <span>Room Lodging (SAC 996311)</span>
          <span>₹${(booking.lodging?.taxable || booking.roomTotal || 0).toFixed(2)}</span>
        </div>
        ${isFooding ? `
          <div style="display:flex; justify-content:space-between; font-size:10px;">
            <span>Meal Package (SAC 996331)</span>
            <span>₹${(booking.fooding?.taxable || 0).toFixed(2)}</span>
          </div>
        ` : ""}
        ${foodRows}
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
        <div style="display:flex; justify-content:space-between;"><span>Taxable Subtotal:</span><span>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>CGST:</span><span>₹${(booking.summary?.totalCgst || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>SGST:</span><span>₹${(booking.summary?.totalSgst || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:900; font-size:12px; margin-top:2px;">
          <span>TOTAL:</span>
          <span>₹${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      ${MONO_FOOTER_LOGO}
    </div>
  `;
  openPrintWindow(html, `Thermal-58mm-${booking.bookingId}`);
}

/**
 * 80mm Thermal Print
 */
export function print80mmThermalReceipt(hotel, booking, foodOrders = []) {
  const isFooding = booking.packageType === "fooding_lodging";
  const inTime = booking.checkInTime || new Date().toLocaleString("en-IN");
  const outTime = booking.checkOutTime || new Date().toLocaleString("en-IN");

  let foodTotal = 0;
  let foodRows = "";
  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(ord => {
      ord.items.forEach(it => {
        const amt = it.price * it.quantity;
        foodTotal += amt;
        foodRows += `
          <tr style="font-size:11px;">
            <td>${it.name} (x${it.quantity})</td>
            <td style="text-align:center;">996331</td>
            <td style="text-align:right;">₹${amt.toFixed(2)}</td>
          </tr>
        `;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 74mm; max-width: 74mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; line-height: 1.3; color: #000;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: 900; font-size: 17px; text-transform: uppercase;">${hotel.hotelName || "HOTEL PARADISE"}</div>
        <div style="font-size: 10px;">${hotel.address || "Station Road, West Bengal"}</div>
        <div style="font-size: 10px;"><b>GSTIN:</b> ${hotel.gstin || "19ABCDE1234F1Z5"} | <b>Ph:</b> ${hotel.phone || "+91 9876543210"}</div>
      </div>

      <div style="font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
        <div style="display:flex; justify-content:space-between;"><span>Inv: <b>${booking.bookingId}</b></span><span>Date: ${new Date().toLocaleDateString("en-IN")}</span></div>
        <div>Guest: <b>${booking.guestName}</b> | Ph: ${booking.phone || 'N/A'}</div>
        <div>ID: <b>${booking.idType} (${booking.idNumber})</b></div>
        <div>Room: <b>${booking.roomNumber}</b> (${booking.floor || 'Floor 1'})</div>
        <div>Check-In: <b>${inTime}</b> | Check-Out: <b>${outTime}</b></div>
      </div>

      ${getFloorWifiString(hotel, booking.floor)}

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align:left;">Service</th>
            <th style="text-align:center;">SAC</th>
            <th style="text-align:right;">Taxable</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Room Lodging (${booking.nights || 1}N)</td>
            <td style="text-align:center;">996311</td>
            <td style="text-align:right;">₹${(booking.lodging?.taxable || booking.roomTotal || 0).toFixed(2)}</td>
          </tr>
          ${isFooding ? `
            <tr>
              <td>Meal Package (MAP)</td>
              <td style="text-align:center;">996331</td>
              <td style="text-align:right;">₹${(booking.fooding?.taxable || 0).toFixed(2)}</td>
            </tr>
          ` : ""}
          ${foodRows}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; border-bottom: 2px solid #000; padding: 4px 0; margin-bottom: 6px;">
        <div style="display:flex; justify-content:space-between;"><span>Taxable Value:</span><span>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>CGST:</span><span>₹${(booking.summary?.totalCgst || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>SGST:</span><span>₹${(booking.summary?.totalSgst || 0).toFixed(2)}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:900; font-size:13px; margin-top:3px;">
          <span>GRAND TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span>
        </div>
      </div>

      ${MONO_FOOTER_LOGO}
    </div>
  `;
  openPrintWindow(html, `Thermal-80mm-${booking.bookingId}`);
}

/**
 * A4 Official Tax Folio
 */
export function printA4TaxInvoice(hotel, booking, foodOrders = []) {
  const isFooding = booking.packageType === "fooding_lodging";
  const inTime = booking.checkInTime || new Date().toLocaleString("en-IN");
  const outTime = booking.checkOutTime || new Date().toLocaleString("en-IN");

  let foodTotal = 0;
  let foodRows = "";
  let sl = isFooding ? 3 : 2;

  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(ord => {
      ord.items.forEach(it => {
        const amt = it.price * it.quantity;
        foodTotal += amt;
        foodRows += `
          <tr>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">${sl++}</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1;"><b>Room Service POS (#${ord.orderId})</b> - ${it.name} x ${it.quantity}</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">996331</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">₹${it.price.toFixed(2)}</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">${it.quantity}</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">₹${amt.toFixed(2)}</td>
          </tr>
        `;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: #fff; color: #000; position: relative;">
      <!-- Hotel Name Large Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px;">
        <div>
          <h1 style="font-size: 26px; font-weight: 900; text-transform: uppercase;">${hotel.hotelName || "HOTEL PARADISE"}</h1>
          <div style="font-size: 12px; color: #333; line-height: 1.4; margin-top: 4px;">
            ${hotel.address || "Station Road, West Bengal"}<br>
            <strong>GSTIN:</strong> ${hotel.gstin || "19ABCDE1234F1Z5"} | <strong>Phone:</strong> ${hotel.phone || "+91 9876543210"}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 22px; font-weight: 900; text-transform: uppercase;">TAX INVOICE</div>
          <div style="font-size: 12px; color: #333; margin-top: 4px;">
            <strong>Invoice No:</strong> ${booking.bookingId}<br>
            <strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}<br>
            <strong>Plan:</strong> ${isFooding ? "Fooding + Lodging (MAP)" : "Room Only (EP)"}
          </div>
        </div>
      </div>

      <!-- Guest and Stay Grid -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; margin-bottom: 15px; font-size: 12px;">
        <div>
          <strong style="text-transform:uppercase; font-size:11px; color:#475569;">Guest Profile</strong>
          <p style="margin-top:4px;"><strong>Name:</strong> ${booking.guestName}</p>
          <p><strong>Phone:</strong> ${booking.phone || 'N/A'}</p>
          <p><strong>Mandatory ID:</strong> <span style="background:#e2e8f0; padding:2px 6px; border-radius:4px; font-weight:bold;">${booking.idType} (${booking.idNumber})</span></p>
          <p><strong>Guests:</strong> ${booking.adults || 1} Adult(s), ${booking.children || 0} Child</p>
        </div>
        <div>
          <strong style="text-transform:uppercase; font-size:11px; color:#475569;">Stay Timeline & WiFi</strong>
          <p style="margin-top:4px;"><strong>Room:</strong> ${booking.roomNumber} (${booking.roomType || 'Standard'})</p>
          <p><strong>Actual Check-In:</strong> ${inTime}</p>
          <p><strong>Actual Check-Out:</strong> ${outTime}</p>
          <p style="color:#0891b2;"><strong>Free WiFi (${booking.floor || 'Floor 1'}):</strong> ${(hotel.floorWifi && hotel.floorWifi[booking.floor]) ? hotel.floorWifi[booking.floor] : 'Welcome@123'}</p>
        </div>
      </div>

      <!-- Itemized Table with Accurate SAC Codes -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
        <thead>
          <tr style="background:#0f172a; color:#fff;">
            <th style="padding:8px; text-align:center;">Sl.</th>
            <th style="padding:8px; text-align:left;">Service Particulars</th>
            <th style="padding:8px; text-align:center;">SAC</th>
            <th style="padding:8px; text-align:center;">Rate</th>
            <th style="padding:8px; text-align:center;">Duration</th>
            <th style="padding:8px; text-align:right;">Taxable Amt (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">1</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1;"><b>Room Lodging (${booking.roomType || 'Standard'})</b></td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">996311</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">₹${(booking.lodging?.ratePerNight || 0).toFixed(2)}</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">${booking.nights || 1} Night(s)</td>
            <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">₹${(booking.lodging?.taxable || 0).toFixed(2)}</td>
          </tr>
          ${isFooding ? `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">2</td>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1;"><b>Meal Package (MAP Plan)</b></td>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">996331</td>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">₹${(booking.fooding?.ratePerNight || 0).toFixed(2)}</td>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:center;">${booking.nights || 1} Night(s)</td>
              <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">₹${(booking.fooding?.taxable || 0).toFixed(2)}</td>
            </tr>
          ` : ""}
          ${foodRows}
        </tbody>
      </table>

      <!-- Tax Summary -->
      <div style="display:flex; justify-content:space-between; margin-top: 10px;">
        <div style="width: 48%; font-size: 11px; background: #f8fafc; border:1px solid #cbd5e1; padding: 10px; border-radius: 6px;">
          <strong>SAC-Wise GST Breakdown</strong>
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
            <tr style="background:#e2e8f0; font-weight:bold;">
              <td style="padding:4px;">Service</td>
              <td style="padding:4px;">Taxable</td>
              <td style="padding:4px;">CGST</td>
              <td style="padding:4px;">SGST</td>
            </tr>
            <tr>
              <td style="padding:4px;">Lodging (12%)</td>
              <td style="padding:4px;">₹${(booking.lodging?.taxable || 0).toFixed(2)}</td>
              <td style="padding:4px;">₹${(booking.lodging?.cgst || 0).toFixed(2)}</td>
              <td style="padding:4px;">₹${(booking.lodging?.sgst || 0).toFixed(2)}</td>
            </tr>
            ${isFooding ? `
              <tr>
                <td style="padding:4px;">Food (5%)</td>
                <td style="padding:4px;">₹${(booking.fooding?.taxable || 0).toFixed(2)}</td>
                <td style="padding:4px;">₹${(booking.fooding?.cgst || 0).toFixed(2)}</td>
                <td style="padding:4px;">₹${(booking.fooding?.sgst || 0).toFixed(2)}</td>
              </tr>
            ` : ""}
          </table>
        </div>

        <div style="width: 45%; font-size: 13px;">
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Taxable Subtotal:</span><strong>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Total GST:</span><strong>₹${(booking.summary?.grandTax || 0).toFixed(2)}</strong></div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; border-top:2px solid #000; border-bottom:2px solid #000; padding:6px 0; margin-top:6px;">
            <span>Grand Total:</span>
            <span>₹${grandTotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px; color:#059669;">
            <span>Payment Mode:</span>
            <span>${booking.paymentMode || "UPI"} (SETTLED)</span>
          </div>
        </div>
      </div>

      <!-- Footer Brand -->
      <div style="position:absolute; bottom:15mm; left:20mm; right:20mm; border-top: 1px solid #000; padding-top: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="font-size: 10px; color: #444; max-width: 60%; line-height: 1.4;">
            <strong>Terms & Conditions:</strong><br>
            1. Standard checkout time is 11:00 AM.<br>
            2. High-speed guest WiFi credentials provided above.
          </div>
          <div style="text-align: center; font-size: 11px;">
            <div style="width: 140px; border-top: 1px solid #000; margin-bottom: 4px;"></div>
            Authorized Signature
          </div>
        </div>
        ${MONO_FOOTER_LOGO}
      </div>
    </div>
  `;
  openPrintWindow(html, `A4-Invoice-${booking.bookingId}`);
}
