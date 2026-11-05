import { createHash } from 'node:crypto';
import { prisma } from '../config/database';
import { HttpError } from '../utils/http';
import { asyncHandler } from '../utils/http';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.melosis_session;
  if (typeof token !== 'string' || token.length < 40) throw new HttpError(401, 'Please sign in to continue.');
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  req.user = { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
  req.sessionId = session.id;
  void prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  next();
});
