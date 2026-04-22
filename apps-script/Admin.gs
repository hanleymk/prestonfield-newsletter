// ════════════════════════════════════════════════════════════════════════════
// Admin.gs  —  Server-side functions called from the publisher UI via
//              google.script.run.<functionName>(params)
//              Every function must call requireAuth() first.
// ════════════════════════════════════════════════════════════════════════════

function createIssueFromClient(params) {
  requireAuth();
  const id = createIssue(
    params.title       || 'Untitled',
    params.season_label || ''
  );
  return { success: true, issue_id: id };
}

function getAllIssuesFromClient() {
  requireAuth();
  // Return newest-first for the sidebar
  return getAllIssues().slice().reverse();
}

function getIssueDataFromClient(params) {
  requireAuth();
  const issue = getIssueById(params.issue_id);
  if (!issue) throw new Error('Issue not found: ' + params.issue_id);
  const numId = Number(params.issue_id);

  // Read sections in raw sheet row order so we can detect and remove duplicates.
  // Duplicate rows arise when a previously-deleted issue left orphaned section
  // rows in the sheet — if a new issue gets the same ID, createIssue appends
  // fresh blank defaults AFTER those orphaned rows. Keeping the LAST occurrence
  // of each section_key ensures the blank defaults (appended last) win over any
  // orphaned content, giving the new draft a clean slate.
  const sheet = getSheet('Sections');
  const sheetData = sheet.getDataRange().getValues();
  const headers = sheetData[0].map(h => String(h).trim());
  const issueIdCol = headers.indexOf('issue_id');

  const rawSections = [];
  for (let i = 1; i < sheetData.length; i++) {
    if (Number(sheetData[i][issueIdCol]) === numId) {
      const obj = {};
      headers.forEach((h, j) => { obj[h] = sheetData[i][j]; });
      rawSections.push(normalizeSectionRow(obj));
    }
  }

  // Deduplicate: keep last occurrence of each section_key
  const keyMap = {};
  rawSections.forEach(s => { keyMap[s.section_key] = s; });
  let sections = Object.values(keyMap).sort((a, b) => a.display_order - b.display_order);

  // If duplicates were found, write the clean set back to the sheet immediately
  // so subsequent opens are clean without needing another dedup pass.
  if (rawSections.length > sections.length) {
    saveSectionsForIssue(numId, sections);
  }

  // Backfill any section keys added to the system after this issue was first
  // created (e.g. sidebar_note was added in a later release).
  const sectionDefaults = {
    sidebar_note: { title: '', body: '', image_url: '', image_position: '', display_order: 7, enabled: false }
  };
  const existingKeys = sections.map(s => s.section_key);
  const toAdd = [];
  Object.keys(sectionDefaults).forEach(function(key) {
    if (!existingKeys.includes(key)) {
      const d = sectionDefaults[key];
      toAdd.push(normalizeSectionRow({
        issue_id: numId, section_key: key, title: d.title, body: d.body,
        image_url: d.image_url, image_position: d.image_position,
        display_order: d.display_order, enabled: d.enabled
      }));
      sheet.appendRow([numId, key, d.title, d.body, d.image_url, d.image_position, d.display_order, d.enabled]);
    }
  });
  if (toAdd.length > 0) {
    sections = sections.concat(toAdd).sort((a, b) => a.display_order - b.display_order);
  }

  return { issue: issue, sections: sections };
}

function saveContentFromClient(params) {
  requireAuth();
  const id = Number(params.issue_id);
  if (params.title        !== undefined) updateIssueField(id, 'title',        params.title);
  if (params.season_label !== undefined) updateIssueField(id, 'season_label', params.season_label);
  if (params.sections) {
    const sections = JSON.parse(params.sections);
    saveSectionsForIssue(id, sections);
  }
  return { success: true };
}

function setStatusFromClient(params) {
  requireAuth();
  const id        = Number(params.issue_id);
  const newStatus = params.status; // 'draft' | 'preview' | 'published'

  if (!['draft', 'preview', 'published'].includes(newStatus)) {
    throw new Error('Invalid status: ' + newStatus);
  }

  updateIssueField(id, 'status', newStatus);

  if (newStatus === 'published') {
    updateIssueField(id, 'published_date', new Date().toISOString());
  }

  // Build a direct link to this issue (useful for preview links)
  const baseUrl = ScriptApp.getService().getUrl();
  const issueUrl = baseUrl + '?action=issue&id=' + id;

  return { success: true, status: newStatus, issue_url: issueUrl };
}

function copyFromPreviousFromClient(params) {
  requireAuth();
  const targetId = Number(params.issue_id);
  const published = getPublishedIssues();
  if (published.length === 0) {
    throw new Error('No published issues to copy from.');
  }
  const source = published[0]; // most recently published
  const sourceSections = getSectionsForIssue(source.issue_id);

  // Copy sections to the target issue, preserving section_key and display_order
  const copied = sourceSections.map(s => Object.assign({}, s, { issue_id: targetId }));
  saveSectionsForIssue(targetId, copied);

  return { success: true, copied_from_id: source.issue_id, copied_from_title: source.title };
}

function deleteIssueFromClient(params) {
  requireAuth();
  const id = Number(params.issue_id);
  const issue = getIssueById(id);
  if (!issue) throw new Error('Issue not found: ' + id);
  if (issue.status === 'published') {
    throw new Error('Cannot delete a published issue. Unpublish it first.');
  }
  deleteIssue(id);
  return { success: true };
}

function uploadImageFromClient(params) {
  requireAuth();
  if (!params.image_data) throw new Error('No image data received.');
  const url = uploadImageToDrive(
    params.file_name  || 'upload.jpg',
    params.mime_type  || 'image/jpeg',
    params.image_data
  );
  return { success: true, url: url };
}