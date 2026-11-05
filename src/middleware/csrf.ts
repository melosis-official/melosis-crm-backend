import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { prisma } from '../config/database';
import { HttpError, asyncHandler, ok } from '../utils/http';

export const issueCsrf = asyncHandler(async (req, res) => {
  const token = randomBytes(32).toString('base64url');
  await prisma.session.update({ where: { id: req.sessionId! }, data: { csrfTokenHash: createHash('sha256').update(token).digest('hex') } });
  ok(res, { csrfToken: token });
});
export const requireCsrf: RequestHandler = (req, _res, next) => {
  void (async () => {
    const supplied = req.get('x-csrf-token') || '';
    const hash = createHash('sha256').update(supplied).digest();
    const session = await prisma.session.findUnique({ where: { id: req.sessionId }, select: { csrfTokenHash: true } });
    if (!session?.csrfTokenHash) throw new HttpError(403, 'Request verification failed. Refresh and try again.');
    const expected = Buffer.from(session.csrfTokenHash, 'hex');
    if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) throw new HttpError(403, 'Request verification failed. Refresh and try again.');
    next();
  })().catch(next);
};
