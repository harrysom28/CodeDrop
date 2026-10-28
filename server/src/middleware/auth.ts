import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { config } from '../config.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: Types.ObjectId;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * DEV ONLY: trusts the `x-user-id` header so the app can be built against the API today.
 * Before any real user touches this, switch AUTH_MODE to "firebase" and verify Firebase phone-auth
 * ID tokens here (same Firebase setup as Keke Ride).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  if (config.AUTH_MODE === 'firebase') {
    return next(new HttpError(501, 'Firebase auth not wired yet'));
  }
  if (config.NODE_ENV === 'production') {
    return next(new HttpError(500, 'AUTH_MODE=dev is not allowed in production'));
  }
  const id = req.header('x-user-id');
  if (id && Types.ObjectId.isValid(id)) req.userId = new Types.ObjectId(id);
  next();
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
