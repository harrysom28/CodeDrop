# Blocked on Harrison

Items that need a credential, a human decision, or a captured response before they can go live. Do not invent endpoints or keys to unblock these.

## Auth / Firebase
- [ ] Firebase project for CodeDrop (phone auth enabled for NG).
- [ ] Service-account JSON (or ADC) on the API host. Set `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).
- [ ] Confirm the same Firebase project will be used by the Expo app (`@react-native-firebase/auth`).

## Bookie resolvers
- [ ] **SportyBet:** `npm run bookie:probe -- sportybet <CODE>` from this machine got **HTTP 403 CloudFront** (`Request blocked`). Need a saved response from a real browser on sportybet.com → Load Code → DevTools → Network → copy response JSON into `server/fixtures/sportybet-<CODE>.json`. Then we tighten the zod schema and add a fixture test.
- [ ] **Bet9ja, BetKing, MSport:** same capture. Stub resolvers exist behind `ENABLED_BOOKIES` + `BET9JA_SHARE_URL` / `BETKING_SHARE_URL` / `MSPORT_SHARE_URL`, but they are not enabled and have no verified URL. `POST /convert` returns per-leg availability once a target catalogue exists; no bookie can mint a converted code yet — need partner APIs or create-code endpoints.
- [ ] Decision: keep unofficial share URLs or wait for partner APIs before production.

## Results
- [ ] API-Football / api-sports.io key (`API_FOOTBALL_KEY`). Provider + market mapper are wired; without the key the worker keeps legs pending. Closing odds for CLV come only from our own pre-kickoff bookie snapshots — API-Football odds-at-close is a paid add-on we are not guessing.

## Payments / ID / anchoring
- [ ] Paystack secret + webhook secret (Phase 1.8).
- [ ] Dojah or Smile ID choice + API keys (Phase 1.9).
- [ ] Legal review of tipster subscriptions before `SUBSCRIPTIONS_ENABLED=true`.
- [ ] Base L2 RPC + hot-wallet private key for Merkle anchoring (Phase 1.10).
