# Dependency cleanup — 12 October 2026

The full candidate audit is zero, including moderate advisories. Netlify CLI's
node-forge/braces chain is removed, not ignored. Deployment still uses Netlify
Functions; only local development changes to a loopback Node adapter invoking
the same production `createApiHandler`. `pnpm dev` retains port 8888, routing,
streamed bodies, cancellation, CORS and cookie headers. Local state is bounded,
in-memory and atomically consumed; production continues to use Netlify Blobs.
No token exchange/signing implementation was copied into the adapter.

`@base-org/account` is constrained to mature 2.5.13. Its supported Coinbase CDP
1.x range resolves 1.58.0, replacing Solana web3.js/Jayson/stream-json and old
uuid dependencies. This is a same-major parent update, not a forced stream-json
major under an incompatible CommonJS consumer. Remove the override once the
AppKit parent naturally requires this or a newer validated account version.
Netlify-specific overrides were removed together with their CLI parent.

Local HTTP adapter tests exercise the actual API, including start/cookies,
CORS, malformed input, unknown routes and twenty concurrent state consumers.
No production credentials, OAuth exchanges or public-chain transactions are
used. Full release evidence is recorded in the workspace remediation report;
GitHub Actions are intentionally not triggered by this change.

## Verified results

- Frozen pnpm 10.26.2 install; all 48 introduced versions at least 72 hours old.
- Full and production audit: zero at every severity (877 / 425 dependencies).
- Lint/Prettier, workspace typecheck and production build passed.
- 40 functions tests, 33 frontend tests, 4 contract tests and 8 desktop/mobile
  Playwright cases passed with Chromium matching the locked Playwright version.
- These are local results, not a new live Netlify OAuth/provider certification.
