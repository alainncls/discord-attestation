# SEO and Lighthouse Audit Report

Audit date: 2026-05-08
Production URL audited: https://discord.alainnicolas.fr/
Skill used: `.agents/skills/seo-audit`

## Executive Summary

The live site had strong basic Lighthouse SEO checks, but several important SEO, performance, and security issues were present outside Lighthouse's automated SEO score:

- `robots.txt` and `sitemap.xml` returned `404`.
- The page had no canonical URL and no rendered structured data.
- The public page depended entirely on client-side rendering and had very thin rendered content.
- Mobile performance was poor because the first page load eagerly downloaded wallet/AppKit chunks and Google Fonts.
- Hashed static assets were served with `max-age=0,must-revalidate`.
- OAuth codes and access tokens were sent to the Netlify function through query strings.
- Discord attestation signatures did not bind every stored attestation field, and the contract did not require the submitting wallet to match the attestation subject.

The local fixed build scored `100/100/100/100` on mobile and desktop Lighthouse, with the initial transfer reduced from about `1,444 KiB` to `71 KiB` in the local Lighthouse run.

Deployment status as of 2026-05-08 19:35 CEST: the fixes are deployed on `https://discord.alainnicolas.fr/`. Production now serves `robots.txt`, includes the canonical URL and JSON-LD, and no longer preloads wallet chunks before user intent.

## Lighthouse Baseline

Representative production Lighthouse run before changes:

| Mode    | Performance | Accessibility | Best Practices | SEO |   FCP |   LCP | Speed Index |   TBT |   CLS |  Transfer |
| ------- | ----------: | ------------: | -------------: | --: | ----: | ----: | ----------: | ----: | ----: | --------: |
| Mobile  |          58 |           100 |            100 | 100 | 7.5 s | 8.7 s |       7.5 s | 20 ms | 0.015 | 1,444 KiB |
| Desktop |          80 |           100 |            100 | 100 | 1.5 s | 2.0 s |       2.6 s |  0 ms | 0.006 | 1,443 KiB |

Local fixed build before deployment:

| Mode    | Performance | Accessibility | Best Practices | SEO |   FCP |   LCP | Speed Index |  TBT | CLS | Transfer |
| ------- | ----------: | ------------: | -------------: | --: | ----: | ----: | ----------: | ---: | --: | -------: |
| Mobile  |         100 |           100 |            100 | 100 | 1.2 s | 1.7 s |       1.2 s | 0 ms |   0 |   71 KiB |
| Desktop |         100 |           100 |            100 | 100 | 0.3 s | 0.4 s |       0.3 s | 0 ms |   0 |   71 KiB |

Production fixed build after deployment:

| Mode    | Performance | Accessibility | Best Practices | SEO |   FCP |   LCP | Speed Index |  TBT | CLS | Transfer |
| ------- | ----------: | ------------: | -------------: | --: | ----: | ----: | ----------: | ---: | --: | -------: |
| Mobile  |          97 |           100 |            100 | 100 | 1.3 s | 2.1 s |       3.8 s | 0 ms |   0 |   73 KiB |
| Desktop |         100 |           100 |            100 | 100 | 0.3 s | 0.4 s |       0.5 s | 0 ms |   0 |   73 KiB |

Residual Lighthouse observations after deployment:

- Mobile Speed Index is still the lowest remaining metric at `3.8 s`, but overall mobile Performance is now `97`.
- Lighthouse still reports about `29 KiB` of unused React runtime JavaScript on first paint. This is the remaining cost of a React-rendered app shell, not the previous wallet/AppKit payload.
- Lighthouse still lists the single `2.9 KiB` stylesheet as render-blocking. This is a small residual cost after removing Google Fonts and wallet preloads.

## Findings and Fixes

### 1. Missing `robots.txt` and XML sitemap

Impact: High
Evidence: `https://discord.alainnicolas.fr/robots.txt` and `https://discord.alainnicolas.fr/sitemap.xml` returned `404`.

Fix:

- Added `packages/frontend/public/robots.txt`.
- Added `packages/frontend/public/sitemap.xml`.

### 2. Missing canonical URL

Impact: Medium
Evidence: the rendered DOM had no `link[rel="canonical"]`, and social URLs used the no-slash URL variant.

Fix:

- Added canonical `https://discord.alainnicolas.fr/`.
- Aligned `og:url` and `twitter:url` to the canonical trailing-slash URL.

### 3. Missing structured data

Impact: Medium
Evidence: rendered DOM had zero `script[type="application/ld+json"]` elements.

Fix:

- Added `WebApplication` JSON-LD to `packages/frontend/index.html`.

### 4. Thin rendered content and JS-only initial content

Impact: High for organic ranking
Evidence: the initial production body only rendered the app title, login action, and footer after React loaded; static HTML contained only `<div id="root"></div>`.

Fix:

- Added a lightweight crawlable landing shell before wallet runtime loading.
- Added static root fallback copy in `index.html`.
- Added a focused H2 and concise copy about Discord membership attestations on Linea.

### 5. Poor mobile performance from eager wallet JavaScript

Impact: High
Evidence: mobile Lighthouse reported about `624 KiB` unused JavaScript. The main offenders were `wallet-ui`, `wallet-core`, and the main app chunk.

Fix:

- Moved the full wallet runtime behind a dynamic `AppRuntime` import.
- Rendered a lightweight public shell first.
- Loaded Reown/AppKit/Wagmi runtime only when the user clicks `Connect Wallet` or returns from OAuth.
- Split React into a separate vendor chunk so the initial public entry no longer imports wallet chunks.
- Disabled module preload and CSS code splitting to prevent Vite from eagerly pulling wallet chunks through preload helpers.

### 6. Render-blocking Google Fonts

Impact: Medium
Evidence: Lighthouse reported Google Fonts CSS as render-blocking, with about `1.3 s` estimated mobile savings.

Fix:

- Removed the Google Fonts CSS `@import`.
- Switched to system font stacks for sans and mono text.

### 7. Static assets not long-term cached

Impact: Medium
Evidence: hashed JS/CSS assets and static images were served with `cache-control: public,max-age=0,must-revalidate`.

Fix:

- Added Netlify headers for immutable `/assets/*`.
- Added long-lived cache headers for `/js/*`, `screenshot.png`, and `verax-logo-circle.svg`.
- Added baseline `X-Content-Type-Options` and `Referrer-Policy` headers.

### 8. AppKit third-party analytics initialized on first load

Impact: Low to Medium
Evidence: AppKit had `features.analytics: true`, and Lighthouse reported third-party wallet/cookie noise in one run.

Fix:

- Disabled AppKit analytics.
- Deferred AppKit initialization until wallet runtime load.

### 9. Missing source maps for large JavaScript

Impact: Low for SEO, useful for diagnostics
Evidence: Lighthouse flagged missing source maps for the large first-party chunks.

Fix:

- Enabled Vite production source maps. This repository is public, so public source maps are an acceptable diagnostic tradeoff.

### 10. OAuth code and token sent through query strings

Impact: High for privacy and logs
Evidence: the frontend sent `code` and `accessToken` to the Netlify function as query parameters.

Fix:

- Changed the frontend API call to `POST` with a JSON body.
- Added OAuth `state` generation and validation.
- Cleared `code` and `state` from the browser URL after exchange.
- Switched production API calls to same-origin `/.netlify/functions/api` instead of a hardcoded production URL.
- Stopped returning Discord access tokens to the browser.
- Removed stored-token session restoration and clear legacy client-side token keys.
- Restricted the function to `POST`/`OPTIONS`, added `Cache-Control: no-store`, and narrowed CORS to configured application origins.

### 11. Preview deployment metadata hardcoded to production

Impact: Medium for previews and alternate domains
Evidence: AppKit metadata used `https://discord.alainnicolas.fr` directly.

Fix:

- Added `VITE_PUBLIC_SITE_URL` support for AppKit metadata.
- Kept production canonical/social URLs intentionally canonicalized to the production domain.

### 12. Heading hierarchy issue after guilds render

Impact: Low to Medium
Evidence: the app title and guild count both used `h1` after login.

Fix:

- Kept `Discord Attestation` as the only app `h1`.
- Changed the guild count heading to `h2`.

### 13. Mobile guild row overflow risk

Impact: Medium for mobile UX
Evidence: long guild names could compete with fixed-width action buttons.

Fix:

- Added `min-width: 0`, `overflow-wrap: anywhere`, gaps, and a stacked mobile layout for guild rows.

### 14. Motion and notification semantics

Impact: Low to Medium for accessibility
Evidence: spinners, pending statuses, and toasts did not respect reduced-motion preferences; all toasts used `role="alert"`.

Fix:

- Added `prefers-reduced-motion` handling.
- Changed non-error toasts to `role="status"` and kept errors as `role="alert"`.

### 15. External attestation links opened without `noopener`

Impact: Low security hardening
Evidence: Verax explorer links used `window.open(url, '_blank')`.

Fix:

- Added `noopener,noreferrer` to the `window.open` call.

### 16. Attestation subject was not enforced by the contract

Impact: High
Evidence: the backend signed guild membership for a caller-provided `subject`, and `DiscordPortal._onAttest` verified the backend signature without checking that the transaction sender controlled that subject.

Fix:

- Added a `subject == msg.sender` check in `DiscordPortal._onAttest`.
- Added validation that exactly one backend signature is supplied.
- Added request-side subject and chain ID validation in the Netlify function.

### 17. Backend signatures did not bind all stored attestation fields

Impact: Medium
Evidence: the backend signed only Discord guild ID and subject, while the contract stored caller-supplied guild name and expiration date.

Fix:

- Expanded the EIP-712 payload to sign Discord guild ID, guild name, subject, and expiration date.
- Moved expiration generation to the backend signing response.
- Updated the frontend attestation submission to use the backend-signed expiration date.

## Validation

Completed locally:

- `pnpm --filter @discord-attestation/frontend typecheck`
- `pnpm --filter @discord-attestation/functions typecheck`
- `pnpm --filter @discord-attestation/contracts exec hardhat compile --force`
- `pnpm --filter @discord-attestation/contracts test`
- `pnpm --filter @discord-attestation/frontend test`
- `pnpm --filter @discord-attestation/frontend build`
- `pnpm --filter @discord-attestation/frontend test:e2e`
- `pnpm lint`
- Lighthouse mobile and desktop against `http://127.0.0.1:51973/`
- Rendered DOM check for canonical, JSON-LD, heading structure, and wallet deferral

Completed against production after deployment:

- Verified `https://discord.alainnicolas.fr/robots.txt` returns `200`.
- Verified production HTML includes the canonical URL and JSON-LD.
- Verified production HTML no longer includes wallet/AppKit module preloads.
- Re-ran Lighthouse mobile and desktop against `https://discord.alainnicolas.fr/`.

## Follow-up

No deployment follow-up remains for the audited items. Future optimization work, if desired, should focus on reducing the remaining React app-shell cost or inlining the tiny critical stylesheet, but those are low-priority after the measured production scores above.
