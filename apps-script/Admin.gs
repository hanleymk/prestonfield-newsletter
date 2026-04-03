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

  // Backfill any sections added after this issue was originally created
  const sectionDefaults = {
    sidebar_note: { title: '', body: '', image_url: '', image_position: '', display_order: 7, enabled: false }
  };
  const existing = getSectionsForIssue(params.issue_id).map(s => s.section_key);
  Object.keys(sectionDefaults).forEach(function(key) {
    if (!existing.includes(key)) {
      const d = sectionDefaults[key];
      getSheet('Sections').appendRow([
        Number(params.issue_id), key, d.title, d.body, d.image_url, d.image_position, d.display_order, d.enabled
      ]);
    }
  });

  return {
    issue:    issue,
    sections: getSectionsForIssue(params.issue_id)
  };
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