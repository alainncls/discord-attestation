import type { Context } from '@netlify/functions';
import { pruneExpiredOAuthStateRecords } from './lib/oauthState';

export const config = { schedule: '0 3 * * *' };

export default async (_req: Request, context?: Context): Promise<Response> => {
  const environment = process.env.CONTEXT ?? context?.deploy?.context ?? 'production';
  try {
    const removed = await pruneExpiredOAuthStateRecords(environment);
    return new Response(JSON.stringify({ removed }), {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'OAuth state cleanup failed' }), {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    });
  }
};
