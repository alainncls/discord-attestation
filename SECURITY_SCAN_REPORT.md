# Security Scan Report

Repository: `discord-attestation`
Scan date: 2026-05-08
Scope: repository-wide scan of the checked-out workspace at commit `daf4eae`
Scan artifacts: `/tmp/codex-security-scans/discord-attestation/daf4eae_20260508T162458Z`

## Executive Summary

Four reportable findings survived discovery, validation, and attack-path analysis:

| Priority | Severity | Finding |
|---|---|---|
| P1 | High | Backend and contract do not bind Discord proofs to the wallet that controls the attestation subject |
| P2 | Medium | Signatures authorize only guild ID and subject while stored attestation fields remain mutable |
| P2 | Medium | OAuth callback code is not bound to an unpredictable state value |
| P2 | Medium | Discord access tokens are transported and persisted in leak-prone client-side locations |

Validation performed:

- `pnpm --filter @discord-attestation/contracts compile` passed.
- `pnpm --filter @discord-attestation/frontend test -- --runInBand` passed: 6 test files, 14 tests.
- `pnpm audit --prod --json` reported 0 production vulnerabilities across 465 production dependencies.

Post-remediation status:

| Priority | Remediation status |
|---|---|
| P1 | Mitigated on-chain by requiring the submitting wallet to match the attestation subject, plus backend validation for subject and supported chain IDs. A wallet-signed backend challenge remains useful future hardening if delegated or account-abstraction submissions become required. |
| P2 | Fixed by signing guild ID, guild name, subject, and expiration date in the EIP-712 payload. |
| P2 | Fixed by adding a per-login OAuth `state` value and validating it before code exchange. |
| P2 | Fixed by removing token query-string transport, removing browser token persistence, restricting the API to `POST`, and narrowing CORS. |

Post-remediation validation performed:

- `pnpm --filter @discord-attestation/contracts exec hardhat compile --force`
- `pnpm --filter @discord-attestation/contracts test`
- `pnpm --filter @discord-attestation/frontend typecheck`
- `pnpm --filter @discord-attestation/functions typecheck`
- `pnpm --filter @discord-attestation/frontend test`
- `pnpm --filter @discord-attestation/frontend build`
- `pnpm --filter @discord-attestation/frontend test:e2e`
- `pnpm lint`

## Finding: Backend and contract do not bind Discord proofs to the wallet that controls the attestation subject

Priority: P1
Severity: High
Confidence: High
CWE: CWE-287 Improper Authentication, CWE-345 Insufficient Verification of Data Authenticity, CWE-862 Missing Authorization

Affected lines:

- `packages/functions/api.ts:106-123` reads public query parameters including `code`, `accessToken`, `subject`, and `chainId`.
- `packages/functions/api.ts:80-91` signs typed data for the caller-provided `subject`.
- `packages/functions/api.ts:144` returns signed guilds for that subject.
- `packages/contracts/src/DiscordPortal.sol:53-60` verifies the signature without checking the caller/attester controls the subject.
- `packages/contracts/src/DiscordPortal.sol:24` defines `SenderIsNotSubject()` but never uses it.
- `packages/contracts/node_modules/@verax-attestation-registry/verax-contracts/contracts/abstracts/AbstractPortalV2.sol:73-90` stores the attestation after `_onAttest` succeeds.

### Summary

The API and contract both trust a caller-provided wallet subject. The backend signs Discord guild membership for whatever `subject` appears in the API query, and the contract accepts that signed `(guildId, subject)` tuple without requiring `subject == msg.sender` or `subject == getAttester()`.

That means an attacker with their own valid Discord token can create a valid on-chain Discord membership attestation for a wallet they do not control.

### Validation

The contract compiles, and static source-to-sink tracing confirms the path:

1. API reads `subject` from query parameters.
2. API fetches guilds for a valid Discord token or code.
3. API signs each guild ID with the supplied subject.
4. Contract verifies signer authenticity only.
5. Verax registry stores the submitted subject and data.

Frontend behavior is not a sufficient control because the API and contract are directly callable.

### Reachability Analysis

This is in scope. The Netlify Function, backend signer, and Solidity portal are primary runtime surfaces. The path crosses the browser/API/backend-signer/on-chain trust boundary and affects the core product invariant: Discord membership attestations should be tied to the wallet owner.

### Attack Path

1. Attacker obtains a Discord OAuth code or access token for their own Discord account.
2. Attacker calls the Netlify function directly and sets `subject` to a target wallet address.
3. Backend signs the attacker guild IDs for the target subject.
4. Attacker submits the signed payload through `DiscordPortal.attest`.
5. The registry stores an attestation for the target wallet.

### Severity Analysis

Impact is high because the core identity assertion can be created for arbitrary wallet subjects. Likelihood is high because the path is public and requires only normal Discord credentials plus gas/fee. Final severity: High.

### Remediation

- Require a wallet-signed challenge before the backend signs guild memberships.
- Bind the challenge to the Discord OAuth session, `subject`, `chainId`, and a short expiration.
- In `DiscordPortal._onAttest`, enforce that the subject address matches `msg.sender` or `getAttester()`.
- Add contract tests that a caller cannot attest for a different subject.
- Add API tests that signing fails without a wallet proof for the requested subject.

## Finding: Signatures authorize only guild ID and subject while stored attestation fields remain mutable

Priority: P2
Severity: Medium
Confidence: High
CWE: CWE-347 Improper Verification of Cryptographic Signature, CWE-345 Insufficient Verification of Data Authenticity, CWE-294 Authentication Bypass by Capture-replay

Affected lines:

- `packages/functions/api.ts:65-91` signs typed data containing only `id` and `subject`.
- `packages/contracts/src/DiscordPortal.sol:59-60` decodes `GuildPayload` but verifies only `payload.guildId` and `subject`.
- `packages/contracts/src/DiscordPortal.sol:121-124` hashes `Discord(uint256 id,address subject)`.
- `packages/frontend/src/hooks/useAttestationManager.ts:52-58` sets one-month expiration and guild name in frontend-only code.
- `packages/contracts/node_modules/@verax-attestation-registry/verax-contracts/contracts/AttestationRegistry.sol:122-134` stores caller-supplied `expirationDate` and `attestationData`.

### Summary

The backend signature authorizes only `guildId` and `subject`, but the registry stores additional caller-controlled fields such as `guildName`, `expirationDate`, and full `attestationData`. A valid signature can therefore be reused with altered metadata or a longer expiration than the frontend intended.

### Validation

Static tracing confirms:

- The backend EIP-712 type is `Discord(uint256 id,address subject)`.
- `DiscordPortal.verifySignature` uses only `guildId` and `subject`.
- Verax stores `expirationDate` and `attestationData` from the submitted payload.

The frontend sets sane values, but direct contract callers can bypass the frontend.

### Reachability Analysis

This is a public on-chain path. The attacker still needs a valid signature for the same guild ID and subject, so the issue does not let them change the core guild ID. It does let them change stored metadata and freshness semantics.

### Attack Path

1. Attacker obtains a valid signature for `(guildId, subject)`.
2. Attacker submits a direct contract transaction with modified `guildName`.
3. Attacker chooses an arbitrary expiration, including a longer-lived attestation than the frontend's one-month value.
4. Contract accepts the signature because the signed tuple is unchanged.
5. Registry stores the modified payload.

### Severity Analysis

Impact is medium: it affects integrity of stored metadata and freshness, but it does not allow arbitrary guild ID forgery with a reused signature. Likelihood is high for anyone who has a valid signature. Final severity: Medium.

### Remediation

- Include all security-relevant attestation fields in the EIP-712 typed data.
- At minimum, sign `guildId`, `guildName`, `subject`, `chainId`, `verifyingContract`, and an expiration or `validUntil`.
- Enforce a maximum expiration in the contract.
- Consider a nonce or single-use signature model if duplicate/replay attestations are undesirable.
- Add tests that changing `guildName` or `expirationDate` invalidates the signature.

## Finding: OAuth callback code is not bound to an unpredictable state value

Priority: P2
Severity: Medium
Confidence: Medium
CWE: CWE-352 Cross-Site Request Forgery, CWE-384 Session Fixation

Affected lines:

- `packages/frontend/src/components/LoginWithDiscord.tsx:8` builds the Discord authorize URL without `state`.
- `packages/frontend/src/components/LoginWithDiscord.tsx:12` stores only a boolean OAuth-started marker.
- `packages/frontend/src/App.tsx:23-24` reads only `code` from the callback URL.
- `packages/frontend/src/hooks/useFetchGuilds.ts:22-31` treats a migrated boolean marker as sufficient initial OAuth loading state.
- `packages/frontend/src/hooks/useFetchGuilds.ts:75-89` sends the code to the API with the current subject and chain.
- `packages/frontend/src/hooks/useFetchGuilds.ts:158-168` exchanges any present code while loading.

### Summary

The Discord OAuth request has no unpredictable `state` parameter, and the callback does not verify one. A local boolean marker reduces accidental processing, but it is not sent to Discord and cannot prove that a callback belongs to the login request that created the marker.

### Validation

Static tracing confirms the authorize URL omits `state`; callback handling reads `code` only; and the local marker is only a boolean in localStorage. No live OAuth test was run because it requires real Discord app credentials and redirect timing.

### Reachability Analysis

This affects the public browser OAuth flow. The strongest counterevidence is that the boolean marker prevents a completely unsolicited callback from being processed. That narrows reachability but does not provide request/response binding, especially for active or stale login attempts.

### Attack Path

1. Victim has an active or stale OAuth-started marker.
2. Attacker causes a callback URL with a code from a different Discord login to be loaded.
3. Frontend exchanges the code in the currently connected wallet context.
4. App receives guild/signature data for the wrong Discord identity.
5. User may create attestations under a confused identity binding.

### Severity Analysis

Impact is medium because this can confuse Discord identity binding in the attestation flow. Likelihood is medium because the boolean marker is a real precondition. Final severity: Medium.

### Remediation

- Generate a cryptographically random `state` per OAuth attempt.
- Store it with a short lifetime.
- Include it in the Discord authorize URL.
- Verify the callback `state` before exchanging the code.
- Clear the marker and state after use or failure.
- Consider PKCE if supported by the chosen Discord OAuth/client setup.

## Finding: Discord access tokens are transported and persisted in leak-prone client-side locations

Priority: P2
Severity: Medium
Confidence: Medium-High
CWE: CWE-598 Use of GET Request Method With Sensitive Query Strings, CWE-200 Exposure of Sensitive Information, CWE-922 Insecure Storage of Sensitive Information, CWE-613 Insufficient Session Expiration

Affected lines:

- `packages/functions/api.ts:108` reads `accessToken` from URL query parameters.
- `packages/functions/api.ts:123` uses that token as the Discord bearer token.
- `packages/functions/api.ts:146` returns the access token in JSON.
- `packages/functions/api.ts:14-18` allows wildcard CORS on token-bearing responses.
- `packages/frontend/src/hooks/useFetchGuilds.ts:84-89` sends restored tokens in a GET query string.
- `packages/frontend/src/hooks/useFetchGuilds.ts:104-105` stores returned tokens.
- `packages/frontend/src/utils/storage.ts:3-6` defines a single origin-wide token key.
- `packages/frontend/src/utils/storage.ts:21-27` writes tokens to `window.localStorage`.
- `packages/frontend/src/hooks/useFetchGuilds.ts:124-138` restores tokens for the currently connected wallet/session.

### Summary

Discord bearer tokens are returned to the browser, stored in localStorage, and later sent back to the API in GET query strings. Query strings are commonly retained in request logs and diagnostics, and localStorage is readable by any same-origin script.

### Validation

Static tracing confirms normal session restoration serializes `accessToken` into the API URL and the backend accepts it from `context.url.searchParams`. The repository does not prove Netlify log retention or token lifetime, so severity is capped below high.

### Reachability Analysis

This is a normal product path. The token crosses browser, serverless API, and Discord API boundaries. A disclosed token can be replayed to the backend endpoint to fetch guilds and obtain signing responses until the token expires or is revoked.

### Attack Path

1. User completes OAuth and receives a Discord access token.
2. Frontend stores it in origin-wide localStorage.
3. Frontend sends it in a GET URL on session restoration.
4. Token is exposed through logs, diagnostics, local browser access, or same-origin script execution.
5. Attacker replays the token to the API.

### Severity Analysis

Impact is medium because exposed tokens reveal Discord guild membership and can drive backend signing responses. Likelihood is medium-to-high because the token-in-URL path is normal app behavior, but concrete production log exposure is not proven by repository evidence. Final severity: Medium.

### Remediation

- Do not put access tokens in query strings.
- Use POST bodies or `Authorization` headers if the frontend must transmit a token.
- Prefer server-side, session-bound storage over returning Discord access tokens to the browser.
- If browser storage remains necessary, use short lifetimes and bind restored tokens to explicit wallet/session state.
- Restrict CORS to the application origin if token-bearing responses remain.

## Coverage Closure

The repository-wide coverage ledger is saved at `/tmp/codex-security-scans/discord-attestation/daf4eae_20260508T162458Z/artifacts/repository_coverage_ledger.md`.

Closed as suppressed or not applicable:

- SSRF/network callbacks: backend destinations are fixed Discord and Linea RPC URLs.
- Injection/RCE/file/process sinks: no shell, eval, filesystem, template, SQL/NoSQL, dynamic import, or process execution sink was found.
- Direct DOM XSS: React renders dynamic values in text/attribute contexts; no raw HTML or dynamic code sink was found.
- Static analytics script execution: script source is static same-origin; the vendored bundle has analytics beacons but no dynamic code execution, storage, cookie use, or query-tracking call.
- Deployment/operator secrets: secrets are env/config-variable based; tracked `.env.example` files contain placeholders and real `.env` files are ignored.
- Owner-only replace/revoke: Verax portal owner checks are present.
- Contract malformed payload DoS: malformed `validationPayloads` or `attestationData` only reverts caller-paid transactions before registry writes.
- Unsupported-chain frontend fallback: real hardening issue, but no concrete security impact beyond likely failed or misdirected transaction context was established.
- Dependencies: `pnpm audit --prod --json` reported zero production vulnerabilities.

## Follow-Up Prompts

- Review a fix for `packages/functions/api.ts` and `packages/contracts/src/DiscordPortal.sol` that adds wallet-signed challenges and enforces `subject == attester`.
- Review a contract/API change that expands the EIP-712 typed data to include `guildName`, expiration/freshness, and nonce semantics.
- Review an OAuth hardening change in `packages/frontend/src/components/LoginWithDiscord.tsx`, `packages/frontend/src/App.tsx`, and `packages/frontend/src/hooks/useFetchGuilds.ts` that adds `state` and removes token-in-query transport.
