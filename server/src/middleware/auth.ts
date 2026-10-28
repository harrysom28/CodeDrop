import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authMode, config } from '../config.js';
import { HttpError } from '../errors.js';
import { getTokenVerifier } from '../services/firebaseAuth.js';
import { upsertFirebaseUser } from '../services/users.js';

export { HttpError };

declare module 'express-serve-static-core' {
  interface Request {
    userId?: Types.ObjectId;
  }
}

/**
 * Populates req.userId when a credential is present.
 * - AUTH_MODE=dev: trusts `x-user-id` (refused in production).
 * - AUTH_MODE=firebase: verifies Bearer ID token and upserts the User.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    if (authMode() === 'firebase') {
      const header = req.header('authorization');
      if (!header?.startsWith('Bearer ')) return next();
      const token = header.slice('Bearer '.length).trim();
      if (!token) return next();
      try {
        const identity = await getTokenVerifier()(token);
        req.userId = await upsertFirebaseUser(identity);
      } catch {
        return next(new HttpError(401, 'Invalid or expired token'));
      }
      return next();
    }

    if (config.NODE_ENV === 'production') {
      return next(new HttpError(500, 'AUTH_MODE=dev is not allowed in production'));
    }
    const id = req.header('x-user-id');
    if (id && Types.ObjectId.isValid(id)) req.userId = new Types.ObjectId(id);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(new HttpError(401, 'Sign in required'));
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId || !config.ADMIN_USER_IDS.includes(req.userId.toString())) {
    return next(new HttpError(403, 'Admins only'));
  }
  next();
}
