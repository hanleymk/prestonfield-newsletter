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

// ─── Issues ──────────────────────────────────────────────────────────────────

function normalizeIssue(row) {
  const createdRaw = row['created_date'];
  const publishedRaw = row['published_date'];
  return {
    issue_id: Number(row['issue_id']),
    title: String(row['title'] || ''),
    season_label: String(row['season_label'] || ''),
    status: String(row['status'] || 'draft'),
    created_date: createdRaw instanceof Date ? createdRaw.toISOString() : String(createdRaw || ''),
    published_date: publishedRaw instanceof Date ? publishedRaw.toISOString() : String(publishedRaw || '')
  };
}

/** Returns all issues, oldest first. */
function getAllIssues() {
  return sheetToObjects(getSheet('Issues')).map(normalizeIssue);
}

/** Returns published issues sorted newest-first. */
function getPublishedIssues() {
  return getAllIssues()
    .filter(i => i['status'] === 'published')
    .sort((a, b) => new Date(b['published_date']) - new Date(a['published_date']));
}

function getIssueById(id) {
  const numId = Number(id);
  return getAllIssues().find(i => i['issue_id'] === numId) || null;
}

/**
 * Creates a new issue row and its default section rows.
 * Returns the new issue_id.
 */
function createIssue(title, seasonLabel) {
  const all = getAllIssues();
  const nextId = all.length > 0 ? Math.max(...all.map(i => i.issue_id)) + 1 : 1;
  const now = new Date();
  getSheet('Issues').appendRow([nextId, title, seasonLabel || '', 'draft', now, '']);

  // Create the 7 default section rows for this issue
  const sectionsSheet = getSheet('Sections');
  const defaults = [
    [nextId, 'main_message',  "President's Message", '', '', 'right', 0, true],
    [nextId, 'meeting_dates', 'Board Meeting Dates',  '', '', '',      1, true],
    [nextId, 'article_1',    '',                      '', '', 'right', 2, false],
    [nextId, 'article_2',    '',                      '', '', 'right', 3, false],
    [nextId, 'article_3',    '',                      '', '', 'right', 4, false],
    [nextId, 'article_4',    '',                      '', '', 'right', 5, false],
    [nextId, 'article_5',    '',                      '', '', 'right', 6, false],
  ];
  defaults.forEach(row => sectionsSheet.appendRow(row));
  return nextId;
}

/**
 * Updates a single field on an issue row.
 * @param {number} id  issue_id
 * @param {string} field  column header name
 * @param value  new value
 */
function updateIssueField(id, field, value) {
  const sheet = getSheet('Issues');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const colIdx = headers.indexOf(field);
  if (colIdx === -1) throw new Error('Issues column not found: ' + field);
  const numId = Number(id);
  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][0]) === numId) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      return;
    }
  }
  throw new Error('Issue not found: ' + id);
}

function testCreateAndGetIssue() {
  const id = createIssue('Test Issue', 'Spring 2026');
  Logger.log('Created issue_id: ' + id);
  const issue = getIssueById(id);
  if (!issue) throw new Error('getIssueById returned null for id ' + id);
  if (issue.title !== 'Test Issue') throw new Error('title mismatch: ' + issue.title);
  if (issue.status !== 'draft') throw new Error('status should be draft, got: ' + issue.status);

  const sections = getSectionsForIssue(id);
  if (sections.length !== 7) throw new Error('Expected 7 sections, got ' + sections.length);

  updateIssueField(id, 'season_label', 'Spring 2026 Updated');
  const updated = getIssueById(id);
  if (updated.season_label !== 'Spring 2026 Updated') throw new Error('updateIssueField failed');

  Logger.log('✓ createIssue, getIssueById, updateIssueField passed');
}
