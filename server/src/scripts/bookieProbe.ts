#!/usr/bin/env node
/**
 * Fetch one booking code from a bookie and save the raw JSON under server/fixtures/.
 *
 * Usage: npm run bookie:probe -- sportybet 3F8KQ2
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { BOOKIES, type Bookie } from '../core/types.js';
import { DEFAULT_SPORTYBET_SHARE_URL } from '../core/bookies/sportybet.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'fixtures');

const URLS: Partial<Record<Bookie, string>> = {
  sportybet: config.SPORTYBET_SHARE_URL ?? DEFAULT_SPORTYBET_SHARE_URL,
  bet9ja: config.BET9JA_SHARE_URL ?? 'https://EXAMPLE-unverified/bet9ja/{code}',
  betking: config.BETKING_SHARE_URL ?? 'https://EXAMPLE-unverified/betking/{code}',
  msport: config.MSPORT_SHARE_URL ?? 'https://EXAMPLE-unverified/msport/{code}',
};

async function main() {
  const bookie = process.argv[2]?.toLowerCase() as Bookie | undefined;
  const code = process.argv[3]?.toUpperCase();
  if (!bookie || !code || !(BOOKIES as readonly string[]).includes(bookie)) {
    console.error('Usage: npm run bookie:probe -- <bookie> <CODE>');
    console.error(`Bookies: ${BOOKIES.join(', ')}`);
    process.exit(1);
  }
  const template = URLS[bookie];
  if (!template || template.includes('EXAMPLE-unverified')) {
    console.error(
      `No verified share URL for ${bookie}. Set the env URL or capture a browser Network response into fixtures/${bookie}-${code}.json and add the item to TODO_HARRISON.md.`,
    );
    process.exit(2);
  }
  const url = template.replace('{code}', encodeURIComponent(code));
  console.log(`GET ${url}`);
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  await mkdir(FIXTURES, { recursive: true });
  const out = path.join(FIXTURES, `${bookie}-${code}.json`);
  await writeFile(out, JSON.stringify({ url, status: res.status, fetchedAt: new Date().toISOString(), body }, null, 2));
  console.log(`saved ${out} (HTTP ${res.status})`);
  if (!res.ok) process.exit(3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
