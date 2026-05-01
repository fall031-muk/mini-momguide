import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User } from '../../db/models/user.js';
import { HttpError } from '../../middleware/error-handler.js';
import { env } from '../../config/env.js';

export type AppJwtPayload = { sub: number; nickname: string };

const BCRYPT_ROUNDS = 10;

export async function signup(input: {
  email: string;
  password: string;
  nickname: string;
}) {
  const exists = await User.findOne({
    where: { email: input.email },
  });
  if (exists) throw new HttpError(409, 'Email already registered');

  const nicknameExists = await User.findOne({ where: { nickname: input.nickname } });
  if (nicknameExists) throw new HttpError(409, 'Nickname already taken');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await User.create({
    email: input.email,
    nickname: input.nickname,
    passwordHash,
  });

  return { user, token: signToken(user.id, user.nickname) };
}

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, 'Invalid credentials');

  return { user, token: signToken(user.id, user.nickname) };
}

function signToken(userId: number, nickname: string): string {
  const payload: AppJwtPayload = { sub: userId, nickname };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): AppJwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') throw new Error('Invalid token shape');
    return decoded as unknown as AppJwtPayload;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}
