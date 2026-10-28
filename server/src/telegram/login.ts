import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { telegramClient } from './client.js';

/** One-off: logs the reader account in and prints the session string to put in TELEGRAM_SESSION. */
const rl = createInterface({ input: stdin, output: stdout });
const client = telegramClient('');

await client.start({
  phoneNumber: () => rl.question('Phone number of the reader account (+234…): '),
  phoneCode: () => rl.question('Code Telegram sent you: '),
  password: () => rl.question('2FA password (blank if none): '),
  onError: (err) => console.error(err),
});

console.log('\nAdd this to .env as TELEGRAM_SESSION (keep it secret, it is a login):\n');
console.log(client.session.save());
rl.close();
await client.disconnect();
process.exit(0);
