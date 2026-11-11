// js/common.js
// SmartFix HMS - Common functions for all pages
import { db, auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { verifyLicenseStatus, getWhatsAppSupportLink } from "./license.js";

// ============================================================
// SESSION MANAGEMENT
// ============================================================

export function getOwnerSession() {
  const data = sessionStorage.getItem('smartfix_owner_session');
  if (!data) return null;
  try { return JSON.parse(data); } catch(e) { return null; }
}

export function getStaffSession() {
  const data = sessionStorage.getItem('smartfix_staff_session');
  if (!data) return null;
  try { return JSON.parse(data); } catch(e) { return null; }
}

export function getActiveSession() {
  return getOwnerSession() || getStaffSession();
}

export function saveOwnerSession(data) {
  sessionStorage.setItem('smartfix_owner_session', JSON.stringify(data));
}

export function saveStaffSession(data) {
  sessionStorage.setItem('smartfix_staff_session', JSON.stringify(data));
}

export function clearAllSessions() {
  sessionStorage.removeItem('smartfix_owner_session');
  sessionStorage.removeItem('smartfix_staff_session');
  sessionStorage.removeItem('smartfix_disclaimer_agreed');
}

// ============================================================
// AUTHENTICATION CHECK (with license)
// ============================================================

/**
 * Call this at the top of every protected page.
 * Returns: { role, hotelId, staffName, hotelProfile, license } or null (redirects to index)
 */
export async function requireLogin() {
  const session = getActiveSession();
  if (!session || !session.hotelId) {
    window.location.href = 'index.html';
    return null;
  }
  
  // Verify license
  const lic = await verifyLicenseStatus(session.hotelId);
  
  if (lic.isSuspended) {
    // Show suspension modal on the current page
    const modal = document.getElementById('suspensionModal');
    if (modal) modal.classList.remove('hidden');
    else window.location.href = 'index.html';
    return null;
  }
  
  if (!lic.isValid) {
    const modal = document.getElementById('licenseLockModal');
    if (modal) {
      modal.classList.remove('hidden');
      const waBtn = document.getElementById('whatsappSupportBtn');
      if (waBtn) waBtn.href = getWhatsAppSupportLink(lic.details?.hotelName || "My Hotel", session.hotelId);
    } else {
      window.location.href = 'index.html';
    }
    return null;
  }
  
  return {
    role: session.role || 'owner',
    hotelId: session.hotelId,
    staffName: session.staffName || '',
    staffPhone: session.staffPhone || '',
    staffId: session.staffId || '',
    hotelProfile: lic.details || { hotelName: "Hotel Paradise" },
    daysRemaining: lic.daysRemaining
  };
}

// ============================================================
// ROLE-BASED ACCESS
// ============================================================

const ROLE_VISIBILITY = {
  owner:        ['dashboard','calendar','pos','room-manager','billing-archive','followup','marketdue','staff','reports','gst-audit','settings'],
  manager:      ['dashboard','calendar','pos','room-manager','billing-archive','followup','marketdue','staff','reports','gst-audit','settings'],
  receptionist: ['dashboard','calendar','pos','room-manager','billing-archive','followup','marketdue'],
  housekeeping: ['dashboard','calendar']
};

export function hasAccess(role, page) {
  const allowed = ROLE_VISIBILITY[role] || ROLE_VISIBILITY.owner;
  return allowed.includes(page);
}

export function getAllowedPages(role) {
  return ROLE_VISIBILITY[role] || ROLE_VISIBILITY.owner;
}

/**
 * Apply role-based UI hiding on current page.
 * Hides nav items, buttons, sections that user shouldn't see.
 */
export function applyRoleAccess(role) {
  const allowed = getAllowedPages(role);
  
  // Hide sidebar nav links
  document.querySelectorAll('[data-nav-page]').forEach(el => {
    const page = el.getAttribute('data-nav-page');
    el.style.display = allowed.includes(page) ? '' : 'none';
  });
  
  // Hide elements with data-requires attribute
  document.querySelectorAll('[data-requires]').forEach(el => {
    const required = el.getAttribute('data-requires').split(',');
    const canSee = required.some(r => 
      (r === 'owner' && role === 'owner') ||
      (r === 'manager' && ['owner','manager'].includes(role)) ||
      (r === 'receptionist' && ['owner','manager','receptionist'].includes(role)) ||
      (r === 'housekeeping' && role === 'housekeeping') ||
      (r === 'staff' && role !== 'owner') ||
      (r === 'financial' && ['owner','manager'].includes(role))
    );
    el.style.display = canSee ? '' : 'none';
  });
  
  // Update role badge
  const badge = document.getElementById('roleBadgeText');
  if (badge) {
    const labels = { owner: '👑 Owner', manager: '👔 Manager', receptionist: '🛎️ Reception', housekeeping: '🧹 Housekeeping' };
    badge.innerText = labels[role] || 'Owner';
    badge.className = 'hidden sm:block text-[10px] font-mono px-2 py-1 rounded border ' +
      (role === 'owner' ? 'text-amber-400 bg-amber-950/50 border-amber-900' : 'text-emerald-400 bg-emerald-950/50 border-emerald-900');
    badge.style.display = 'block';
  }
}

// ============================================================
// DISCLAIMER (multi-language)
// ============================================================

export function showDisclaimerIfNeeded() {
  if (sessionStorage.getItem('smartfix_disclaimer_agreed') === 'true') {
    return false;
  }
  const modal = document.getElementById('loginDisclaimerModal');
  if (modal) modal.classList.remove('hidden');
  return true;
}

export function setupDisclaimer() {
  const chk = document.getElementById('disclaimerAgreeCheck');
  const btn = document.getElementById('disclaimerAgreeBtn');
  if (chk && btn) {
    chk.addEventListener('change', () => { btn.disabled = !chk.checked; });
    btn.addEventListener('click', () => {
      if (chk.checked) {
        sessionStorage.setItem('smartfix_disclaimer_agreed', 'true');
        document.getElementById('loginDisclaimerModal').classList.add('hidden');
      }
    });
  }
}

// ============================================================
// LOGOUT
// ============================================================

export async function logout() {
  clearAllSessions();
  try { await signOut(auth); } catch(e) {}
  window.location.href = 'index.html';
}

// ============================================================
// NAVIGATION HELPERS
// ============================================================

export function goTo(page) {
  window.location.href = page + '.html';
}

// ============================================================
// UI HELPERS
// ============================================================

export function setHotelName(name) {
  const el = document.getElementById('navHotelTitle');
  if (el) el.innerText = name || 'Property';
}

export function setLicenseBadge(days) {
  const el = document.getElementById('licenseBadgeText');
  if (el) el.innerText = `${days} Days License`;
}

// ============================================================
// PASSWORD HASHING (for staff logins)
// ============================================================

export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isValidPassword(pwd) {
  if (!pwd || pwd.length < 6) return false;
  return /[A-Za-z]/.test(pwd) && /\d/.test(pwd);
}

// ============================================================
// OWNER PASSWORD VERIFICATION (for sensitive actions)
// ============================================================

/**
 * Verify owner's email + password before sensitive actions
 * like staff password reset.
 * Returns: true if verified, false otherwise
 */
export async function verifyOwnerPassword(password) {
  const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
  try {
    await signInWithEmailAndPassword(auth, auth.currentUser.email, password);
    return true;
  } catch (err) {
    return false;
  }
}
