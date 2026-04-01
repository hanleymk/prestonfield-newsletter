// ════════════════════════════════════════════════════════════════════════════
// Auth.gs  —  Spreadsheet ID constant and authorization helpers
// ════════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = '1bG8vR6MHzSpIyi-Ak2iLFYX8PXfsUX-fU6qI--nP6n4';

/**
 * Returns the email address of the currently logged-in Google account.
 * Returns empty string if called from a public (unauthenticated) context.
 */
function getCurrentUserEmail() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (e) {
    return '';
  }
}

/**
 * Returns true if the current user's email is in the authorized_users Config row.
 */
function isAuthorized() {
  try {
    const config = getConfig();
    const raw = config['authorized_users'] || '';
    const list = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const user = getCurrentUserEmail().toLowerCase();
    return Boolean(user) && list.includes(user);
  } catch (e) {
    return false;
  }
}

/**
 * Throws if the current user is not authorized. Call at the top of every
 * Admin.gs function that modifies data.
 */
function requireAuth() {
  if (!isAuthorized()) {
    throw new Error('Access denied. Your account (' + getCurrentUserEmail() + ') is not authorized.');
  }
}
