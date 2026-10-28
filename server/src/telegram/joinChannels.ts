import { Api } from 'telegram';
import { config } from '../config.js';
import { connectDb } from '../db.js';
import { Channel } from '../models/index.js';
import { sleep, telegramClient } from './client.js';

/**
 * Joins tracked public channels slowly. Telegram restricts accounts that join many channels quickly,
 * so we join at most TELEGRAM_JOIN_PER_RUN per run with 1–3 minutes between joins, and obey FLOOD_WAIT.
 * Run it a few times a day (cron) until every channel is joined.
 */
await connectDb();
const client = telegramClient();
await client.connect();

const pending = await Channel.find({ source: 'telegram', enabled: true, optedOut: false, joinedAt: null })
  .limit(config.TELEGRAM_JOIN_PER_RUN)
  .lean();

console.log(`Joining ${pending.length} channel(s)`);
for (const ch of pending) {
  try {
    const entity = await client.getEntity(ch.username);
    await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
    const title = 'title' in entity ? String(entity.title) : undefined;
    await Channel.updateOne({ _id: ch._id }, { $set: { joinedAt: new Date(), title } });
    console.log(`joined @${ch.username}`);
  } catch (err) {
    const e = err as { errorMessage?: string; seconds?: number; message: string };
    if (e.errorMessage === 'FLOOD' || typeof e.seconds === 'number') {
      console.warn(`flood wait ${e.seconds}s, stopping this run`);
      break;
    }
    if (e.errorMessage === 'USERNAME_INVALID' || e.errorMessage === 'USERNAME_NOT_OCCUPIED' || e.errorMessage === 'CHANNEL_PRIVATE') {
      await Channel.updateOne({ _id: ch._id }, { $set: { enabled: false } });
      console.warn(`disabled @${ch.username}: ${e.errorMessage}`);
      continue;
    }
    console.error(`failed @${ch.username}: ${e.message}`);
  }
  await sleep(60_000 + Math.random() * 120_000);
}

await client.disconnect();
process.exit(0);
