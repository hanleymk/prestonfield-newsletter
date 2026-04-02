// ════════════════════════════════════════════════════════════════════════════
// Code.gs  —  Main entry point. Routes all HTTP GET requests.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Routes:
 *   ?mode=admin          → Admin publisher UI (Google auth required)
 *   ?action=current      → JSON: current published issue
 *   ?action=issue&id=N   → JSON: specific issue by ID
 *   ?action=archive      → JSON: all published issues grouped by year
 *   (no params)          → JSON: API info message
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  try {
    if (params.mode === 'admin')       return serveAdmin();
    if (params.action === 'current')   return buildCurrentIssueResponse();
    if (params.action === 'issue')     return buildIssueResponse(params.id);
    if (params.action === 'archive')   return buildArchiveResponse();
    return jsonResponse({ status: 'ok', message: 'Prestonfield HOA Newsletter API' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ─── Admin page ──────────────────────────────────────────────────────────────

function serveAdmin() {
  if (!isAuthorized()) {
    const email = getCurrentUserEmail();
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body ' +
      'style="font-family:Arial,sans-serif;padding:48px;max-width:520px">' +
      '<h2 style="color:#b00">Access Denied</h2>' +
      '<p>Your Google account' +
      (email ? ' (<strong>' + escapeHtml(email) + '</strong>)' : '') +
      ' is not authorized to use the publisher.</p>' +
      '<p>Ask the HOA admin to add your email to the <em>authorized_users</em> ' +
      'row in the Config sheet.</p></body></html>'
    ).setTitle('Access Denied');
  }

  const tmpl = HtmlService.createTemplateFromFile('Publisher');
  tmpl.issuesJson = JSON.stringify(getAllIssues().slice().reverse());
  tmpl.configJson = JSON.stringify(getConfig());
  return tmpl.evaluate()
    .setTitle('Prestonfield HOA — Newsletter Publisher')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Loads and returns the raw HTML content of an .html file in this project. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Escapes HTML special characters. */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function testDoGetRouter() {
  // Simulate ?action=current
  const currentResp = doGet({ parameter: { action: 'current' } });
  const current = JSON.parse(currentResp.getContent());
  if (current.status !== 'ok' && current.status !== 'no_issues') {
    throw new Error('?action=current returned unexpected status: ' + current.status);
  }

  // Simulate ?action=archive
  const archiveResp = doGet({ parameter: { action: 'archive' } });
  const archive = JSON.parse(archiveResp.getContent());
  if (archive.status !== 'ok') throw new Error('?action=archive returned: ' + archive.status);

  // Simulate unknown action — should return api info
  const unknownResp = doGet({ parameter: { action: 'unknown' } });
  const unknown = JSON.parse(unknownResp.getContent());
  if (unknown.status !== 'ok') throw new Error('unknown action should return api info, got: ' + unknown.status);

  Logger.log('✓ doGet router passed');
}
