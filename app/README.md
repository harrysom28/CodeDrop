# CodeDrop Android app

Expo SDK 58, expo-router, dark theme only. Use **Node 22.13+ / 24.3+ / 26+** (not Node 25 — outside Expo’s engine range).

```bash
cp .env.example .env
npm ci
npx expo start
```

Point `EXPO_PUBLIC_API_URL` at the machine running `server` (`npm run dev`). Physical devices cannot use `127.0.0.1` — use your LAN IP.

Firebase phone auth: add `@react-native-firebase/app` + `auth` and run `eas build --profile development`. Until then, `POST /dev/login` issues an `x-user-id` session.
