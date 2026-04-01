// ════════════════════════════════════════════════════════════════════════════
// Data.gs  —  All Google Sheets read/write operations and Drive image upload
// ════════════════════════════════════════════════════════════════════════════

// ─── Spreadsheet helpers ─────────────────────────────────────────────────────

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

/**
 * Converts a sheet's data range into an array of plain objects,
 * using row 1 as the property names.
 */
function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Returns the Config sheet as a plain key/value object.
 * e.g. { hoa_name: "Prestonfield HOA", mgmt_company_phone: "..." }
 */
function getConfig() {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  const config = {};
  data.forEach(row => {
    const key = String(row[0] || '').trim();
    if (key) config[key] = String(row[1] || '').trim();
  });
  return config;
}

// ─── Board Members ────────────────────────────────────────────────────────────

/**
 * Returns board members for the most recent year as an array of objects:
 * [{ year, name, role, display_order }, ...]
 */
function getBoardMembers() {
  const rows = sheetToObjects(getSheet('BoardMembers'));
  if (rows.length === 0) return [];
  const years = rows.map(r => Number(r['year'])).filter(y => !isNaN(y) && y > 0);
  if (years.length === 0) return [];
  const maxYear = Math.max(...years);
  return rows
    .filter(r => Number(r['year']) === maxYear)
    .sort((a, b) => Number(a['display_order']) - Number(b['display_order']))
    .map(r => ({
      year: Number(r['year']),
      name: String(r['name'] || ''),
      role: String(r['role'] || ''),
      display_order: Number(r['display_order'] || 0)
    }));
}

// ─── Manual test functions (run from Apps Script editor to verify) ────────────

function testGetConfig() {
  const config = getConfig();
  Logger.log('hoa_name: ' + config['hoa_name']);
  Logger.log('authorized_users: ' + config['authorized_users']);
  if (!config['hoa_name']) throw new Error('hoa_name is empty — check Config sheet');
  Logger.log('✓ getConfig passed');
}

function testGetBoardMembers() {
  const members = getBoardMembers();
  Logger.log('Board members count: ' + members.length);
  members.forEach(m => Logger.log(m['name'] + ' — ' + m['role']));
  Logger.log('✓ getBoardMembers passed');
}
