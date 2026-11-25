import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Api } from 'telegram';
import { config } from '../config.js';
import { telegramClient } from './client.js';

/**
 * One-off: logs the reader account in and saves the session to .env as TELEGRAM_SESSION.
 *
 * Unlike GramJS's built-in login, this says WHERE Telegram sent the code (app, SMS, call, email…)
 * and lets you ask for it again by another method. The session is written to .env only, never printed.
 */

const rl = createInterface({ input: stdin, output: stdout });
const ask = (q: string) => rl.question(q).then((a) => a.trim());
const client = telegramClient('');
const creds = { apiId: config.TELEGRAM_API_ID!, apiHash: config.TELEGRAM_API_HASH! };

type TgError = { errorMessage?: string; seconds?: number; message: string };

function explain(type: Api.auth.TypeSentCodeType | undefined): string {
  if (!type) return 'Telegram did not say how it sent the code.';
  if (type instanceof Api.auth.SentCodeTypeApp) {
    return 'Sent INSIDE THE TELEGRAM APP: open the chat called "Telegram" (blue tick) on a device already logged in to this number. Check Archived Chats too.';
  }
  if (type instanceof Api.auth.SentCodeTypeSms) return 'Sent by SMS to the phone number.';
  if (type instanceof Api.auth.SentCodeTypeCall) return 'Telegram will PHONE you and read the code out.';
  if (type instanceof Api.auth.SentCodeTypeFlashCall) return 'Flash call: the code is in the number that rings you.';
  if (type instanceof Api.auth.SentCodeTypeMissedCall) {
    return `Missed call: the code is the last ${type.length} digits of the number that calls you (starts ${type.prefix}).`;
  }
  if (type instanceof Api.auth.SentCodeTypeEmailCode) {
    return `Sent to your LOGIN EMAIL (${type.emailPattern}). Check that inbox and spam.`;
  }
  if (type instanceof Api.auth.SentCodeTypeSetUpEmailRequired) {
    return 'Telegram wants this account to set up a login email first. Open Telegram on your phone → Settings → Privacy and Security → Login Email, add one, then run this again.';
  }
  if (type instanceof Api.auth.SentCodeTypeFragmentSms) return `Sent via Fragment: ${type.url}`;
  if (type instanceof Api.auth.SentCodeTypeFirebaseSms) return 'Sent by SMS (Firebase).';
  return `Sent as ${type.className}.`;
}

function nextHint(code: Api.auth.SentCode) {
  const next = code.nextType ? code.nextType.className.replace('auth.CodeType', '') : null;
  const wait = code.timeout ? `${code.timeout}s` : 'a moment';
  return next ? `If nothing arrives, type r to resend by ${next} (available after ${wait}).` : 'No other delivery method is offered.';
}

function fatal(err: unknown): never {
  const e = err as TgError;
  if (e.errorMessage === 'PHONE_NUMBER_INVALID') console.error('That number is not valid. Use +country code, e.g. +2347080951858.');
  else if (e.errorMessage === 'PHONE_NUMBER_BANNED') console.error('Telegram has banned this number.');
  else if (e.errorMessage === 'PHONE_NUMBER_FLOOD' || e.errorMessage?.startsWith('FLOOD')) {
    console.error(`Telegram is limiting login attempts${e.seconds ? `: wait ${Math.ceil(e.seconds / 60)} minutes` : ''}. Don't retry before then.`);
  } else if (e.errorMessage === 'API_ID_INVALID') console.error('TELEGRAM_API_ID / TELEGRAM_API_HASH in .env are wrong.');
  else console.error(`Telegram said: ${e.errorMessage ?? e.message}`);
  rl.close();
  process.exit(1);
}

function saveSession(session: string) {
  const envPath = resolve(process.cwd(), '.env');
  const line = `TELEGRAM_SESSION=${session}`;
  const text = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
  const next = /^TELEGRAM_SESSION=.*$/m.test(text)
    ? text.replace(/^TELEGRAM_SESSION=.*$/m, line)
    : `${text.replace(/\n?$/, '\n')}${line}\n`;
  writeFileSync(envPath, next);
  return envPath;
}

await client.connect();
const phoneNumber = (await ask('Phone number of the reader account, with country code (e.g. +234…): ')).replace(/[\s-]/g, '');

let sent: Api.auth.SentCode;
try {
  const res = await client.invoke(new Api.auth.SendCode({ phoneNumber, ...creds, settings: new Api.CodeSettings({}) }));
  if (!(res instanceof Api.auth.SentCode)) throw new Error('Telegram logged in without a code; run this again.');
  sent = res;
} catch (err) {
  fatal(err);
}

console.log(`\n${explain(sent.type)}`);
console.log(nextHint(sent));

let signedIn = false;
while (!signedIn) {
  const input = await ask('\nCode (or r to resend another way): ');
  if (input.toLowerCase() === 'r') {
    try {
      const res = await client.invoke(new Api.auth.ResendCode({ phoneNumber, phoneCodeHash: sent.phoneCodeHash }));
      if (!(res instanceof Api.auth.SentCode)) break;
      sent = res;
      console.log(`\n${explain(sent.type)}`);
      console.log(nextHint(sent));
    } catch (err) {
      const e = err as TgError;
      if (e.errorMessage === 'SEND_CODE_UNAVAILABLE') console.log('No other delivery method is available right now. Use the code already sent.');
      else if (e.errorMessage?.startsWith('FLOOD')) console.log(`Too soon to resend${e.seconds ? `, wait ${e.seconds}s` : ''}.`);
      else fatal(err);
    }
    continue;
  }

  const phoneCode = input.replace(/\D/g, '');
  if (!phoneCode) continue;
  try {
    await client.invoke(new Api.auth.SignIn({ phoneNumber, phoneCodeHash: sent.phoneCodeHash, phoneCode }));
    signedIn = true;
  } catch (err) {
    const e = err as TgError;
    if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      await client.signInWithPassword(creds, {
        password: async () => ask('2FA password: '),
        onError: async (pwErr) => {
          console.error(`Password rejected: ${(pwErr as TgError).errorMessage ?? pwErr.message}`);
          return false;
        },
      });
      signedIn = true;
    } else if (e.errorMessage === 'PHONE_CODE_INVALID') {
      console.log('Wrong code. Each code works once: use the newest one.');
    } else if (e.errorMessage === 'PHONE_CODE_EXPIRED') {
      console.log('That code expired. Type r to get a new one.');
    } else {
      fatal(err);
    }
  }
}

const envPath = saveSession(String(client.session.save()));
const me = await client.getMe();
const who = 'username' in me && me.username ? `@${me.username}` : 'the account';
console.log(`\nLogged in as ${who}. Session saved to ${envPath} (not shown, keep .env private).`);
console.log('Next: npm run telegram:join');
rl.close();
await client.disconnect();
process.exit(0);
