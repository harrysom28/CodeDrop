import { createRequire } from 'node:module';
import { config } from '../config.js';
import type { AuthIdentity } from './users.js';

/**
 * Verifies a Firebase ID token. Lazy-loads firebase-admin so AUTH_MODE=dev
 * never needs credentials. Tests inject a fake verifier via setTokenVerifier.
 */

export type TokenVerifier = (idToken: string) => Promise<AuthIdentity>;

let injected: TokenVerifier | undefined;
let initialized = false;

export function setTokenVerifier(verifier: TokenVerifier | undefined) {
  injected = verifier;
}

interface AdminSdk {
  apps: unknown[];
  initializeApp: (options?: Record<string, unknown>, name?: string) => unknown;
  credential: {
    cert: (serviceAccount: object | string) => unknown;
    applicationDefault: () => unknown;
  };
  auth: () => { verifyIdToken: (token: string) => Promise<{ uid: string; phone_number?: string }> };
}

async function defaultFirebaseVerifier(idToken: string): Promise<AuthIdentity> {
  const require = createRequire(import.meta.url);
  const admin = require('firebase-admin') as AdminSdk;

  if (!initialized) {
    if (!admin.apps.length) {
      if (config.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const cred = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON) as object;
        admin.initializeApp({ credential: admin.credential.cert(cred) });
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: config.FIREBASE_PROJECT_ID,
        });
      }
    }
    initialized = true;
  }
  const decoded = await admin.auth().verifyIdToken(idToken);
  return { firebaseUid: decoded.uid, phone: decoded.phone_number };
}

export function getTokenVerifier(): TokenVerifier {
  return injected ?? defaultFirebaseVerifier;
}
