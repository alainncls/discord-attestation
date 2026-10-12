import axios from 'axios';
import { createApiHandler } from '../api';
import { createLocalFunctionServer } from './localDevServer';
import { createLocalOAuthStateStore } from './localOAuthState';

const store = createLocalOAuthStateStore();
const server = createLocalFunctionServer({
  api: createApiHandler({
    http: axios,
    config: () => ({ ...process.env, NODE_ENV: 'development', CONTEXT: 'dev' }),
    oauthStateStore: () => store,
  }),
});
server.listen(Number(process.env.PORT ?? 8888), '127.0.0.1', () => {
  console.log('Local Discord function adapter listening on loopback');
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
