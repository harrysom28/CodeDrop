import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createRequire } from 'node:module';
import { config } from '../config.js';
import { telegramClient } from './client.js';

/**
 * Log the reader account in by scanning a QR code, with no login code needed.
 * Use this when Telegram won't deliver login codes.
 *
 *   npx tsx src/telegram/loginQr.ts
 *
 * On your phone: Telegram → Settings → Devices → Link Desktop Device → scan the QR shown here.
 * The session is saved to .env as TELEGRAM_SESSION and never printed.
 */

// Bundled copy of qrcode-terminal (Apache-2.0) so no npm install is needed.
const qrcode = createRequire(import.meta.url)('../vendor/qrcode-terminal/lib/main.js') as {
  generate(text: string, opts: { small?: boolean }, cb: (qr: string) => void): void;
};

const rl = createInterface({ input: stdin, output: stdout });
const client = telegramClient('');
const creds = { apiId: config.TELEGRAM_API_ID!, apiHash: config.TELEGRAM_API_HASH! };

await client.connect();
console.log('\nOn your phone: Telegram → Settings → Devices → Link Desktop Device, then scan the code below.');
console.log('The code refreshes every ~30 seconds; scan the newest one.\n');

await client.signInUserWithQrCode(creds, {
  qrCode: async ({ token }) => {
    const url = `tg://login?token=${token.toString('base64url')}`;
    qrcode.generate(url, { small: true }, (qr) => {
      console.log(qr);
      console.log(`Waiting for scan… (${new Date().toLocaleTimeString()})\n`);
    });
  },
  password: async (hint) => rl.question(`2FA password${hint ? ` (hint: ${hint})` : ''}: `),
  onError: async (err) => {
    const msg = (err as { errorMessage?: string }).errorMessage ?? err.message;
    console.error(`Telegram said: ${msg}`);
    // Keep going on a wrong password (it asks again); stop on anything else.
    return msg !== 'PASSWORD_HASH_INVALID';
  },
});

const envPath = resolve(process.cwd(), '.env');
const line = `TELEGRAM_SESSION=${String(client.session.save())}`;
const text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
writeFileSync(
  envPath,
  /^TELEGRAM_SESSION=.*$/m.test(text) ? text.replace(/^TELEGRAM_SESSION=.*$/m, line) : `${text.replace(/\n?$/, '\n')}${line}\n`,
);

const me = await client.getMe();
const who = 'username' in me && me.username ? `@${me.username}` : 'the account';
console.log(`\nLogged in as ${who}. Session saved to ${envPath} (not shown, keep .env private).`);
console.log('Next: npm run telegram:join');
rl.close();
await client.disconnect();
process.exit(0);
