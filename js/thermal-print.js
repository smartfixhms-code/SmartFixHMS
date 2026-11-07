function esc(v) { return v ? String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : ""; }
function money(n) { return (Number(n) || 0).toFixed(2); }
function openPrintWindow(htmlContent, title = "Print Bill") {
  const pw = window.open("", "_blank", "width=850,height=950");
  if (!pw) return alert("Please allow popups.");
  pw.document.open();
  pw.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><style>* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; } body { background: #fff; color: #000; } @media print { body { padding: 0 !important; } }</style></head><body>${htmlContent}</body></html>`);
  pw.document.close();
  setTimeout(() => { pw.focus(); pw.print(); const close = () => { try { pw.close(); } catch(e){} }; pw.onafterprint = close; setTimeout(close, 45000); }, 250);
}

const MONO_FOOTER = `<div style="text-align: center; margin-top: 8px; padding-top: 6px; border-top: 1px solid #000;"><svg width="130" height="30" viewBox="0 0 460 110" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(10, 5)"><rect x="0" y="32" width="22" height="58" rx="2" stroke="#000" stroke-width="4" fill="none" /><rect x="68" y="32" width="22" height="58" rx="2" stroke="#000" stroke-width="4" fill="none" /><path d="M26 24 L45 8 L64 24 L64 90 L26 90 Z" stroke="#000" stroke-width="5" fill="none" /><circle cx="45" cy="50" r="18" fill="none" stroke="#000" stroke-width="4" /><polyline points="37,50 43,56 55,42" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /></g><text x="110" y="52" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="44" fill="#000">SmartFix</text><rect x="300" y="18" width="94" height="38" rx="6" fill="#000" /><text x="347" y="45" font-family="'Segoe UI', sans-serif" font-weight="900" font-size="22" fill="#fff" text-anchor="middle">HMS</text><text x="112" y="80" font-family="'Segoe UI', sans-serif" font-weight="700" font-size="12" fill="#000" letter-spacing="3.5">HOTEL MANAGEMENT SYSTEM</text></svg><div style="font-size: 8px; color: #333; margin-top: 2px;">Smart Cloud Property Management</div></div>`;

function getFloorWifiString(hotel, floor) {
  const targetFloor = floor || "Floor 1", pass = (hotel.floorWifi && hotel.floorWifi[targetFloor]) ? hotel.floorWifi[targetFloor] : (hotel.defaultWifi || "Welcome@123");
  return `<div style="padding: 3px 0; font-size: 10px; border-bottom: 1px dashed #000;">📶 <b>Free WiFi (${esc(targetFloor)}):</b> ${esc(pass)}</div>`;
}
function getFoodTotals(food) {
  if (!food) return { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 };
  if (food.totals) return food.totals;
  if (typeof food.totalFoodCost === "number") { const gross = food.totalFoodCost, taxable = gross / 1.05, tax = gross - taxable; return { taxable, cgst: tax / 2, sgst: tax / 2, grandTotal: gross }; }
  return { taxable: 0, cgst: 0, sgst: 0, grandTotal: 0 };
}

export function print58mmThermalReceipt(hotel, booking, foodOrders = []) {
  let foodRows = "", foodGross = 0;
  if (foodOrders) foodOrders.forEach(ord => (ord.items || []).forEach(it => { const amt = (Number(it.price) || 0) * (Number(it.quantity) || 0); foodGross += amt; foodRows += `<div style="display:flex; justify-content:space-between; font-size:10px;"><span>${esc(it.quantity)}x ${esc(String(it.name || "").substring(0, 13))}</span><span>₹${money(amt)}</span></div>`; }));
  const foodTotals = getFoodTotals({ totalFoodCost: foodGross }), advance = booking.advancePaid || 0, grandTotal = (booking.summary?.grandTotal || 0) + foodGross, balance = grandTotal - advance;

  const html = `<div style="width: 48mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; line-height: 1.25; color: #000;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 4px;"><div style="font-weight: 900; font-size: 15px;">${esc(hotel.hotelName || "HOTEL PARADISE")}</div><div style="font-size: 9px;">${esc(hotel.address || "")}</div><div style="font-size: 9px;">GSTIN: ${esc(hotel.gstin || "")} | Ph: ${esc(hotel.phone || "")}</div></div>
    <div style="font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;"><div>Inv: <b>${esc(booking.bookingId)}</b></div><div>Guest: <b>${esc(booking.guestName)}</b></div><div>Room: <b>${esc(booking.roomNumber)}</b></div></div>
    ${getFloorWifiString(hotel, booking.floor)}
    <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">
      <div style="display:flex; justify-content:space-between; font-size:10px;"><span>Lodging</span><span>₹${money(booking.lodging?.taxable || 0)}</span></div>
      ${booking.packageType === 'fooding_lodging' ? `<div style="display:flex; justify-content:space-between; font-size:10px;"><span>Meal Pkg</span><span>₹${money(booking.fooding?.taxable || 0)}</span></div>` : ""}${foodRows}
    </div>
    <div style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 10px;">
      <div style="display:flex; justify-content:space-between;"><span>Taxable:</span><span>₹${money((booking.summary?.grandTaxable || 0) + foodTotals.taxable)}</span></div>
      <div style="display:flex; justify-content:space-between; font-weight:900; font-size:12px; margin-top:2px;"><span>TOTAL:</span><span>₹${money(grandTotal)}</span></div>
      ${advance > 0 ? `<div style="display:flex; justify-content:space-between; color:#16a34a;"><span>Advance:</span><span>-₹${money(advance)}</span></div><div style="display:flex; justify-content:space-between; font-weight:bold; color:#dc2626;"><span>Due:</span><span>₹${money(balance)}</span></div>` : ""}
    </div>${MONO_FOOTER}</div>`;
  openPrintWindow(html, `Thermal-58mm-${booking.bookingId}`);
}

export function print80mmThermalReceipt(hotel, booking, foodOrders = []) {
  let foodRows = "", foodGross = 0;
  if (foodOrders) foodOrders.forEach(ord => (ord.items || []).forEach(it => { const amt = (Number(it.price) || 0) * (Number(it.quantity) || 0); foodGross += amt; foodRows += `<tr style="font-size:11px;"><td>${esc(it.name)} (x${esc(it.quantity)})</td><td style="text-align:center;">996331</td><td style="text-align:right;">₹${money(amt)}</td></tr>`; }));
  const foodTotals = getFoodTotals({ totalFoodCost: foodGross }), advance = booking.advancePaid || 0, grandTotal = (booking.summary?.grandTotal || 0) + foodGross;

  const html = `<div style="width: 74mm; margin: 0 auto; padding: 2mm 0; font-size: 11px; color: #000;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 6px;"><div style="font-weight: 900; font-size: 17px;">${esc(hotel.hotelName || "HOTEL PARADISE")}</div><div style="font-size: 10px;">${esc(hotel.address || "")}</div><div style="font-size: 10px;">GSTIN: ${esc(hotel.gstin || "")}</div></div>
    <div style="font-size: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;"><div style="display:flex; justify-content:space-between;"><span>Inv: <b>${esc(booking.bookingId)}</b></span><span>Date: ${esc(new Date().toLocaleDateString("en-IN"))}</span></div><div>Guest: <b>${esc(booking.guestName)}</b></div><div>Room: <b>${esc(booking.roomNumber)}</b></div></div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px;"><thead><tr style="border-bottom: 1px solid #000;"><th style="text-align:left;">Service</th><th style="text-align:center;">SAC</th><th style="text-align:right;">Taxable</th></tr></thead><tbody>
        <tr><td>Room Lodging</td><td style="text-align:center;">996311</td><td style="text-align:right;">₹${money(booking.lodging?.taxable || 0)}</td></tr>
        ${booking.packageType === 'fooding_lodging' ? `<tr><td>Meal Package</td><td style="text-align:center;">996331</td><td style="text-align:right;">₹${money(booking.fooding?.taxable || 0)}</td></tr>` : ""}${foodRows}
    </tbody></table>
    <div style="border-top: 1px dashed #000; border-bottom: 2px solid #000; padding: 4px 0; margin-bottom: 6px;">
      <div style="display:flex; justify-content:space-between;"><span>Taxable:</span><span>₹${money((booking.summary?.grandTaxable || 0) + foodTotals.taxable)}</span></div>
      <div style="display:flex; justify-content:space-between;"><span>CGST:</span><span>₹${money((booking.summary?.totalCgst || 0) + foodTotals.cgst)}</span></div>
      <div style="display:flex; justify-content:space-between;"><span>SGST:</span><span>₹${money((booking.summary?.totalSgst || 0) + foodTotals.sgst)}</span></div>
      <div style="display:flex; justify-content:space-between; font-weight:900; font-size:13px; margin-top:3px;"><span>GRAND TOTAL:</span><span>₹${money(grandTotal)}</span></div>
      ${advance > 0 ? `<div style="display:flex; justify-content:space-between; color:#16a34a;"><span>Advance:</span><span>₹${money(advance)}</span></div>` : ""}
    </div>${MONO_FOOTER}</div>`;
  openPrintWindow(html, `Thermal-80mm-${booking.bookingId}`);
}

export function printA4TaxInvoice(hotel, booking, foodOrders = []) {
  const isFooding = booking.packageType === "fooding_lodging"; let foodGross = 0, foodRows = "";
  if (foodOrders) foodOrders.forEach(ord => (ord.items || []).forEach(it => { const amt = (Number(it.price) || 0) * (Number(it.quantity) || 0); foodGross += amt; foodRows += `<tr><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">POS</td><td style="padding:6px; border-bottom:1px solid #ddd;">${esc(it.name)} x ${esc(it.quantity)}</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">996331</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">₹${money(amt)}</td></tr>`; }));

  const foodTaxable = foodGross / 1.05, advance = booking.advancePaid || 0, grandTotal = (booking.summary?.grandTotal || 0) + foodGross;

  const html = `<div style="width: 210mm; min-height: 290mm; padding: 15mm 20mm; margin: 0 auto; display: flex; flex-direction: column;">
    <div style="display:flex; justify-content:space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
      <div><h1 style="font-size: 22px; font-weight: 900; text-transform: uppercase;">${esc(hotel.hotelName || "HOTEL PARADISE")}</h1><div style="font-size: 11px; color: #333;">${esc(hotel.address || "")}<br>GSTIN: ${esc(hotel.gstin || "")} | Ph: ${esc(hotel.phone || "")}</div></div>
      <div style="text-align: right;"><div style="font-size: 18px; font-weight: 900;">TAX INVOICE</div><div style="font-size: 11px;">Inv: ${esc(booking.bookingId)}<br>Date: ${esc(new Date().toLocaleDateString("en-IN"))}</div></div>
    </div>
    <div style="display:flex; justify-content:space-between; background: #f8fafc; border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; font-size: 11px;">
      <div><p><strong>Guest:</strong> ${esc(booking.guestName)}</p><p><strong>Phone:</strong> ${esc(booking.phone || 'N/A')}</p><p><strong>ID:</strong> ${esc(booking.idType || 'N/A')} (${esc(booking.idNumber || 'N/A')})</p></div>
      <div><p><strong>Room:</strong> ${esc(booking.roomNumber)}</p><p><strong>Check-In:</strong> ${esc(booking.checkInTime || '')}</p><p><strong>Check-Out:</strong> ${esc(booking.checkOutTime || new Date().toLocaleString("en-IN"))}</p></div>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
      <thead><tr style="background:#0f172a; color:#fff;"><th style="padding:8px;">Sl.</th><th style="padding:8px; text-align:left;">Particulars</th><th style="padding:8px;">SAC</th><th style="padding:8px; text-align:right;">Amount (₹)</th></tr></thead>
      <tbody><tr><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">1</td><td style="padding:6px; border-bottom:1px solid #ddd;">Room Lodging (₹${money(booking.lodging?.ratePerNight)} x ${booking.nights}N)</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">996311</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">₹${money(booking.lodging?.taxable)}</td></tr>
        ${isFooding ? `<tr><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">2</td><td style="padding:6px; border-bottom:1px solid #ddd;">Meal Pkg (₹${money(booking.fooding?.ratePerHead)}/head x ${booking.adults} Adults x ${booking.nights}N)</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:center;">996331</td><td style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">₹${money(booking.fooding?.taxable)}</td></tr>` : ""}${foodRows}</tbody>
    </table>
    <div style="display:flex; justify-content:space-between; margin-bottom: 20px;">
      <div style="width: 50%; font-size: 10px; border:1px solid #ddd; padding: 8px;"><strong>GST Breakdown</strong><table style="width: 100%; margin-top: 4px;"><tr style="font-weight:bold; border-bottom:1px solid #ddd;"><td>Service</td><td>Taxable</td><td>CGST</td><td>SGST</td></tr>
        <tr><td>Lodging (12%)</td><td>₹${money(booking.lodging?.taxable)}</td><td>₹${money(booking.lodging?.cgst)}</td><td>₹${money(booking.lodging?.sgst)}</td></tr>
        ${isFooding ? `<tr><td>Fooding (5%)</td><td>₹${money(booking.fooding?.taxable)}</td><td>₹${money(booking.fooding?.cgst)}</td><td>₹${money(booking.fooding?.sgst)}</td></tr>` : ""}
        ${foodGross > 0 ? `<tr><td>POS (5%)</td><td>₹${money(foodTaxable)}</td><td>₹${money(foodTaxable*0.025)}</td><td>₹${money(foodTaxable*0.025)}</td></tr>` : ""}</table>
      </div>
      <div style="width: 45%; font-size: 12px; text-align: right;">
        <div style="display:flex; justify-content:space-between; padding:2px 0;"><span>Taxable:</span><strong>₹${money((booking.summary?.grandTaxable || 0) + foodTaxable)}</strong></div>
        <div style="display:flex; justify-content:space-between; padding:2px 0;"><span>Total GST:</span><strong>₹${money((booking.summary?.grandTax || 0) + (foodGross-foodTaxable))}</strong></div>
        <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:1px solid #000; border-bottom:1px solid #000; padding:4px 0;"><span>Grand Total:</span><span>₹${money(grandTotal)}</span></div>
        ${advance > 0 ? `<div style="display:flex; justify-content:space-between; padding:2px 0; color:#16a34a;"><span>Advance:</span><strong>-₹${money(advance)}</strong></div><div style="display:flex; justify-content:space-between; padding:4px 0; color:#dc2626; font-weight:bold;"><span>Balance Due:</span><strong>₹${money(grandTotal - advance)}</strong></div>` : ""}
      </div>
    </div>
    <div style="margin-top: auto; border-top: 1px solid #000; padding-top: 10px; display:flex; justify-content:space-between;">
      <div style="font-size: 9px;">Check-out: ${esc(hotel.checkOutTime || '11:00 AM')}<br>WiFi: ${esc((hotel.floorWifi && hotel.floorWifi[booking.floor]) ? hotel.floorWifi[booking.floor] : (hotel.defaultWifi || 'Welcome@123'))}</div>
      <div style="text-align: center; font-size: 10px;"><div style="width: 120px; border-top: 1px solid #000; margin-bottom: 4px;"></div>Authorized Signatory</div>
    </div>${MONO_FOOTER}</div>`;
  openPrintWindow(html, `A4-Invoice-${booking.bookingId}`);
}
