import { Types } from 'mongoose';
import { HttpError } from '../errors.js';
import { User } from '../models/index.js';

export interface AuthIdentity {
  firebaseUid: string;
  phone?: string;
}

/** Find or create the Mongo user for a verified Firebase identity. */
export async function upsertFirebaseUser(identity: AuthIdentity): Promise<Types.ObjectId> {
  const existing = await User.findOne({ firebaseUid: identity.firebaseUid });
  if (existing) {
    if (identity.phone && existing.phone !== identity.phone) {
      existing.phone = identity.phone;
      await existing.save();
    }
    return existing._id;
  }

  if (identity.phone) {
    const byPhone = await User.findOne({ phone: identity.phone });
    if (byPhone) {
      byPhone.firebaseUid = identity.firebaseUid;
      await byPhone.save();
      return byPhone._id;
    }
  }

  const created = await User.create({
    firebaseUid: identity.firebaseUid,
    phone: identity.phone,
  });
  return created._id;
}

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertValidHandle(handle: string) {
  if (!HANDLE_RE.test(handle)) {
    throw new HttpError(400, 'Handle must be 3–20 characters: lowercase letters, digits, underscore');
  }
}

export function presentUser(user: {
  _id: Types.ObjectId;
  firebaseUid?: string | null;
  phone?: string | null;
  handle?: string | null;
  displayName?: string | null;
  role: string;
  idVerified: boolean;
  over18Confirmed: boolean;
  mainBookie?: string | null;
  favouriteBookies?: string[] | null;
  favouriteClubs?: string[] | null;
  unitNaira?: number | null;
  onboardedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: user._id.toString(),
    phone: user.phone ?? null,
    handle: user.handle ?? null,
    displayName: user.displayName ?? null,
    role: user.role,
    idVerified: user.idVerified,
    over18Confirmed: user.over18Confirmed,
    mainBookie: user.mainBookie ?? null,
    favouriteBookies:
      user.favouriteBookies && user.favouriteBookies.length
        ? user.favouriteBookies
        : user.mainBookie
          ? [user.mainBookie]
          : [],
    favouriteClubs: user.favouriteClubs ?? [],
    unitNaira: user.unitNaira ?? 1000,
    onboardedAt: user.onboardedAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
