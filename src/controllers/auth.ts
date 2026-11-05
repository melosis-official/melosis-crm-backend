import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { requireAuth, hashToken } from '../middleware/auth';
import { issueCsrf } from '../middleware/csrf';
import { requireCsrf } from '../middleware/csrf';
import { asyncHandler, HttpError, ok } from '../utils/http';

export const authRouter = Router();
const cookie = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: env.SESSION_TTL_DAYS * 86400000 };
const loginLimiterBody = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(200) });
authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginLimiterBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user?.isActive ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect.');
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86400000);
  await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
  res.cookie('melosis_session', token, { ...cookie, expires: expiresAt });
  ok(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Signed in.');
}));
authRouter.post('/logout', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  await prisma.session.delete({ where: { id: req.sessionId! } });
  res.clearCookie('melosis_session', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  ok(res, null, 'Signed out.');
}));
authRouter.get('/me', requireAuth, (req, res) => ok(res, { user: req.user }));
authRouter.get('/csrf', requireAuth, issueCsrf);
authRouter.post('/change-password', requireAuth, requireCsrf, asyncHandler(async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!await argon2.verify(user.passwordHash, input.currentPassword)) throw new HttpError(400, 'Current password is incorrect.');
  const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash } }), prisma.session.deleteMany({ where: { userId: user.id } })]);
  res.clearCookie('melosis_session', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  ok(res, null, 'Password changed. Please sign in again.');
}));
