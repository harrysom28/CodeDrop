# CodeDrop

Verified tipster and copy-betting app for Nigerian bettors. Tipsters lock picks before kickoff and the records can't be faked. Booking codes are pulled in from public Telegram channels, and users copy slips straight into their own bookie.

> "CodeDrop" is a working name. Check CAC, the app stores and trademarks before launch.

## What's here

```
server/               Node.js + TypeScript + Express + MongoDB (same stack as Keke Ride)
  src/core/           Pure logic, fully unit-tested
    extractCodes.ts   Finds booking codes + bookie in messy tipster posts
    commit.ts         Commit–reveal hashing for picks, slip identity for de-duplication
    settlement.ts     Won/lost/void settlement in units, CLV, "locked before kickoff" rule
    ranking.ts        Leaderboard: 100-pick minimum, ROI shrunk toward break-even, drawdown
    bookies/          Booking-code lookup per bookie, with caching and rate limiting
  src/services/       ingest (post → Spotted slip), picks (lock / present), settle
  src/telegram/       Reader-account login, slow channel joining, live listener
  src/routes/         REST API: picks, feed, follows, leaderboard, tipster profiles, channels
  src/jobs/settle.ts  Settles picks and spotted slips after games finish
```

## Run it

```bash
cd server
cp .env.example .env          # fill in MONGODB_URI etc.
npm install
npm test                      # 24 tests
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

## API (dev auth: send `x-user-id: <mongo user id>`)

| Method | Path | What |
|---|---|---|
| GET | `/health` | Status + bookies we can decode |
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

- [ ] **Auth:** replace dev `x-user-id` with Firebase phone auth (`src/middleware/auth.ts`).
- [ ] **SportyBet lookup:** confirm the share URL and response shape in browser dev tools (`src/core/bookies/sportybet.ts`). It's unofficial and will break, so plan to replace it with partner APIs.
- [ ] **More bookies:** Bet9ja, BetKing, MSport resolvers (each confirmed the same way).
- [ ] **Results feed:** pick a provider (API-Football to start) and implement `ResultsProvider` (`src/services/settle.ts`). Until then nothing settles.
- [ ] **On-chain anchoring** of pick commit hashes (batched Merkle root).
- [ ] **ID verification** (BVN/NIN via Smile ID / Dojah / Prembly) to set `idVerified`.
- [ ] **Subscriptions + escrow** for VIP picks, wallet (Paystack), responsible-gambling limits.
- [ ] **Rooms** (match chat): realtime service, moderation.
- [ ] Legal review of subscriptions and anything touching stakes.

## Mobile app

To be built with React Native / Expo in `app/`, from the design canvas.
