# Discord OAuth Blobs preview verification

This is an opt-in integration check for an isolated Netlify Deploy Preview. It
verifies the running preview's `action: start` write against the preview
namespace, strong reads the record, verifies `onlyIfNew`, races two independent
Blobs clients through the same ETag CAS, checks that production's namespace does
not contain the preview key, and deletes the generated record. It does not
exchange a Discord code, request a user token, or sign with the production
wallet.

The script verifies `NETLIFY_DEPLOY_ID` through the Netlify Deploy API before
making any write. It requires the deployment's site ID, `deploy-preview`
context, commit SHA, deploy URL, `PREVIEW_ORIGIN`, and `PREVIEW_API_URL` to
match the supplied inputs. Blobs writes are limited to the random SHA-256 state
key returned by that deployment's start endpoint and removed in `finally`.

Run only after a review-approved isolated preview for the exact candidate SHA
exists. Populate these environment variables through a local secret manager or
shell environment; never paste or print the auth token:

```sh
export NETLIFY_SITE_ID='the-isolated-preview-site-id'
export NETLIFY_AUTH_TOKEN='provided-by-secret-manager'
export NETLIFY_DEPLOY_ID='the-deploy-preview-id'
export EXPECTED_SHA='full-40-character-candidate-sha'
export PREVIEW_ORIGIN='https://the-preview-host'
export PREVIEW_API_URL='https://the-preview-host'
pnpm verify:oauth-preview
```

The harness is not a substitute for the browser's OAuth callback. Its passing
receipt establishes the real provider's storage semantics only for the
reported site/deploy/SHA. Preview scheduled functions are not assumed to run;
the record is explicitly deleted by the harness. Without isolated site access,
the provider gate remains `external_blocked` and no mocked result is accepted.
