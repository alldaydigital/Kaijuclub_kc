# Kaijuclub

Automotive portfolio for drift, stance, track and street. A 90s Japanese automotive direction with a restrained wordmark, wide club photography, condensed typography, bone-white sections and racing-red accents. Visitors explore car dossiers, club stories and visual essays on the website; Instagram appears in the footer.

| Page | Address |
| --- | --- |
| Website | https://alldaydigital.github.io/Kaijuclub_kc/ |
| Events & photo portfolio | https://alldaydigital.github.io/Kaijuclub_kc/events/ |
| Attendance agenda | https://alldaydigital.github.io/Kaijuclub_kc/agenda/ |
| Agenda editor | https://alldaydigital.github.io/Kaijuclub_kc/beheer/agenda/ |
| Events editor | https://alldaydigital.github.io/Kaijuclub_kc/beheer/events/ |
| Partners | https://alldaydigital.github.io/Kaijuclub_kc/partners/ |
| Website editor | https://alldaydigital.github.io/Kaijuclub_kc/beheer/website/ |
| Vehicle editor | https://alldaydigital.github.io/Kaijuclub_kc/beheer/ |
| Partner editor | https://alldaydigital.github.io/Kaijuclub_kc/beheer/partners/ |

[Dutch editing instructions](WAGENBEHEER.md). Stock reference cars remain disclosed and credited in [PHOTO-SOURCES.md](public/images/PHOTO-SOURCES.md); no club cars, owners, specifications or sponsorships have been invented.

## Development and validation

Node.js 24 and Python 3.12+ are used in CI.

```sh
npm --cache /tmp/kaiju-npm ci --no-audit --no-fund
python3 -m venv .cms-venv
.cms-venv/bin/python -m pip install --cache-dir /tmp/kaiju-pip --requirement scripts/cms-requirements.txt
npm --cache /tmp/kaiju-npm run dev -- --host 0.0.0.0 --port 5173
```

```sh
.cms-venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
.cms-venv/bin/python scripts/validate_collection.py
.cms-venv/bin/python scripts/validate_partners.py
.cms-venv/bin/python scripts/validate_site.py
.cms-venv/bin/python scripts/validate_events.py
.cms-venv/bin/python scripts/validate_agenda.py
node --test tests/*.mjs
npm --cache /tmp/kaiju-npm run build -- --base=/Kaijuclub_kc/
npm --cache /tmp/kaiju-npm run preview -- --base=/Kaijuclub_kc/ --host 0.0.0.0 --port 4175 --strictPort
```

Vite builds all nine routes. The deployment workflow validates saved content, actual image bytes and immutable public projections, runs the Python and Node suites, builds, then publishes main to GitHub Pages. Pages must use **Settings → Pages → Build and deployment → Source: GitHub Actions**. Confirm the matching commit's successful workflow and live HTTPS bytes before reporting a deployment as live.

## Website content management

`/beheer/website/` edits the homepage, partner-page copy, navigation, footer, contact settings, journal essays and search metadata. Text, buttons, links, photographs, desktop/mobile crops, theme colors and heading styles have labeled controls. The searchable section list and click-to-select website preview open the relevant fields. Homepage sections can be reordered or hidden; the header stays first. Vehicles and partner records remain in their dedicated editors.

Both preview devices use the actual public website in a same-origin iframe. Preview messages are bound to the frame, origin and random nonce; no credentials are transferred. Preview forms cannot send requests. Edits update the preview immediately. A local recovery copy protects unsaved fields; **Bewaar concept** stores them in GitHub without changing the live website. **Publiceer website** creates a new published snapshot. Previous published snapshots can be restored into a draft before republishing. The manager retains up to five previous publications.

`src/site-schema.json` defines the allowed fields and defaults. `src/site-model.js` validates types, links, image metadata and section order. `src/site-content.js` applies published content and handles preview messages. `src/site-render.js` also hydrates public HTML at build time so headings, descriptions and initial content match the published version before JavaScript runs.

`cms/site.json` stores the current editable draft, published snapshot and revision history. `public/data/site.json` contains only the published projection. Uploaded raster photographs are optimized in the browser, stored by SHA-256 under `cms/site-media/`, and made available under `public/images/site/` when published. The website save commits content, public projection and image references atomically, with optimistic ref checks and `force: false`; conflicts preserve local edits. Historical media remains available. `scripts/validate_site.py` checks the saved structure, public projection and actual image data before deployment.

## Vehicle and partner management

`src/admin.js` supports ordered galleries, cover crops, stories, specifications, collection filters, responsive previews, cloud drafts and publish/hide controls. Vehicle photos are prepared as WebP at up to 2400 pixels. `cms/catalog.json` separates editable data from immutable live snapshots; `public/data/vehicles.json` projects only unarchived published cars. Prepared media is stored under `cms/media/` and published from the same Git blobs under `public/images/vehicles/`. Publishing the first real car replaces the reference collection. Hiding all cars does not restore examples, and garage changes do not replace the club header.

`/beheer/partners/` uses the same connection. Its preview shares the public partner-card renderer and CSS. Raster logos are optimized with transparency retained. `cms/partners.json` stores editable data and immutable published snapshots; `public/data/partners.json` contains only live partners. Both files are committed atomically. The previous Issue Form workflow is manual-only and refuses to replace a populated on-site catalog.

## GitHub connection and storage

All editors accept a user-created fine-grained personal access token with Contents read/write for this repository, or a classic `public_repo` PAT when GitHub's external-collaborator limitations apply. Fine-grained access is preferred where supported. `admin-api.js` checks repository access and actual Git blob write scope, loads an immutable repository snapshot, then saves with the Git Data API. No execution-environment credential is embedded or delivered to a browser.

The optional remembered connection uses AES-GCM and PBKDF2-SHA256 with 310,000 iterations, random salt and IV. Its password unlocks encrypted storage on that browser/device; plaintext credentials exist only in the unlocked editor's memory. Management pages use a restrictive CSP and no-referrer policy. Explicit locking and 30-minute idle locking clear the active connection.

Authenticated browser requests use `src/admin-transport.js` (XMLHttpRequest), with cookies disabled. GET requests have a non-secret cache nonce so conflict checks use a fresh ref; writes are sent once. Only the GitHub API destination is accepted. Diagnostics distinguish authentication, permissions, SSO, rate limits, blocked requests, unreadable responses and timeout, and identify the failed operation. The public reachability probe sends no token. Real API integration tests keep execution authentication in a server-side bridge; browser checks use synthetic keys. The user's own Edge session and personal token need to be confirmed on their device.

**This repository is public: saved drafts and uploaded media are publicly readable on GitHub, even before they appear on the visitors' website.** Hiding content does not remove it from GitHub history. The local recovery copy is an emergency backup, not a cloud save. There is no central password server or cross-device session provider on static Pages.

## Event and partnership requests

Forms submit through FormSubmit AJAX to the contact email configured in the website editor, initially `kaijuclub.be@gmail.com`. The first use of a recipient requires mailbox activation; delivery remains unverified until the club activates and receives a real test request. Changing the recipient requires activation of the new mailbox. Browser checks verify validation, provider acceptance and retained inputs on failure with mocked responses; they do not prove email delivery. Visitor requests are never committed to the public repository.

## Standalone portfolio preview

```sh
python3 scripts/export-preview.py
```

`dist/kaijuclub-preview.html` uses the production Vite build, published site content and catalog, and embeds photography and fonts for offline review. Forms are disabled and external requests are blocked. It does not export authenticated editors, the partner page or the Events archive. Open this file directly in a browser; use the live HTTPS addresses above when sharing the full website.

## Events and photo portfolio

`/events/` is the separate Events navigation page. Reports open on the site with a cover, date/location when provided, paragraphs, a responsive photograph portfolio and an accessible fullscreen lightbox. Photo arrows, keyboard navigation, Escape, focus restoration and deep links keep visitors inside the experience. The request CTA links to the existing organizer form on the homepage; it does not replace that form.

`/beheer/events/` supports multi-image upload (up to24 raster images,10MB each), automatic WebP preparation, cover selection, photo order, captions, alternative text, photo credits and desktop/mobile cover crop. Its iframe uses the actual public report renderer at1440/390 logical pixels, with expanded preview. Optional encrypted shared connection, local IndexedDB recovery, explicit/idle locking and safe GitHub transport match the existing CMS. Saving a draft preserves the immutable published report; publication/hiding atomically commits metadata/public projection/media with a fresh-ref check and force:false. New media stays in cms/event-media until publication. The public repository also exposes unpublished drafts/photos.

`cms/events.json` contains concepts and snapshots; `public/data/events.json` contains only published, visible reports sorted by date. `scripts/validate_events.py` verifies the projection and actual decoded photo bytes/dimensions/SHA256 before deployment. A first club gallery reuses the already-authorized club header and published vehicle photo, with no invented event name, date, location or attendance. The exact header remains a horizontal image_gen adaptation as documented in PHOTO-SOURCES.md. Replace/add galleries with real meet, show and circuit-day reports as material becomes available. Event-page copy, navigation and metadata are editable under Website → Events: pagina & portfolio. Existing locally recovered site concepts upgrade the new fields without discarding earlier copy.


## Attendance agenda

`/agenda/` lists the events where the club will attend, separately from the `/events/` photo portfolio. Entries show a date plaque, event type, confirmed/planned/cancelled attendance, venue/address, optional local Belgian hours, practical information and safe optional official-event/map links. Upcoming events are sorted by date and time; today and ongoing multi-day events stay upcoming through their last day. Older entries appear under Earlier events. The day follows Europe/Brussels and is checked on returning to the tab and every 30 seconds. No real future attendance is invented; the initial calendar is empty.

`/beheer/agenda/` needs only name, date and location to publish. It uses the shared GitHub connection/encrypted vault, actual public card renderer in guarded desktop/mobile/expanded iframes, browser draft recovery, explicit and idle locking, and deployment-status feedback. Draft/publish/hide atomically saves `cms/agenda.json` and `public/data/agenda.json` through the shared store's fresh-ref check and non-forced update. Editing a draft preserves the live snapshot. Concepts remain readable in the public repository. Optional end dates handle multi-day and overnight events; same-day end times must follow start times. `scripts/validate_agenda.py` verifies record shapes, dates/times, safe URLs and exact public snapshots in CI. Whole-page copy and Agenda navigation are editable in Website → Agenda & aanwezigheid. Existing local website concepts gain only the known calendar fields while keeping all earlier edits.


The homepage club story is one semantic text block and one club photograph, without tabs or hidden story panels. Website → Ons verhaal edits its full copy in `culture_text_10`, with title/image/crop/caption/signature controls. `upgradeSiteContent` merges legacy story paragraphs and customized headings into this one body for local recovery, removes only known retired fields and preserves custom titles/photos; published manager/history/public snapshots receive the same migration. The default story photograph reuses the already-published Nissan S13 club-car photo.
