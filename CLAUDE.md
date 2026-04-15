# Prestonfield HOA Newsletter — Claude Code Instructions

## Pre-Edit Protocol

**Before making any changes, always:**
1. Read the relevant local file(s) in full before editing
2. Check both the local `apps-script/` file AND consider whether changes also affect `docs/` files (or vice versa)
3. Never edit blind — always confirm current file contents first

---

## Project Architecture

This is a three-layer system. Understanding which layer is affected by any change is critical:

| Layer | Technology | Purpose |
|---|---|---|
| Public site | GitHub Pages (`docs/` folder) | Newsletter, archive, feedback pages |
| Admin tool | Google Apps Script | Publisher UI + JSON API |
| Data store | Google Sheets + Google Drive | Issues, sections, config, feedback, images |

### How they connect
- `docs/newsletter.js` fetches live content from the Apps Script JSON API via `fetch()`
- The Apps Script URL is hardcoded in `docs/newsletter.js` as `APPS_SCRIPT_URL` and repeated in `docs/feedback.html` as `FEEDBACK_URL`
- Images are uploaded to Google Drive via Apps Script and stored as thumbnail URLs in Google Sheets

---

## Key Constants

```
Spreadsheet ID:       1bG8vR6MHzSpIyi-Ak2iLFYX8PXfsUX-fU6qI--nP6n4
Apps Script URL:      https://script.google.com/macros/s/AKfycbzLg7jgUUmSfTKvgO4Z1_jQyxT2EU-e89UGVIO4dN6-r5stqPH_-KMg85PU1rJRN8bv/exec
GitHub repo:          https://github.com/hanleymk/prestonfield-newsletter
Public site:          https://prestonfield.org
GA Measurement ID:    G-YLPQ2HLBV7
reCAPTCHA site key:   6LcRs6YsAAAAAAs4URIODwn7Crw3w6cY2-kjR84-
```

---

## File Map

### GitHub Pages (`docs/`) — deployed via git push
```
docs/index.html        — Newsletter page shell
docs/archive.html      — Past issues page shell
docs/feedback.html     — Homeowner feedback form
docs/newsletter.css    — All styles (screen + print + mobile)
docs/newsletter.js     — All client-side rendering + API fetch logic
docs/assets/banner.jpg — Masthead banner photo
```

### Apps Script — deployed by user manually copy-pasting into Apps Script editor
```
apps-script/Auth.gs          — Auth helpers, SPREADSHEET_ID constant
apps-script/Data.gs          — All Sheets read/write + Drive image upload
apps-script/Api.gs           — Public JSON API response builders
apps-script/Admin.gs         — Server functions called via google.script.run
apps-script/Feedback.gs      — Feedback form handling (verify reCAPTCHA, save, email)
apps-script/Code.gs          — doGet/doPost router, serveAdmin()
apps-script/Publisher.html   — Admin UI HTML shell
apps-script/PublisherCSS.html — Admin UI styles
apps-script/PublisherJS.html — Admin UI client-side logic
apps-script/appsscript.json  — Apps Script manifest
```

---

## Deployment Workflows

### GitHub Pages changes (docs/ files)
```
git add <files>
git commit -m "description"
git push
```
Site updates within ~60 seconds. No other steps needed.

### Apps Script changes (.gs and .html files)
1. Edit the local file in `apps-script/`
2. Commit and push to git (keeps local repo in sync)
3. **User manually copies** the updated file content into the Apps Script web editor
4. **User deploys a new version**: Deploy → Manage deployments → Edit → New version → Deploy
5. The deployed URL never changes — no need to update constants anywhere

---

## Critical Constraints

### No clasp CLI
The clasp CLI tool is not available in this environment (PATH issues on Windows). All Apps Script files are written locally and copy-pasted manually into the Apps Script web editor. Never suggest clasp-based workflows.

### Apps Script file naming
File names in the Apps Script editor must match exactly (without the `.gs` extension for script files, without `.html` for HTML files). The mapping is 1:1 with the local `apps-script/` filenames.

### Two deployment targets, one change
Some features touch both layers. For example:
- Adding a new section type requires changes to `Data.gs` (Apps Script) AND `newsletter.js` (GitHub Pages)
- Always identify ALL affected files before starting implementation

---

## Google Sheets Structure

| Sheet | Columns |
|---|---|
| Config | key, value (key/value store for HOA settings) |
| Issues | issue_id, title, season_label, status, created_date, published_date |
| Sections | issue_id, section_key, title, body, image_url, image_position, display_order, enabled |
| BoardMembers | year, name, role, display_order |
| Feedback | timestamp, name, email, message |

### Section keys per issue
`main_message`, `meeting_dates`, `article_1`–`article_5`, `sidebar_note`

- `main_message` and `meeting_dates` are always enabled (required)
- `article_1`–`article_5` and `sidebar_note` are optional (enable toggle in admin)
- `meeting_dates` and `sidebar_note` render in the sidebar; all others render in main content

### Config sheet keys
`hoa_name`, `authorized_users`, `mgmt_company_name`, `mgmt_company_phone`,
`mgmt_company_email`, `mgmt_company_website`, `mgmt_company_contact_name`,
`mgmt_company_contact_email`, `utilities_*`, `vendor_*`, `public_site_url`,
`recaptcha_secret_key`

---

## Admin Publisher Workflow

Issue lifecycle: **draft → preview → published**

- **Preview**: opens `public_site_url/?issue=N` in a new tab (status visible to anyone with the link)
- **Publish**: makes the issue the current published issue shown at prestonfield.org
- **Unpublish**: reverts to draft (required before deleting a published issue)
- **Delete**: only available for draft/preview issues

---

## Commit Message Style

```
type: short description

- Bullet detail if needed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`

---

## Known Constraints & Past Decisions

- **Image URLs**: Use `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1200` format (not `uc?export=view` which is unreliable for embedding)
- **HTML in section body**: Supported — `bodyToHtml()` passes HTML through if detected, otherwise converts newlines to `<p>` tags. This applies to main content AND sidebar boxes.
- **CORS**: Feedback form uses `application/x-www-form-urlencoded` (simple request, no preflight) to POST to Apps Script
- **reCAPTCHA domains registered**: `hanleymk.github.io` and `prestonfield.org`
- **Mobile breakpoint**: `≤600px` switches to single-column layout (sidebar on top, main content below)
- **Print layout**: Always preserves two-column format regardless of screen size
