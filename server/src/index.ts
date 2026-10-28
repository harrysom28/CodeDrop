import { createServer } from 'node:http';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { buildRegistry } from './services/resolvers.js';

await connectDb();
const app = createApp({ registry: buildRegistry() });
const server = createServer(app);
await attachRealtime(server);
server.listen(config.PORT, () => {
  console.log(`CodeDrop API on :${config.PORT} (auth: ${config.AUTH_MODE})`);
});
