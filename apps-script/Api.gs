// ════════════════════════════════════════════════════════════════════════════
// Api.gs  —  JSON API response builders for the public endpoints
// ════════════════════════════════════════════════════════════════════════════

// Keys that must never be sent to the public site.
const PUBLIC_CONFIG_DENY_LIST = ['recaptcha_secret_key', 'authorized_users'];

/**
 * Returns a copy of the Config object safe to expose in public API responses.
 * Strips server-side secrets and internal admin settings.
 */
function getPublicConfig() {
  const config = getConfig();
  PUBLIC_CONFIG_DENY_LIST.forEach(key => { delete config[key]; });
  return config;
}

/**
 * Wraps a plain JS object in a JSON ContentService response.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ?action=current
 * Returns the most recently published issue with its sections, config, and board members.
 * Returns { status: 'no_issues' } if nothing has been published yet.
 */
function buildCurrentIssueResponse() {
  const published = getPublishedIssues();
  if (published.length === 0) {
    return jsonResponse({ status: 'no_issues' });
  }
  const current = published[0];
  return jsonResponse({
    status: 'ok',
    issue:         current,
    sections:      getSectionsForIssue(current.issue_id),
    config:        getPublicConfig(),
    board_members: getBoardMembers()
  });
}

/**
 * ?action=issue&id=N
 * Returns a specific published issue. Also allows status='preview' so preview
 * links work before publishing.
 */
function buildIssueResponse(id) {
  const issue = getIssueById(id);
  if (!issue) return jsonResponse({ status: 'not_found' });
  if (issue.status !== 'published' && issue.status !== 'preview') {
    return jsonResponse({ status: 'not_found' });
  }
  return jsonResponse({
    status: 'ok',
    issue:         issue,
    sections:      getSectionsForIssue(issue.issue_id),
    config:        getPublicConfig(),
    board_members: getBoardMembers()
  });
}

/**
 * ?action=archive
 * Returns all published issues grouped by year, newest year first.
 * Only includes metadata (no body content) to keep the response small.
 */
function buildArchiveResponse() {
  const published = getPublishedIssues();
  const grouped = {};

  published.forEach(issue => {
    const dateStr = issue.published_date || issue.created_date;
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push({
      issue_id:       issue.issue_id,
      title:          issue.title,
      season_label:   issue.season_label,
      published_date: issue.published_date
    });
  });

  const years = Object.keys(grouped).map(Number).sort((a, b) => b - a);
  return jsonResponse({
    status: 'ok',
    archive: years.map(year => ({ year, issues: grouped[year] }))
  });
}

function testApiBuilders() {
  // Create and publish a test issue so the API has something to return
  const id = createIssue('API Test Issue', 'Spring 2026');
  const sections = getSectionsForIssue(id);
  sections[0].body = 'Hello from the API test.';
  saveSectionsForIssue(id, sections);
  updateIssueField(id, 'status', 'published');
  updateIssueField(id, 'published_date', new Date().toISOString());

  // Test ?action=current
  const current = JSON.parse(buildCurrentIssueResponse().getContent());
  if (current.status !== 'ok') throw new Error('current: status should be ok, got ' + current.status);
  if (!current.issue) throw new Error('current: missing issue');
  if (!current.sections) throw new Error('current: missing sections');
  if (!current.board_members) throw new Error('current: missing board_members');

  // Test ?action=issue&id=
  const byId = JSON.parse(buildIssueResponse(id).getContent());
  if (byId.status !== 'ok') throw new Error('byId: status should be ok');
  if (byId.issue.issue_id !== id) throw new Error('byId: wrong issue_id');

  // Test ?action=archive
  const archive = JSON.parse(buildArchiveResponse().getContent());
  if (archive.status !== 'ok') throw new Error('archive: status should be ok');
  if (!archive.archive || archive.archive.length === 0) throw new Error('archive: should have at least one year');

  Logger.log('✓ All API builders passed');
}
