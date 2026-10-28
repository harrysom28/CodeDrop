# CodeDrop

Verified tipster and copy-betting app for Nigerian bettors. Tipsters lock picks before kickoff and the records can't be faked. Booking codes are pulled in from public Telegram channels, and users copy slips straight into their own bookie.

> "CodeDrop" is a working name. Check CAC, the app stores and trademarks before launch.

## What's here

```
server/               Node.js + TypeScript + Express + MongoDB
packages/shared/      Zod contracts used by server + app
app/                  Expo + expo-router (Android first)
```

## Run it

```bash
cd server
cp .env.example .env          # fill in MONGODB_URI etc.
npm install
npm test                      # needs a local mongod; override with MONGODB_TEST_URI if not on :27018
npm run typecheck
npm run dev                   # API on :4000
```

### Telegram listener

1. Use a **dedicated** Telegram account (separate SIM), not a personal one.
2. Get `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` from <https://my.telegram.org> → API development tools.
3. `npm run telegram:login` → put the printed session in `TELEGRAM_SESSION`.
4. Add channels: `POST /admin/channels {"usernames": ["@channel1", ...]}` (admin user).
5. `npm run telegram:join` a few times a day. It joins at most 10 per run, slowly, to avoid Telegram limits.
6. `npm run telegram:listen` runs forever under pm2 or Docker on the server.

Only public channels are read. Owners can be removed with `POST /channels/:username/opt-out`.

## API

Auth: `AUTH_MODE=dev` → send `x-user-id: <mongo user id>`. `AUTH_MODE=firebase` → `Authorization: Bearer <Firebase ID token>` (upserts the user on first request).

| Method | Path | What |
|---|---|---|
| GET | `/health` | Status + bookies we can decode |
| POST | `/dev/login` | Dev-only: `{phone}` → upsert user (not in production) |
| GET | `/me` | Current user profile |
| POST | `/me/onboarding` | `{over18Confirmed: true, favouriteClubs, mainBookie, unitNaira}` |
| PATCH | `/me` | `{handle?, displayName?}` — handle is unique `[a-z0-9_]{3,20}` |
| POST | `/convert` | `{code, from, to}` — resolve slip; per-leg availability on target (auth required) |
| POST | `/me/bets` | Track a bet by code `{code, bookie, stakeNaira, source}` |
| GET | `/me/bets?status=open\|settled` | User bet list |
| GET | `/me/bets/summary?month=YYYY-MM` | P/L split + insight line |
| POST | `/admin/legs/settle` | Manual leg result (admin) |
| GET | `/picks/preview/:bookie/:code` | Legs inside a booking code |
| POST | `/picks` | Lock a pick `{code, bookie, stakeUnits, note, visibility}` or `{legs, …}` |
| GET | `/picks/:id` | A pick. VIP content and salt stay hidden until settled |
| POST | `/picks/:id/copy` | Record a copy (closed once games start) |
| GET | `/feed?tab=following\|trending\|spotted` | Feed tabs |
| POST/DELETE | `/follows/:tipsterId` | Follow / unfollow |
| GET | `/leaderboard?days=90` | Ranked, ID-verified tipsters |
| GET | `/tipsters/:id` | Profile, score, followers |
| POST | `/admin/channels` | Track Telegram channels (admin) |
| GET | `/channels/:username/record` | A channel's private record, for the claim flow (admin) |

## Must be done before real users

- [x] **Auth:** Firebase phone auth wired (`AUTH_MODE=firebase`). Needs project credentials.
- [ ] **SportyBet lookup:** CloudFront 403 from this host — need a browser-captured fixture.
- [x] **More bookies:** stubs + `ENABLED_BOOKIES` + `POST /convert` + team matching (need real fixtures).
- [x] **Results feed:** API-Football mapper + admin settle + worker + odds snapshots (needs key).
- [x] **On-chain anchoring:** Merkle roots/proofs offline; live Base write behind `ANCHORING_ENABLED`.
- [x] **ID verification:** Dojah/Smile interface (stub until keys); never stores raw BVN/NIN.
- [x] **Subscriptions + escrow + wallet:** double-entry ledger; `SUBSCRIPTIONS_ENABLED=false` by default.
- [x] **Rooms:** Socket.IO + REST, slow mode, reports, word filter, moderation queue.
- [ ] Legal review of subscriptions before enabling in production.
- [ ] Paystack / Firebase / API-Football / ID-provider credentials (see `server/TODO_HARRISON.md`).

## Processes

```bash
npm run dev       # API + Socket.IO
npm run worker    # settlement, odds snapshots, escrow, anchoring
npm run telegram:listen
```

## Mobile app

```bash
cd app
cp .env.example .env
npm install
npx expo start
```

Tabs: Feed · Rooms · Leaders · Convert · Me. Local phone auth uses `POST /dev/login` while `AUTH_MODE=dev`. Production Firebase phone auth needs an EAS development build (`@react-native-firebase/auth` is not in Expo Go).

```bash
cd app && eas build --profile preview
```

`PLAY_STORE_NOTES.md` · `DEPLOY.md` · CI in `.github/workflows/ci.yml`.

## Docker

```bash
docker compose up --build
```

Dokploy services: `api` (`GET /health`), `worker`, `listener`. Compose Mongo/Redis are for local/staging.
