import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { User } from '../models/index.js';

/**
 * ID verification. Never store raw BVN/NIN — only a provider reference and result.
 */
export interface IdVerifier {
  name: string;
  verify(input: {
    userId: string;
    idType: 'bvn' | 'nin';
    idNumber: string;
    selfieBase64?: string;
  }): Promise<{ providerRef: string; verified: boolean }>;
}

class NoneVerifier implements IdVerifier {
  name = 'none';
  async verify(): Promise<{ providerRef: string; verified: boolean }> {
    throw new HttpError(501, 'ID verification provider not configured');
  }
}

/** Stub Dojah/Smile adapters — real HTTP calls need credentials from Harrison. */
class StubVerifier implements IdVerifier {
  constructor(public name: 'dojah' | 'smile') {}
  async verify(input: { idType: 'bvn' | 'nin'; idNumber: string }) {
    // Hash the id so even logs/refs never echo the raw number.
    const digest = createHash('sha256').update(input.idNumber).digest('hex').slice(0, 16);
    return {
      providerRef: `${this.name}_${input.idType}_${digest}_${randomBytes(4).toString('hex')}`,
      verified: true,
    };
  }
}

export function buildIdVerifier(): IdVerifier {
  if (config.ID_VERIFIER === 'dojah') {
    if (!config.DOJAH_APP_ID || !config.DOJAH_SECRET_KEY) {
      throw new HttpError(501, 'Dojah credentials missing — see TODO_HARRISON.md');
    }
    return new StubVerifier('dojah');
  }
  if (config.ID_VERIFIER === 'smile') {
    if (!config.SMILE_API_KEY || !config.SMILE_PARTNER_ID) {
      throw new HttpError(501, 'Smile ID credentials missing — see TODO_HARRISON.md');
    }
    return new StubVerifier('smile');
  }
  return new NoneVerifier();
}

export async function verifyUserId(input: {
  userId: string;
  idType: 'bvn' | 'nin';
  idNumber: string;
  selfieBase64?: string;
}) {
  const verifier = buildIdVerifier();
  const result = await verifier.verify(input);
  if (!result.verified) throw new HttpError(422, 'ID verification failed');
  await User.updateOne(
    { _id: input.userId },
    {
      $set: {
        idVerified: true,
        idProvider: verifier.name,
        idProviderRef: result.providerRef,
      },
    },
  );
  return { idVerified: true, provider: verifier.name, providerRef: result.providerRef };
}
