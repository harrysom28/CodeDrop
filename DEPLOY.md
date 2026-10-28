# Deploy (Dokploy on a VPS)

Same pattern as Keke Ride: one Compose stack, health checks, restart unless-stopped.

1. Copy `server/.env.example` to the host. Fill Mongo (managed), Redis, Firebase, Paystack, Telegram session. Never commit secrets.
2. Set `AUTH_MODE=firebase`, `NODE_ENV=production`, `SUBSCRIPTIONS_ENABLED=false` until legal review.
3. Point Dokploy at this repo. Services: `api`, `worker`, `listener`. Mongo/Redis on the VPS only for staging; production should use managed Mongo.
4. Health: `GET /health` — Dokploy should restart `api` if it fails. `worker` and `listener` have `restart: unless-stopped`.
5. Android: `eas build --profile preview` for internal APK; `--profile production` for Play.
