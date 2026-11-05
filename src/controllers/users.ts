import argon2 from 'argon2';
import { Router } from 'express';
import { prisma } from '../config/database';
import { requireSuperadmin } from '../middleware/permissions';
import { createUserSchema } from '../validators/schemas';
import { asyncHandler, HttpError, ok, paramId } from '../utils/http';

export const usersRouter = Router();
usersRouter.use(requireSuperadmin);

usersRouter.get('/', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  ok(res, { users });
}));

usersRouter.post('/', asyncHandler(async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash, role: 'USER' },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  ok(res, { user }, 'User created.', 201);
}));

usersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = paramId(req);
  if (id === req.user?.id) throw new HttpError(400, 'You cannot delete your own account.');

  const user = await prisma.$transaction(async transaction => {
    const target = await transaction.user.findUnique({ where: { id } });
    if (!target) throw new HttpError(404, 'User not found.');

    if (target.role === 'SUPERADMIN' && target.isActive) {
      const activeSuperadmins = await transaction.user.count({
        where: { role: 'SUPERADMIN', isActive: true },
      });
      if (activeSuperadmins <= 1) {
        throw new HttpError(409, 'The last active superadmin cannot be deleted.');
      }
    }

    const deactivated = await transaction.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    await transaction.session.deleteMany({ where: { userId: id } });
    return deactivated;
  }, { isolationLevel: 'Serializable' });

  ok(res, { user }, 'User deleted.');
}));
