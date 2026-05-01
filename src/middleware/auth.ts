import type { Request, Response, NextFunction } from 'express';
import { HttpError } from './error-handler.js';
import { verifyToken } from '../modules/auth/auth.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: number; nickname: string };
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new HttpError(401, 'Missing Authorization header');
  }
  const token = header.slice(7).trim();
  if (!token) throw new HttpError(401, 'Missing bearer token');

  const payload = verifyToken(token);
  req.user = { id: payload.sub, nickname: payload.nickname };
  next();
}
