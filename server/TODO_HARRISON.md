# Blocked on Harrison

Items that need a credential, a human decision, or a captured response before they can go live. Do not invent endpoints or keys to unblock these.

## Auth / Firebase
- [ ] Firebase project for CodeDrop (phone auth enabled for NG).
- [ ] Service-account JSON (or ADC) on the API host. Set `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).
- [ ] Confirm the same Firebase project will be used by the Expo app (`@react-native-firebase/auth`).

## Bookie resolvers
- [ ] SportyBet: confirm share URL + response shape (or drop a saved Network response into `server/fixtures/`). Schema in `src/core/bookies/sportybet.ts` is still unverified.
- [ ] Bet9ja, BetKing, MSport: same — Load Code in browser → DevTools → Network → save response. Until then they stay behind `ENABLED_BOOKIES`.

## Results
- [ ] API-Football key (`API_FOOTBALL_KEY`) once Phase 1.3 lands.

## Payments / ID / anchoring
- [ ] Paystack secret + webhook secret (Phase 1.8).
- [ ] Dojah or Smile ID choice + API keys (Phase 1.9).
- [ ] Legal review of tipster subscriptions before `SUBSCRIPTIONS_ENABLED=true`.
- [ ] Base L2 RPC + hot-wallet private key for Merkle anchoring (Phase 1.10).
