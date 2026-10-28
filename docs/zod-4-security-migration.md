# Zod 4 security migration

`GHSA-mrhx-c7xc-m3w5` (CVE-2023-54404) affects Zod releases before 4.6.6.
The deployed Reown AppKit 1.8.24 graph still requests Zod 3.x, so the workspace
uses the exact `zod: 4.6.6` override in `pnpm-workspace.yaml`.

This is a deliberate cross-major transitive override, not a SemVer compatibility
claim for the upstream dependencies. It must remain covered by frozen
installation, the complete test/build/E2E suite, Netlify preview verification,
and a production smoke test until Reown publishes a compatible dependency graph.
