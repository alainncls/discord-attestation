import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { createOAuthStateStore } from './oauth-state';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const siteId = required('NETLIFY_SITE_ID');
const token = required('NETLIFY_AUTH_TOKEN');
const deployId = required('NETLIFY_DEPLOY_ID');
const expectedSha = required('EXPECTED_SHA').toLowerCase();
const previewApiUrl = required('PREVIEW_API_URL');
const previewOrigin = required('PREVIEW_ORIGIN');
if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('EXPECTED_SHA must be a full Git SHA');
if (new URL(previewOrigin).origin !== previewOrigin) {
  throw new Error('PREVIEW_ORIGIN must be an origin without a path');
}
if (new URL(previewApiUrl).origin !== previewOrigin) {
  throw new Error('PREVIEW_API_URL must use the verified preview origin');
}

const fail = (message: string): never => {
  throw new Error(message);
};

const deploymentResponse = await fetch(
  `https://api.netlify.com/api/v1/deploys/${encodeURIComponent(deployId)}`,
  { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
);
if (!deploymentResponse.ok) fail(`Netlify deploy lookup failed: HTTP ${deploymentResponse.status}`);
const deployment = (await deploymentResponse.json()) as {
  site_id?: string;
  context?: string;
  commit_ref?: string;
  deploy_ssl_url?: string;
  deploy_url?: string;
};
if (
  deployment.site_id !== siteId ||
  deployment.context !== 'deploy-preview' ||
  deployment.commit_ref?.toLowerCase() !== expectedSha
) {
  fail('Deploy site, context, or commit SHA does not match the isolated preview inputs');
}
const deployUrl = deployment.deploy_ssl_url ?? deployment.deploy_url;
if (!deployUrl || new URL(deployUrl).origin !== previewOrigin) {
  throw new Error('PREVIEW_ORIGIN does not match the verified deploy URL');
}
if (
  new URL(deployUrl).toString().replace(/\/$/, '') !==
  new URL(previewApiUrl).toString().replace(/\/$/, '')
) {
  fail('PREVIEW_API_URL must match the verified deploy URL');
}

const storeName = 'discord-oauth-v1-deploy-preview';
const rawStore = getStore({ name: storeName, siteID: siteId, token, consistency: 'strong' });
const firstStore = createOAuthStateStore(rawStore);
const secondStore = createOAuthStateStore(
  getStore({ name: storeName, siteID: siteId, token, consistency: 'strong' }),
);
const productionStore = createOAuthStateStore(
  getStore({ name: 'discord-oauth-v1-production', siteID: siteId, token, consistency: 'strong' }),
);
let stateHashToCleanup: string | undefined;

try {
  const startResponse = await fetch(`${previewApiUrl.replace(/\/$/, '')}/.netlify/functions/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: previewOrigin },
    body: JSON.stringify({
      action: 'start',
      subject: '0x2222222222222222222222222222222222222222',
      chainId: 59141,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!startResponse.ok) fail(`Preview OAuth start failed: HTTP ${startResponse.status}`);
  if (startResponse.headers.get('access-control-allow-origin') !== previewOrigin) {
    fail('Preview OAuth start did not allow the verified preview origin');
  }
  const cookie = startResponse.headers.get('set-cookie') ?? '';
  if (
    !cookie.includes('HttpOnly') ||
    !cookie.includes('Secure') ||
    !cookie.includes('SameSite=Lax')
  ) {
    fail('Preview OAuth state cookie is missing required security attributes');
  }
  const body = (await startResponse.json()) as { authorizeUrl?: string };
  const authorizeUrl = body.authorizeUrl;
  if (!authorizeUrl) throw new Error('Preview did not return an OAuth authorize URL');
  const state = new URL(authorizeUrl).searchParams.get('state');
  if (!state) throw new Error('Preview OAuth authorize URL did not contain state');
  const stateHash = createHash('sha256').update(state).digest('hex');
  stateHashToCleanup = stateHash;
  const entry = await firstStore.read(stateHash);
  if (!entry)
    throw new Error('Preview state was not strongly readable from the isolated Blobs namespace');
  if (entry.record.environment !== 'deploy-preview' || entry.record.status !== 'pending') {
    fail('Preview state was not strongly readable from the isolated Blobs namespace');
  }
  if (await firstStore.create(stateHash, entry.record))
    fail('onlyIfNew accepted an existing state');
  if (await productionStore.read(stateHash)) fail('Preview state leaked into production namespace');

  const race = await Promise.all([
    firstStore.compareAndSet(stateHash, entry.etag, { ...entry.record, status: 'consumed' }),
    secondStore.compareAndSet(stateHash, entry.etag, { ...entry.record, status: 'consumed' }),
  ]);
  if (race.filter(Boolean).length !== 1)
    fail('Concurrent compare-and-set did not consume exactly once');
  const consumed = await secondStore.read(stateHash);
  if (consumed?.record.status !== 'consumed') fail('Consumed state was not strongly readable');

  console.log(
    JSON.stringify({
      result: 'passed',
      siteId,
      deployId,
      context: deployment.context,
      commitSha: deployment.commit_ref,
      stateNamespace: storeName,
      checks: [
        'preview-start',
        'strong-read',
        'onlyIfNew',
        'parallel-CAS-once',
        'namespace-isolation',
      ],
      userTokenExchange: false,
    }),
  );
} finally {
  if (stateHashToCleanup) await rawStore.delete(stateHashToCleanup);
}
