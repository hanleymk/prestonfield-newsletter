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

// ─── Sections ────────────────────────────────────────────────────────────────

function normalizeSectionRow(r) {
  return {
    issue_id:       Number(r['issue_id']),
    section_key:    String(r['section_key']    || ''),
    title:          String(r['title']          || ''),
    body:           String(r['body']           || ''),
    image_url:      String(r['image_url']      || ''),
    image_position: String(r['image_position'] || 'right'),
    display_order:  Number(r['display_order']  || 0),
    enabled:        r['enabled'] === true || r['enabled'] === 'TRUE' || r['enabled'] === 'true'
  };
}

/** Returns all sections for an issue, sorted by display_order. */
function getSectionsForIssue(issueId) {
  const numId = Number(issueId);
  return sheetToObjects(getSheet('Sections'))
    .filter(r => Number(r['issue_id']) === numId)
    .map(normalizeSectionRow)
    .sort((a, b) => a.display_order - b.display_order);
}

/**
 * Replaces all section rows for an issue with the provided array.
 * Deletes existing rows for the issue (from the bottom up to avoid index shifts),
 * then appends the new rows.
 */
function saveSectionsForIssue(issueId, sections) {
  const sheet = getSheet('Sections');
  const data = sheet.getDataRange().getValues();
  const numId = Number(issueId);

  // Collect row indices (1-based) belonging to this issue, bottom-up
  const rowsToDelete = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (Number(data[i][0]) === numId) rowsToDelete.push(i + 1);
  }
  rowsToDelete.forEach(rowIdx => sheet.deleteRow(rowIdx));

  // Append the new section rows
  sections.forEach(s => {
    sheet.appendRow([
      numId,
      s.section_key    || '',
      s.title          || '',
      s.body           || '',
      s.image_url      || '',
      s.image_position || 'right',
      s.display_order  != null ? s.display_order : 0,
      s.enabled        ? true : false
    ]);
  });
}

function testSectionsCRUD() {
  const id = createIssue('Section Test Issue', 'Test 2026');

  const sections = getSectionsForIssue(id);
  if (sections.length !== 7) throw new Error('Expected 7 default sections, got ' + sections.length);
  if (sections[0].section_key !== 'main_message') throw new Error('First section should be main_message');
  if (sections[1].section_key !== 'meeting_dates') throw new Error('Second section should be meeting_dates');
  if (sections[0].enabled !== true) throw new Error('main_message should be enabled');
  if (sections[2].enabled !== false) throw new Error('article_1 should be disabled');

  sections[0].title = 'A Note from the Board';
  sections[0].body = 'Hello neighbors!';
  sections[2].enabled = true;
  sections[2].title = 'Snow Removal';
  saveSectionsForIssue(id, sections);

  const saved = getSectionsForIssue(id);
  if (saved[0].title !== 'A Note from the Board') throw new Error('title not saved');
  if (saved[0].body !== 'Hello neighbors!') throw new Error('body not saved');
  if (saved[2].enabled !== true) throw new Error('article_1 enabled not saved');

  Logger.log('✓ Sections CRUD passed');
}

// ─── Drive Image Upload ───────────────────────────────────────────────────────

/**
 * Returns the "HOA Newsletter Images" Drive folder, creating it if needed.
 */
function getOrCreateImageFolder() {
  const folders = DriveApp.getFoldersByName('HOA Newsletter Images');
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder('HOA Newsletter Images');
}

/**
 * Uploads a base64-encoded image to Google Drive and returns a public embed URL.
 *
 * @param {string} fileName   e.g. "community-pool.jpg"
 * @param {string} mimeType   e.g. "image/jpeg"
 * @param {string} base64Data base64-encoded file contents (no data: prefix)
 * @returns {string}  Public URL: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function uploadImageToDrive(fileName, mimeType, base64Data) {
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', fileName);
  const folder = getOrCreateImageFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
}

/**
 * Permanently deletes an issue and all its sections from the spreadsheet.
 * Does NOT delete Drive images (they may be referenced elsewhere).
 * @param {number} issueId
 */
function deleteIssue(issueId) {
  const numId = Number(issueId);

  // Delete section rows (bottom-up to avoid index shifts)
  const sectionsSheet = getSheet('Sections');
  const secData = sectionsSheet.getDataRange().getValues();
  const secRowsToDelete = [];
  for (let i = secData.length - 1; i >= 1; i--) {
    if (Number(secData[i][0]) === numId) secRowsToDelete.push(i + 1);
  }
  secRowsToDelete.forEach(rowIdx => sectionsSheet.deleteRow(rowIdx));

  // Delete the issue row
  const issuesSheet = getSheet('Issues');
  const issueData = issuesSheet.getDataRange().getValues();
  for (let i = issueData.length - 1; i >= 1; i--) {
    if (Number(issueData[i][0]) === numId) {
      issuesSheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error('Issue not found: ' + issueId);
}

function testImageUpload() {
  // A minimal 1x1 transparent PNG in base64
  const tiny1x1Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const url = uploadImageToDrive('test-image.png', 'image/png', tiny1x1Png);
  Logger.log('Uploaded URL: ' + url);
  if (!url.startsWith('https://drive.google.com/uc')) throw new Error('URL format unexpected: ' + url);
  Logger.log('✓ uploadImageToDrive passed — check Drive for "HOA Newsletter Images" folder');
}
