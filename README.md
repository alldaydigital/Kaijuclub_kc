# Kaijuclub

Automotive portfolio for drift, stance, track and street. A 90s Japanese automotive direction with a restrained navigation wordmark and a wide club photograph, condensed editorial typography, bone-white sections, racing-red accents, and locally bundled fonts. Visitors explore car dossiers, story tabs and visual essays on-site; Instagram is only in the footer.

Live: https://alldaydigital.github.io/Kaijuclub_kc/

Management: https://alldaydigital.github.io/Kaijuclub_kc/beheer/ — [Dutch instructions](WAGENBEHEER.md)

The requested references are Nightride, Revved and Ultrace. Revved's current public markup could be inspected; Nightride and Ultrace could not be inspected successfully. Stock example cars remain clearly disclosed and credited in [PHOTO-SOURCES.md](public/images/PHOTO-SOURCES.md); no club cars, owners, specifications or events were invented.

## Development

Node.js 24 and Python 3.12+ are used in CI.

```sh
npm --cache /tmp/kaiju-npm ci --no-audit --no-fund
python3 -m venv .cms-venv
.cms-venv/bin/python -m pip install --cache-dir /tmp/kaiju-pip --requirement scripts/cms-requirements.txt
npm --cache /tmp/kaiju-npm run dev -- --host 0.0.0.0 --port 5173
```

## Validation and production

```sh
.cms-venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.cms-venv/bin/python scripts/validate_collection.py
.cms-venv/bin/python scripts/validate_partners.py
node --test tests/*.mjs
npm --cache /tmp/kaiju-npm run build -- --base=/Kaijuclub_kc/
npm --cache /tmp/kaiju-npm run preview -- --base=/Kaijuclub_kc/ --host 0.0.0.0 --port 4175 --strictPort
```

Vite builds the public site, `/partners/`, `/beheer/` and `/beheer/partners/`. `deploy-pages.yml` validates actual catalog/media bytes, runs Python and Node suites, builds and publishes pushes to main. Both desktop and mobile management previews use a nonce-bound same-origin iframe of the production site, not a separate imitation of its design. Credentials are never transferred to the preview.

## On-site vehicle management

`src/admin.js` provides drag/drop and file selection, automatic WebP preparation at up to 2400 pixels, ordered galleries, cover crops, story and specification fields, collection filters, exact responsive previews, cloud concepts and publish/archive controls.

The connection accepts a user-created fine-grained GitHub key for this repository with Contents read/write, or a classic public_repo PAT when GitHub’s external-collaborator limitations apply. Fine-grained keys are preferred where available. `admin-api.js` verifies actual write scope, loads an immutable repository snapshot and uses the Git Data API to upload blobs, create one tree and commit, then update main with `force: false`. Stale snapshots and ref races fail without discarding local edits. New photos, management data and the public catalog belong to one atomic commit. No execution-environment token is embedded or delivered to a browser.

The optional remembered connection uses AES-GCM and PBKDF2-SHA256 (310,000 iterations, random salt and IV), protected by the user's local password. Plaintext credentials exist only in the unlocked editor's memory. The management page has a restrictive CSP, refuses framing, and offers explicit/idle locking. Unsaved fields and prepared photos have an IndexedDB recovery copy; this is an emergency local backup, not a substitute for cloud saves.

`cms/catalog.json` stores editable fields separately from immutable published snapshots. Originals prepared for web are stored under `cms/media/<id>/<sha256>.<ext>`. Published photos reference the same Git blobs under `public/images/vehicles/`, and `public/data/vehicles.json` projects only unarchived published snapshots. Saving a concept preserves live content and car ordering. First drafts keep the reference site intact; after the first real publication, an empty collection never restores examples. Existing media is retained to avoid destructive cleanup.

This is a public repository: saved concepts and media remain publicly readable on GitHub even though only published cars appear on Pages. A remembered login is specific to a browser/device and expires with its GitHub key. There is no central password server or cross-device session provider on static Pages.

The previous Issue Form workflow is manual-only and refuses to replace a populated on-site catalog. Its parser/security tests remain as regression coverage; the public issue template routes users to `/beheer/`.

## Standalone portfolio preview

```sh
python3 scripts/export-preview.py
```

`dist/kaijuclub-preview.html` embeds the public catalog, photography and fonts for offline review. It does not export the authenticated management app. Avoid presenting localhost URLs as public previews.

GitHub Pages uses **Settings → Pages → Build and deployment → Source: GitHub Actions**. Confirm the matching commit's successful workflow and live HTTPS bytes before calling a deployment live.

## Events and partnerships

Event and partnership forms submit through FormSubmit AJAX to `kaijuclub.be@gmail.com`. The first use requires mailbox activation; delivery remains unverified until the club activates and receives a real test request. Browser checks mock the external provider and verify validation, confirmed acceptance and retained inputs on failure; they do not demonstrate mailbox delivery. Visitor data is never committed to the public repository.

Partners can be managed at `/beheer/partners/` using the same encrypted connection or scoped user key as vehicle management. The preview shares the exact partner-card renderer and CSS. Optimized raster logos are stored as data URLs with transparency retained. `cms/partners.json` contains editable fields and immutable published snapshots; `public/data/partners.json` contains only live partners. Both are committed atomically with optimistic Git ref checks. No sponsor relationships have been invented. `scripts/validate_partners.py` validates actual decoded logo bytes and the immutable public projection before deployment. The chosen club header remains independent of the garage collection.

Connection diagnostics distinguish invalid/expired keys, repository selection, actual write permissions, SSO, rate limits, timeout, unreadable responses and blocked requests. A tokenless public reachability probe never retries an uncertain write. Both management pages offer a reachability check and direct-browser link. Repository `permissions` metadata is optional; actual Git blob creation verifies write scope without changing a branch. Optional remembered-login storage failure keeps the working session; partner login resumes the pending save action.
