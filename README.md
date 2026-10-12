# Kaijuclub

Automotive portfolio for drift, stance, track and street culture. Built with Vite and vanilla JavaScript, with locally bundled fonts and automotive reference photography. The design uses a late-90s automotive zine direction: near-black, bone white, racing red, chrome Racing Sans One lettering, IBM Plex Mono labels, a framed R34 hero and a contact-sheet garage. The requested references are Nightride and Revved; their current websites could not be inspected because network access was blocked.

## Development

Node.js 24 was used for validation.

```sh
npm --cache /tmp/kaiju-npm ci --no-audit --no-fund
npm --cache /tmp/kaiju-npm run dev -- --port 5173
```

## Production

```sh
npm --cache /tmp/kaiju-npm run build
npm --cache /tmp/kaiju-npm run preview
```

Deploy the generated `dist` directory to a static host. The website is published at https://alldaydigital.github.io/Kaijuclub_kc/ using the GitHub Pages workflow.

## Actual club cars

The four entries in `src/main.js` are explicitly labeled reference examples. Replace them with confirmed club vehicle names, stories, categories and photos. The photographs are stock references, not photos of Kaijuclub vehicles. Photo provenance and photographer credits are recorded in `public/images/PHOTO-SOURCES.md`. The Instagram destination is `https://www.instagram.com/kaijuclub_kc/`; Instagram access was blocked in the build environment. No horsepower, owner names, event dates or membership facts were invented.

## Verification

Production build passed; the development server returned HTTP 200. Chromium browser checks passed for both the dev site and standalone HTML: all four filters, reset, dialog open/close, Escape, restored focus, loaded images and no horizontal overflow at 320, 375, 701, 768 and 1440px. Production and exported offline builds also passed the same functional checks plus mobile-menu navigation and Escape dismissal. The browser was obtained through the npm registry using @sparticuz/chromium in a temporary directory after the standard Playwright download was blocked.

## Open without a server

Run `python scripts/export-preview.py` after installing dependencies. Download the generated `dist/kaijuclub-preview.html` and open it in a browser. It includes local fonts, illustrations and interactions; no development server or internet connection is needed to view it. Instagram links still require internet. This is a preview artifact, not an online deployment.

## GitHub Pages

`.github/workflows/deploy-pages.yml` installs the locked dependencies, builds with the `/Kaijuclub_kc/` site path and publishes using GitHub Actions on pushes to `main`.

GitHub Pages is enabled with **Settings → Pages → Build and deployment → Source: GitHub Actions**. A successful workflow returns the actual public URL. Do not describe the site as live until the Pages deployment and an external request succeed.

To automate enabling Pages, the GitHub API must be reachable and the connected GitHub identity must have the required repository permissions. Native Git access alone does not establish that access.
