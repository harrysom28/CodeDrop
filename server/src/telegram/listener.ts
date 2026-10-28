import { Api } from 'telegram';
import { NewMessage, type NewMessageEvent } from 'telegram/events/index.js';
import pino from 'pino';
import { connectDb, mongoSpottedStore } from '../db.js';
import { Channel } from '../models/index.js';
import { ingestPost } from '../services/ingest.js';
import { buildRegistry } from '../services/resolvers.js';
import { telegramClient } from './client.js';

/**
 * Long-running process: receives every new post from the channels the reader account has joined,
 * pulls booking codes out of it and stores them as Spotted slips. Runs on a server under a process
 * manager (pm2 / Docker restart policy), separate from the API.
 */
const log = pino({ name: 'telegram-listener' });

await connectDb();
const resolver = buildRegistry();
const store = mongoSpottedStore();

// Only ingest channels we track and that haven't opted out. Refreshed every 5 minutes.
let tracked = new Set<string>();
async function refreshTracked() {
  const rows = await Channel.find({ source: 'telegram', enabled: true, optedOut: false }, { username: 1 }).lean();
  tracked = new Set(rows.map((r) => r.username.toLowerCase()));
  log.info({ count: tracked.size }, 'tracked channels refreshed');
}
await refreshTracked();
setInterval(() => void refreshTracked().catch((err) => log.error(err)), 5 * 60_000);

const client = telegramClient();
await client.connect();
log.info('connected to Telegram');

async function onMessage(event: NewMessageEvent) {
  const msg = event.message;
  const text = msg.message ?? '';
  if (!text) return; // photo-only posts: OCR is a later addition
  const chat = await msg.getChat();
  if (!(chat instanceof Api.Channel) || !chat.username) return;
  const username = chat.username.toLowerCase();
  if (!tracked.has(username)) return;

  const outcomes = await ingestPost(
    {
      source: 'telegram',
      channel: `@${username}`,
      messageId: String(msg.id),
      url: `https://t.me/${username}/${msg.id}`,
      postedAt: new Date(msg.date * 1000),
      text,
    },
    { resolver, store },
  );
  if (outcomes.length) log.info({ channel: username, outcomes }, 'post ingested');
}

client.addEventHandler((e: NewMessageEvent) => {
  onMessage(e).catch((err) => log.error({ err }, 'ingest failed'));
}, new NewMessage({}));

process.on('SIGTERM', async () => {
  await client.disconnect();
  process.exit(0);
});
