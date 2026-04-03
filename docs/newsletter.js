// ════════════════════════════════════════════════════════════════════════════
// newsletter.js  —  Prestonfield HOA Newsletter
// Fetches data from the Apps Script API and renders the newsletter.
// ════════════════════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLg7jgUUmSfTKvgO4Z1_jQyxT2EU-e89UGVIO4dN6-r5stqPH_-KMg85PU1rJRN8bv/exec';

// ─── Routing ─────────────────────────────────────────────────────────────────

(function init() {
  const isArchivePage = document.getElementById('archive-root') !== null;
  if (isArchivePage) {
    loadArchive();
  } else {
    const params = new URLSearchParams(window.location.search);
    const issueId = params.get('issue');
    loadNewsletter(issueId || null);
  }
})();

// ─── Data fetching ────────────────────────────────────────────────────────────

async function apiFetch(params) {
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params).toString();
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error('Network error: ' + resp.status);
  return resp.json();
}

async function loadNewsletter(issueId) {
  try {
    const params = issueId
      ? { action: 'issue', id: issueId }
      : { action: 'current' };
    const data = await apiFetch(params);
    renderNewsletter(data);
  } catch (err) {
    showError('Could not load newsletter. Please try again later.<br><small>' + err.message + '</small>');
  }
}

async function loadArchive() {
  try {
    const data = await apiFetch({ action: 'archive' });
    renderArchive(data);
  } catch (err) {
    showError('Could not load archive. Please try again later.<br><small>' + err.message + '</small>');
  }
}

// ─── Newsletter rendering ─────────────────────────────────────────────────────

function renderNewsletter(data) {
  const loading   = document.getElementById('loading-state');
  const container = document.getElementById('newsletter-container');

  loading.style.display = 'none';

  if (data.status === 'no_issues' || data.status === 'not_found') {
    container.style.display = 'block';
    container.innerHTML = '<div class="no-issues-message">Newsletter coming soon — check back later.</div>';
    return;
  }

  const { issue, sections, config, board_members } = data;

  document.title = (config.hoa_name || 'HOA') + ' Newsletter — ' + (issue.season_label || issue.title);

  container.style.display = 'block';
  container.innerHTML = buildNewsletterHTML(issue, sections, config, board_members || []);
}

function buildNewsletterHTML(issue, sections, config, boardMembers) {
  return [
    '<div class="newsletter-page">',
      buildMasthead(issue),
      '<div class="newsletter-body">',
        buildSidebar(config, boardMembers, sections),
        buildMainContent(sections),
      '</div>',
      buildFooter(issue, config),
    '</div>'
  ].join('');
}

// ─── Masthead ─────────────────────────────────────────────────────────────────

function buildMasthead(issue) {
  const dateLabel = esc(issue.season_label || issue.title || '');
  return '<div class="masthead">' +
    '<img class="masthead-banner" src="assets/banner.jpg" alt="Prestonfield HOA">' +
    (dateLabel ? '<div class="masthead-date">' + dateLabel + '</div>' : '') +
    '</div>';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function buildSidebar(config, boardMembers, sections) {
  return '<aside class="newsletter-sidebar">' +
    buildBoardSection(boardMembers) +
    buildMgmtBox(config) +
    buildMeetingDatesBox(sections) +
    buildSidebarNote(sections) +
    buildUtilitiesBox(config) +
    buildVendorBox(config) +
    '</aside>';
}

function buildSidebarNote(sections) {
  const section = (sections || []).find(function(s) { return s.section_key === 'sidebar_note'; });
  if (!section || !section.enabled || !section.body) return '';
  const title = section.title || '';
  const bodyHtml = bodyToHtml(section.body);
  return '<div class="sidebar-section"><div class="sidebar-box">' +
    (title ? '<strong>' + esc(title) + '</strong><br>' : '') +
    '<div style="margin-top:' + (title ? '5' : '0') + 'px">' + bodyHtml + '</div>' +
    '</div></div>';
}

function buildBoardSection(boardMembers) {
  if (!boardMembers || boardMembers.length === 0) return '';
  const year = boardMembers[0] ? boardMembers[0].year : new Date().getFullYear();
  const rows = boardMembers.map(function(m) {
    return '<div class="board-member">' +
      '<span class="board-member-name">' + esc(m.name) + '</span>' +
      '<span class="board-member-role">' + esc(m.role) + '</span>' +
      '</div>';
  }).join('');
  return '<div class="sidebar-section">' +
    '<h3 class="sidebar-heading">Your ' + esc(String(year)) + ' Board</h3>' +
    rows + '</div>';
}

function buildMgmtBox(config) {
  const name         = config['mgmt_company_name'];
  const phone        = config['mgmt_company_phone'];
  const email        = config['mgmt_company_email'];
  const website      = config['mgmt_company_website'];
  const contactName  = config['mgmt_company_contact_name'];
  const contactEmail = config['mgmt_company_contact_email'];
  if (!name && !phone && !email && !website && !contactName) return '';

  let html = '<div class="sidebar-section"><h3 class="sidebar-heading">Management Company</h3>';

  // Company-level info
  html += '<div class="board-member"><span class="board-member-name">' + esc(name || '') + '</span></div>';
  if (website) {
    html += '<div class="board-member"><span class="board-member-role">' +
      '<a href="' + esc(website) + '" target="_blank">' + esc(website.replace(/^https?:\/\//, '')) + '</a>' +
      '</span></div>';
  }
  if (phone) {
    html += '<div class="board-member"><span class="board-member-role">' + esc(phone) + '</span></div>';
  }
  if (email) {
    html += '<div class="board-member"><span class="board-member-role">' +
      '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' +
      '</span></div>';
  }

  // Individual contact person
  if (contactName || contactEmail) {
    html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0">';
    if (contactName) {
      html += '<div class="board-member"><span class="board-member-name">' + esc(contactName) + '</span>' +
        '<span class="board-member-role">Contact</span></div>';
    }
    if (contactEmail) {
      html += '<div class="board-member"><span class="board-member-role">' +
        '<a href="mailto:' + esc(contactEmail) + '">' + esc(contactEmail) + '</a>' +
        '</span></div>';
    }
    html += '</div>';
  }

  return html + '</div>';
}

function buildMeetingDatesBox(sections) {
  const section = (sections || []).find(function(s){ return s.section_key === 'meeting_dates'; });
  if (!section || !section.enabled || !section.body) return '';
  const title = section.title || 'Board Meeting Dates';
  const bodyHtml = bodyToHtml(section.body);
  return '<div class="sidebar-section"><div class="sidebar-box">' +
    '<strong>' + esc(title) + '</strong><br>' +
    '<div style="margin-top:5px">' + bodyHtml + '</div>' +
    '</div></div>';
}

function buildUtilitiesBox(config) {
  const utilities = [];
  for (let i = 1; i <= 5; i++) {
    const label = config['utility_' + i + '_label'];
    const phone = config['utility_' + i + '_phone'];
    if (label || phone) utilities.push({ label: label || '', phone: phone || '' });
  }
  if (utilities.length === 0) return '';
  const items = utilities.map(function(u) {
    return '<li><span class="util-label">' + esc(u.label) + '</span>' +
           '<span class="util-phone">' + esc(u.phone) + '</span></li>';
  }).join('');
  return '<div class="sidebar-section"><div class="sidebar-box">' +
    '<strong>Phone Numbers You Should Know</strong>' +
    '<ul class="utility-list">' + items + '</ul></div></div>';
}

function buildVendorBox(config) {
  const name   = config['vendor_name'];
  const detail = config['vendor_detail'];
  if (!name && !detail) return '';
  return '<div class="sidebar-section"><div class="sidebar-box">' +
    (name   ? '<strong>' + esc(name)   + '</strong><br>' : '') +
    (detail ? esc(detail).replace(/\n/g, '<br>') : '') +
    '</div></div>';
}

// ─── Main content ─────────────────────────────────────────────────────────────

function buildMainContent(sections) {
  const mainMessage = (sections || []).find(function(s){ return s.section_key === 'main_message'; });
  const articles    = (sections || []).filter(function(s){
    return s.section_key !== 'main_message' && s.section_key !== 'meeting_dates' && s.enabled;
  });

  let html = '<main class="newsletter-main">';
  if (mainMessage && mainMessage.enabled) html += buildSection(mainMessage);
  articles.forEach(function(s){ html += buildSection(s); });
  html += '</main>';
  return html;
}

function buildSection(section) {
  const titleHtml = section.title
    ? '<h2 class="section-heading">' + esc(section.title) + '</h2>'
    : '';
  const imageHtml = buildImageBlock(section);
  const bodyHtml  = bodyToHtml(section.body);

  return '<div class="newsletter-section">' +
    titleHtml +
    '<div class="section-body">' + imageHtml + bodyHtml + '</div>' +
    '</div>';
}

function buildImageBlock(section) {
  if (!section.image_url) return '';
  const pos     = section.image_position === 'left' ? 'left' : 'right';
  const caption = section.image_caption
    ? '<p class="image-caption">' + esc(section.image_caption) + '</p>'
    : '';
  return '<div class="section-image-' + pos + '">' +
    '<img src="' + esc(section.image_url) + '" alt="' + esc(section.image_caption || '') + '" ' +
    'onerror="this.style.display=\'none\'">' +
    caption + '</div>';
}

function bodyToHtml(text) {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text.split(/\n{2,}/)
    .filter(function(p){ return p.trim().length > 0; })
    .map(function(p){ return '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>'; })
    .join('');
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function buildFooter(issue, config) {
  const hoaName = esc(config['hoa_name'] || 'HOA');
  const label   = esc(issue.season_label || issue.title || '');
  return '<footer class="newsletter-footer">' +
    '<span>' + hoaName + (label ? ' &middot; ' + label : '') + '</span>' +
    '<span>' +
      '<button class="footer-print-btn" onclick="window.print()">🖨 Print / Save PDF</button>' +
    '</span>' +
    '<a class="footer-archive-link" href="archive.html">View past issues &rarr;</a>' +
    '</footer>';
}

// ─── Archive rendering ────────────────────────────────────────────────────────

function renderArchive(data) {
  const loading   = document.getElementById('loading-state');
  const container = document.getElementById('archive-container');
  loading.style.display = 'none';
  container.style.display = 'block';

  if (data.status !== 'ok' || !data.archive || data.archive.length === 0) {
    container.innerHTML = '<div class="archive-page">' +
      '<h1>Past Issues</h1>' +
      '<a class="archive-back-link" href="index.html">&larr; Current Issue</a>' +
      '<p class="archive-empty">No past issues yet.</p></div>';
    return;
  }

  const yearSections = data.archive.map(function(group) {
    const links = group.issues.map(function(issue) {
      const dateStr = issue.published_date
        ? new Date(issue.published_date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
        : '';
      return '<a class="archive-issue-link" href="index.html?issue=' + issue.issue_id + '">' +
        '<span>' + esc(issue.season_label || issue.title) + '</span>' +
        '<span class="archive-issue-date">' + dateStr + '</span>' +
        '</a>';
    }).join('');
    return '<div class="archive-year">' +
      '<h2 class="archive-year-heading">' + group.year + '</h2>' +
      links + '</div>';
  }).join('');

  container.innerHTML = '<div class="archive-page">' +
    '<h1>Past Issues</h1>' +
    '<a class="archive-back-link" href="index.html">&larr; Current Issue</a>' +
    yearSections + '</div>';
}

// ─── Error state ─────────────────────────────────────────────────────────────

function showError(msg) {
  const loading = document.getElementById('loading-state');
  const error   = document.getElementById('error-state');
  if (loading) loading.style.display = 'none';
  if (error)   { error.style.display = 'block'; error.innerHTML = msg; }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
