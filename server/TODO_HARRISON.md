# Blocked on Harrison

Items that need a credential, a human decision, or a captured response before they can go live. Do not invent endpoints or keys to unblock these.

## Auth / Firebase
- [ ] Firebase project for CodeDrop (phone auth enabled for NG).
- [ ] Service-account JSON (or ADC) on the API host. Set `AUTH_MODE=firebase`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` (or `FIREBASE_SERVICE_ACCOUNT_JSON`).
- [ ] Confirm the same Firebase project will be used by the Expo app (`@react-native-firebase/auth`). Needs `google-services.json` / `GoogleService-Info.plist` on EAS (not in git). Dev app uses `POST /dev/login` until that build exists.

## Bookie resolvers
- [ ] **SportyBet:** probe from this host got **HTTP 403 CloudFront**. Need a browser Network capture into `server/fixtures/sportybet-<CODE>.json`.
- [ ] **Bet9ja, BetKing, MSport:** same capture + share URLs. Stubs stay behind `ENABLED_BOOKIES`.
- [ ] Convert: no bookie can mint a target booking code yet — need partner create-code APIs.

## Results
- [ ] API-Football / api-sports.io key (`API_FOOTBALL_KEY`).

## Payments / subscriptions
- [ ] Paystack secret + webhook secret. Prefer verifying webhooks against the **raw** request body (may need `express.json` verify callback).
- [ ] Paystack transfer recipient + account-name resolution for withdrawals.
- [ ] **Legal review of tipster subscriptions** before `SUBSCRIPTIONS_ENABLED=true`.

## ID verification
- [ ] Choose Dojah vs Smile ID; set `ID_VERIFIER` + keys. Current adapters are stubs that refuse without credentials and never store raw BVN/NIN.

## Anchoring
- [ ] Base L2 RPC (`ANCHOR_RPC_URL`) + hot-wallet key (`ANCHOR_PRIVATE_KEY`). Merkle roots/proofs work offline; on-chain write is behind `ANCHORING_ENABLED`.
