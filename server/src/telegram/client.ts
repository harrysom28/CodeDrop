import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { config } from '../config.js';

/**
 * One dedicated Telegram account (not anyone's personal number) reads public tipster channels.
 * Get TELEGRAM_API_ID / TELEGRAM_API_HASH from https://my.telegram.org → API development tools,
 * then run `npm run telegram:login` once to produce TELEGRAM_SESSION.
 */
export function telegramClient(session = config.TELEGRAM_SESSION) {
  if (!config.TELEGRAM_API_ID || !config.TELEGRAM_API_HASH) {
    throw new Error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH (from my.telegram.org) in .env');
  }
  return new TelegramClient(new StringSession(session), config.TELEGRAM_API_ID, config.TELEGRAM_API_HASH, {
    connectionRetries: 10,
    autoReconnect: true,
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
