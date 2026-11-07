// SmartFix HMS - Unified Print Engine (58mm / 80mm Thermal & A4 Invoice)

/**
 * Trigger Print dialog with dynamically injected document
 * @param {string} htmlContent 
 * @param {string} title 
 */
function openPrintWindow(htmlContent, title = "Print Bill") {
  const printWindow = window.open("", "_blank", "width=800,height=900");
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
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Courier, monospace, sans-serif; }
        @media print {
          body { background: transparent !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body onload="window.print(); setTimeout(() => { window.close(); }, 500);">
      ${htmlContent}
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * 1. Generate 58mm POS Thermal Slip (Compact Pocket Printer)
 */
export function print58mmThermalReceipt(hotel, booking, foodOrders = []) {
  const isFoodingPlan = booking.packageType === "fooding_lodging";
  const dateStr = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });

  let foodTotal = 0;
  let foodRows = "";
  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(order => {
      order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        foodTotal += itemTotal;
        foodRows += `
          <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
            <span>${item.quantity}x ${item.name.substring(0, 14)}</span>
            <span>₹${itemTotal.toFixed(2)}</span>
          </div>
        `;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 48mm; max-width: 48mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; line-height: 1.25; color: #000;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="font-weight: 900; font-size: 13px; text-transform: uppercase;">${hotel.hotelName || "SmartFix HMS"}</div>
        <div style="font-size: 9px;">${hotel.address || "Station Road, West Bengal"}</div>
        <div style="font-size: 9px;">GSTIN: ${hotel.gstin || "19ABCDE1234F1Z5"}</div>
        <div style="font-size: 9px;">Ph: ${hotel.phone || "+91 9876543210"}</div>
      </div>

      <div style="font-size: 10px; margin-bottom: 4px; border-bottom: 1px dashed #000; padding-bottom: 4px;">
        <div>Inv: ${booking.bookingId || "BK-001"}</div>
        <div>Date: ${dateStr}</div>
        <div>Guest: <b>${booking.guestName}</b></div>
        <div>Room: <b>${booking.roomNumber}</b> (${booking.roomType || "Standard"})</div>
        <div>Stay: ${booking.nights || 1} Night(s)</div>
        <div>Plan: <b>${isFoodingPlan ? "Food + Lodge (MAP)" : "Room Only (EP)"}</b></div>
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:10px; margin-bottom:2px;">
          <span>Item</span><span>Amt</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
          <span>Room Lodging</span>
          <span>₹${(booking.lodging?.total || booking.roomTotal || 0).toFixed(2)}</span>
        </div>
        ${isFoodingPlan ? `
          <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:2px;">
            <span>Meal Package</span>
            <span>₹${(booking.fooding?.total || 0).toFixed(2)}</span>
          </div>
        ` : ""}
        ${foodRows}
      </div>

      <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Taxable:</span>
          <span>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Total GST:</span>
          <span>₹${(booking.summary?.grandTax || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px; margin-top:2px;">
          <span>TOTAL:</span>
          <span>₹${grandTotal.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9px; margin-top:2px;">
          <span>Payment:</span>
          <span>${booking.paymentMode || "UPI / Cash"} (PAID)</span>
        </div>
      </div>

      <div style="text-align: center; font-size: 9px; margin-top: 4px;">
        <div>Thank You For Staying!</div>
        <div style="font-size: 8px; color: #555;">Powered by SmartFix HMS</div>
      </div>
    </div>
  `;

  openPrintWindow(html, `Thermal-58mm-${booking.bookingId}`);
}

/**
 * 2. Generate 80mm POS Thermal Slip (Desktop Thermal Printer)
 */
export function print80mmThermalReceipt(hotel, booking, foodOrders = []) {
  const isFoodingPlan = booking.packageType === "fooding_lodging";
  const dateStr = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  let foodTotal = 0;
  let foodRows = "";
  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(order => {
      order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        foodTotal += itemTotal;
        foodRows += `
          <tr style="font-size:11px;">
            <td>${item.name} (${item.quantity})</td>
            <td style="text-align:center;">996331</td>
            <td style="text-align:right;">₹${itemTotal.toFixed(2)}</td>
          </tr>
        `;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 72mm; max-width: 72mm; margin: 0 auto; padding: 3mm 0; font-size: 12px; line-height: 1.3; color: #000;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: 900; font-size: 16px; text-transform: uppercase;">${hotel.hotelName || "SmartFix HMS"}</div>
        <div style="font-size: 11px;">${hotel.address || "Station Road, West Bengal"}</div>
        <div style="font-size: 11px;"><b>GSTIN:</b> ${hotel.gstin || "19ABCDE1234F1Z5"}</div>
        <div style="font-size: 11px;"><b>Phone:</b> ${hotel.phone || "+91 9876543210"}</div>
        <div style="font-size: 12px; font-weight: bold; margin-top: 3px;">TAX INVOICE / CASH RECEIPT</div>
      </div>

      <div style="font-size: 11px; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 6px;">
        <div style="display:flex; justify-content:space-between;"><span>Invoice No: <b>${booking.bookingId}</b></span><span>Date: ${dateStr.split(",")[0]}</span></div>
        <div>Guest Name: <b>${booking.guestName}</b></div>
        <div>Phone: ${booking.phone || "N/A"} | ID: Aadhaar Verified</div>
        <div style="display:flex; justify-content:space-between; margin-top:2px;">
          <span>Room: <b>${booking.roomNumber}</b></span>
          <span>Plan: <b>${isFoodingPlan ? "Food + Lodge" : "Room Only"}</b></span>
        </div>
        <div>Stay: ${booking.checkIn || dateStr} to ${booking.checkOut || "Today"} (${booking.nights || 1}N)</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px;">
        <thead>
          <tr style="border-bottom: 1px solid #000; font-weight: bold;">
            <th style="text-align:left;">Description</th>
            <th style="text-align:center;">HSN/SAC</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Room Rent (${booking.roomType || "Standard"})</td>
            <td style="text-align:center;">996311</td>
            <td style="text-align:right;">₹${(booking.lodging?.taxable || booking.roomTotal || 0).toFixed(2)}</td>
          </tr>
          ${isFoodingPlan ? `
            <tr>
              <td>Meal Package (MAP)</td>
              <td style="text-align:center;">996331</td>
              <td style="text-align:right;">₹${(booking.fooding?.taxable || 0).toFixed(2)}</td>
            </tr>
          ` : ""}
          ${foodRows}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin-bottom: 6px;">
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>Taxable Value:</span><span>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>CGST:</span><span>₹${(booking.summary?.totalCgst || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>SGST:</span><span>₹${(booking.summary?.totalSgst || 0).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight:900; font-size:14px; margin-top:4px;">
          <span>GRAND TOTAL:</span><span>₹${grandTotal.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:2px;">
          <span>Payment Status:</span><span>PAID (${booking.paymentMode || "UPI"})</span>
        </div>
      </div>

      <div style="text-align: center; font-size: 10px;">
        <div>Thank You For Your Visit!</div>
        <div style="font-size: 8px; color: #444; margin-top: 2px;">SmartFix HMS Cloud Platform</div>
      </div>
    </div>
  `;

  openPrintWindow(html, `Thermal-80mm-${booking.bookingId}`);
}

/**
 * 3. Generate Official A4 Full Page Tax Folio
 */
export function printA4TaxInvoice(hotel, booking, foodOrders = []) {
  const isFoodingPlan = booking.packageType === "fooding_lodging";
  const dateStr = new Date().toLocaleString("en-IN", { dateStyle: "long" });

  let foodTotal = 0;
  let foodRows = "";
  let sl = 2;

  if (isFoodingPlan) sl = 3;

  if (foodOrders && foodOrders.length > 0) {
    foodOrders.forEach(order => {
      order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        foodTotal += itemTotal;
        foodRows += `
          <tr>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">${sl++}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">
              <b>Room Service (POS #${order.orderId})</b><br>
              <small style="color:#64748b;">${item.name} x ${item.quantity}</small>
            </td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">996331</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">₹${item.price.toFixed(2)}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">${item.quantity}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">₹${itemTotal.toFixed(2)}</td>
          </tr>
        `;
      });
    });
  }

  const grandTotal = (booking.summary?.grandTotal || booking.totalAmount || 0) + foodTotal;

  const html = `
    <div style="width: 210mm; min-height: 297mm; padding: 15mm 20mm; margin: 0 auto; background: #fff; color: #1e293b; position: relative;">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #0891b2; padding-bottom: 12px; margin-bottom: 15px;">
        <div>
          <h1 style="font-size: 26px; color: #0f172a; margin-bottom: 4px;">SmartFix <span style="color:#0891b2;">HMS</span></h1>
          <div style="font-size: 12px; color: #64748b; line-height: 1.4;">
            <strong>${hotel.hotelName || "The Grand Palace Hotel"}</strong><br>
            ${hotel.address || "Station Road, Kalyani, Nadia, West Bengal - 741235"}<br>
            GSTIN: ${hotel.gstin || "19ABCDE1234F1Z5"} | Phone: ${hotel.phone || "+91 9876543210"}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase;">TAX INVOICE</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">
            <strong>Invoice No:</strong> ${booking.bookingId}<br>
            <strong>Date:</strong> ${dateStr}<br>
            <strong>Plan:</strong> ${isFoodingPlan ? "Fooding + Lodging (MAP)" : "Room Only (EP)"}
          </div>
        </div>
      </div>

      <!-- Guest Details -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; margin-bottom: 15px; font-size: 12px;">
        <div>
          <div style="color:#0891b2; font-weight:bold; margin-bottom:4px; text-transform:uppercase;">Guest Information</div>
          <p><strong>Name:</strong> ${booking.guestName}</p>
          <p><strong>Phone:</strong> ${booking.phone || "+91 98XXXXXXXX"}</p>
          <p><strong>ID Type:</strong> Aadhaar / Govt ID Verified</p>
          <p><strong>State Code:</strong> 19 (West Bengal)</p>
        </div>
        <div>
          <div style="color:#0891b2; font-weight:bold; margin-bottom:4px; text-transform:uppercase;">Stay Details</div>
          <p><strong>Room Assigned:</strong> ${booking.roomNumber} (${booking.roomType || "Deluxe AC"})</p>
          <p><strong>Check-In:</strong> ${booking.checkIn || dateStr}</p>
          <p><strong>Check-Out:</strong> ${booking.checkOut || "Today"}</p>
          <p><strong>Total Nights:</strong> ${booking.nights || 1} Night(s) / ${booking.guests || 1} Guest(s)</p>
        </div>
      </div>

      <!-- Itemized Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
        <thead>
          <tr style="background:#0f172a; color:#fff;">
            <th style="padding:8px 10px; text-align:center;">Sl.</th>
            <th style="padding:8px 10px; text-align:left;">Particulars / Description</th>
            <th style="padding:8px 10px; text-align:center;">SAC/HSN</th>
            <th style="padding:8px 10px; text-align:center;">Rate</th>
            <th style="padding:8px 10px; text-align:center;">Duration/Qty</th>
            <th style="padding:8px 10px; text-align:right;">Taxable Amt (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">1</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">
              <b>Room Lodging (${booking.roomType || "Standard"})</b><br>
              <small style="color:#64748b;">Lodging Service</small>
            </td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">996311</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">₹${(booking.lodging?.ratePerNight || 0).toFixed(2)}</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">${booking.nights || 1} Night(s)</td>
            <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">₹${(booking.lodging?.taxable || 0).toFixed(2)}</td>
          </tr>
          ${isFoodingPlan ? `
            <tr>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">2</td>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0;">
                <b>Meal Package (MAP Plan)</b><br>
                <small style="color:#64748b;">Breakfast & Dining Included</small>
              </td>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">996331</td>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">₹${(booking.fooding?.ratePerNight || 0).toFixed(2)}</td>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">${booking.nights || 1} Night(s)</td>
              <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">₹${(booking.fooding?.taxable || 0).toFixed(2)}</td>
            </tr>
          ` : ""}
          ${foodRows}
        </tbody>
      </table>

      <!-- Total & Tax Section -->
      <div style="display:flex; justify-content:space-between; margin-top: 10px;">
        <div style="width: 48%; font-size: 11px; background: #f1f5f9; padding: 10px; border-radius: 6px;">
          <strong>GST Breakdown</strong>
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
            <tr style="background:#cbd5e1; font-weight:bold;">
              <td style="padding:4px;">Type</td>
              <td style="padding:4px;">Taxable</td>
              <td style="padding:4px;">CGST</td>
              <td style="padding:4px;">SGST</td>
            </tr>
            <tr>
              <td style="padding:4px;">Room (12%)</td>
              <td style="padding:4px;">₹${(booking.lodging?.taxable || 0).toFixed(2)}</td>
              <td style="padding:4px;">₹${(booking.lodging?.cgst || 0).toFixed(2)}</td>
              <td style="padding:4px;">₹${(booking.lodging?.sgst || 0).toFixed(2)}</td>
            </tr>
            ${isFoodingPlan ? `
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
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span>Taxable Subtotal:</span>
            <strong>₹${(booking.summary?.grandTaxable || 0).toFixed(2)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span>Total GST:</span>
            <strong>₹${(booking.summary?.grandTax || 0).toFixed(2)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; color:#0891b2; border-top:2px solid #0f172a; border-bottom:2px solid #0f172a; padding:6px 0; margin-top:6px;">
            <span>Grand Total:</span>
            <span>₹${grandTotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:12px; color:#059669;">
            <span>Payment Mode:</span>
            <span>${booking.paymentMode || "UPI"} (SETTLED)</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="position:absolute; bottom:15mm; left:20mm; right:20mm; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:12px;">
        <div style="font-size: 10px; color: #64748b; max-width: 60%; line-height: 1.4;">
          <strong>Terms & Conditions:</strong><br>
          1. Standard checkout time is 11:00 AM.<br>
          2. All disputes are subject to local jurisdiction.<br>
          3. Computer generated invoice by SmartFix HMS.
        </div>
        <div style="text-align: center; font-size: 11px;">
          <div style="width: 140px; border-top: 1px solid #64748b; margin-bottom: 4px;"></div>
          Authorized Signature
        </div>
      </div>
    </div>
  `;

  openPrintWindow(html, `A4-Invoice-${booking.bookingId}`);
}
