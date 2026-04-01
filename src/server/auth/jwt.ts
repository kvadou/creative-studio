import jwt from 'jsonwebtoken';
import { config } from '../../lib/config.js';
import type { AuthUser } from './passport.js';

const JWT_EXPIRY = '7d';

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    config.jwtSecret,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser;
    return decoded;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = 'cs_auth';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};
