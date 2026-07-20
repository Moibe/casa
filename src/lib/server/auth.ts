import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { sessions, users } from './db/schema';

export const SESSION_COOKIE = 'casa_session';

export type SessionUser = { id: string; email: string };

// Cookie "para siempre" (~10 años); local http => secure:false.
export const sessionCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: false,
  maxAge: 60 * 60 * 24 * 365 * 10
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSession(userId: string): string {
  const id = randomBytes(24).toString('hex');
  db.insert(sessions).values({ id, userId, createdAt: Date.now() }).run();
  return id;
}

export function validateSession(sessionId: string): SessionUser | null {
  const row = db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get();
  return row ?? null;
}

export function invalidateSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}
