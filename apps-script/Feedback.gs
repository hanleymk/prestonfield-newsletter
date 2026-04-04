// ════════════════════════════════════════════════════════════════════════════
// Feedback.gs  —  Handles homeowner feedback form submissions
//                 Called from doPost() in Code.gs
// ════════════════════════════════════════════════════════════════════════════

/**
 * Main entry point called by doPost when action === 'feedback'.
 * @param {Object} params  Parsed POST parameters from e.parameter
 * @returns {Object}       Plain object wrapped in jsonResponse by Code.gs
 */
function handleFeedbackPost(params) {
  // ── Honeypot check ───────────────────────────────────────────────────────
  // Bots fill hidden fields; humans never see it. Return silent success so
  // the bot doesn't know it was detected and doesn't retry.
  if (params.website && String(params.website).trim() !== '') {
    return { status: 'ok' };
  }

  // ── Input validation ─────────────────────────────────────────────────────
  const message = String(params.message || '').trim().slice(0, 5000);
  if (!message) {
    return { status: 'error', message: 'Message is required.' };
  }

  // ── reCAPTCHA verification ───────────────────────────────────────────────
  const recaptchaToken = String(params['g-recaptcha-response'] || '').trim();
  if (!recaptchaToken) {
    return { status: 'error', message: 'Please complete the reCAPTCHA checkbox.' };
  }
  if (!verifyRecaptcha(recaptchaToken)) {
    return { status: 'error', message: 'reCAPTCHA verification failed. Please try again.' };
  }

  // ── Sanitize optional fields ─────────────────────────────────────────────
  const name  = String(params.name  || '').trim().slice(0, 200);
  const email = String(params.email || '').trim().slice(0, 200);

  // ── Save to Feedback sheet ───────────────────────────────────────────────
  saveFeedback(name, email, message);

  // ── Email notification ───────────────────────────────────────────────────
  try {
    sendFeedbackEmail(name, email, message);
  } catch (mailErr) {
    // Log but don't fail the submission if email sending errors
    Logger.log('sendFeedbackEmail error: ' + mailErr.message);
  }

  return { status: 'ok' };
}

// ─── reCAPTCHA verification ──────────────────────────────────────────────────

/**
 * Calls Google's reCAPTCHA API server-side to verify the user's token.
 * @param {string} token  The g-recaptcha-response value from the form
 * @returns {boolean}     true if verification passed
 */
function verifyRecaptcha(token) {
  const secretKey = (getConfig()['recaptcha_secret_key'] || '').trim();
  if (!secretKey) {
    Logger.log('WARNING: recaptcha_secret_key not set in Config sheet');
    return false;
  }
  try {
    const response = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method:           'post',
      contentType:      'application/x-www-form-urlencoded',
      payload:          'secret=' + encodeURIComponent(secretKey) +
                        '&response=' + encodeURIComponent(token),
      muteHttpExceptions: true
    });
    const result = JSON.parse(response.getContentText());
    return result.success === true;
  } catch (e) {
    Logger.log('verifyRecaptcha error: ' + e.message);
    return false;
  }
}

// ─── Sheet operations ────────────────────────────────────────────────────────

/**
 * Returns the Feedback sheet, creating it with headers if it doesn't exist.
 */
function getOrCreateFeedbackSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Feedback');
  if (!sheet) {
    sheet = ss.insertSheet('Feedback');
    sheet.appendRow(['timestamp', 'name', 'email', 'message']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(3, 220);
    sheet.setColumnWidth(4, 400);
  }
  return sheet;
}

/**
 * Appends one feedback row to the Feedback sheet.
 */
function saveFeedback(name, email, message) {
  getOrCreateFeedbackSheet().appendRow([new Date(), name, email, message]);
}

// ─── Email notification ──────────────────────────────────────────────────────

/**
 * Sends an email notification to the first admin in authorized_users.
 * Sets reply-to to the submitter's email if one was provided.
 */
function sendFeedbackEmail(name, email, message) {
  const config       = getConfig();
  const adminEmail   = (config['authorized_users'] || '').split(',')[0].trim();
  if (!adminEmail) {
    Logger.log('sendFeedbackEmail: no admin email found in authorized_users');
    return;
  }

  const body =
    'A homeowner has submitted feedback through the newsletter website.\n\n' +
    '---\n' +
    'Name:    ' + (name  || '(not provided)') + '\n' +
    'Email:   ' + (email || '(not provided)') + '\n\n' +
    'Message:\n' + message + '\n' +
    '---\n\n' +
    'Submitted: ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }) + '\n\n' +
    'View all submissions in the Feedback sheet of the Prestonfield HOA Newsletter spreadsheet.';

  const options = { to: adminEmail, subject: 'New Feedback — Prestonfield HOA Newsletter', body: body };
  if (email) options.replyTo = email;
  MailApp.sendEmail(options);
}

// ─── Manual test ─────────────────────────────────────────────────────────────

/**
 * Run from the Apps Script editor to test sheet creation and data saving.
 * Comment out sendFeedbackEmail to avoid sending a real email during testing.
 */
function testFeedbackFlow() {
  const sheet = getOrCreateFeedbackSheet();
  Logger.log('Sheet: ' + sheet.getName());

  saveFeedback('Test User', 'test@example.com', 'This is a test submission.');
  const rows = sheet.getDataRange().getValues();
  const last = rows[rows.length - 1];
  if (last[2] !== 'test@example.com') throw new Error('Email not saved: ' + last[2]);
  if (last[3] !== 'This is a test submission.') throw new Error('Message not saved: ' + last[3]);
  Logger.log('✓ saveFeedback passed');

  // Uncomment to test email sending:
  // sendFeedbackEmail('Test User', 'test@example.com', 'This is a test submission.');
  // Logger.log('✓ sendFeedbackEmail passed');

  Logger.log('✓ testFeedbackFlow passed');
}
