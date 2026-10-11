import { pruneExpiredOAuthStateRecords } from './oauth-state';

export const config = { schedule: '0 3 * * *' };

export default async (): Promise<Response> => {
  const environment = process.env.CONTEXT ?? 'production';
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
