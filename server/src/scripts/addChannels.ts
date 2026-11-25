import { connectDb } from '../db.js';
import { Channel } from '../models/index.js';

/**
 * Add Telegram channels to track, straight into the database.
 *
 *   npx tsx src/scripts/addChannels.ts @channel1 @channel2 t.me/channel3
 *
 * Then run `npm run telegram:join` to join them (10 per run, slowly).
 * Channels that turn out to be private or invalid get disabled automatically by the join script.
 */
const names = process.argv
  .slice(2)
  .flatMap((a) => a.split(/[\s,]+/))
  .map((a) => a.trim().replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^@/, '').toLowerCase())
  .filter(Boolean);

const valid = names.filter((n) => /^[a-z0-9_]{4,32}$/.test(n));
const invalid = names.filter((n) => !valid.includes(n));

if (!valid.length) {
  console.log('Usage: npx tsx src/scripts/addChannels.ts @channel1 @channel2 ...');
  process.exit(1);
}

await connectDb();
let added = 0;
for (const username of valid) {
  const res = await Channel.updateOne(
    { source: 'telegram', username },
    { $setOnInsert: { enabled: true } },
    { upsert: true },
  );
  if (res.upsertedCount) added++;
}

const total = await Channel.countDocuments({ source: 'telegram', enabled: true, optedOut: false });
const joined = await Channel.countDocuments({ source: 'telegram', enabled: true, optedOut: false, joinedAt: { $ne: null } });
console.log(`Added ${added} new, ${valid.length - added} already tracked.`);
if (invalid.length) console.log(`Skipped (not valid usernames): ${invalid.join(', ')}`);
console.log(`Tracking ${total} channels, ${joined} joined. Next: npm run telegram:join`);
process.exit(0);
