import argon2 from 'argon2';
import { Router } from 'express';
import { prisma } from '../config/database';
import { requireSuperadmin } from '../middleware/permissions';
import { createUserSchema } from '../validators/schemas';
import { asyncHandler, HttpError, ok, paramId } from '../utils/http';

import { env } from '../config/env';
import { sendWelcomeUserEmail } from '../services/email';

export const usersRouter = Router();
usersRouter.use(requireSuperadmin);

usersRouter.get('/', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
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
    data: { name: input.name, email: input.email, passwordHash, role: input.role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
  });

  // Automatically dispatch welcome email with login credentials via SMTP
  const emailResult = await sendWelcomeUserEmail({
    name: input.name,
    email: input.email,
    temporaryPassword: input.password,
    websiteUrl: env.FRONTEND_ORIGIN,
  });

  const responseMessage = emailResult.success
    ? `User created and credentials email sent to ${user.email}.`
    : `User created. (Warning: Email delivery failed: ${emailResult.error || 'SMTP delivery error'})`;

  ok(res, { user, emailSent: emailResult.success }, responseMessage, 201);
}));

usersRouter.post('/test-email', asyncHandler(async (req, res) => {
  const targetEmail = req.body?.email || req.user?.email;
  if (!targetEmail) throw new HttpError(400, 'Target email address is required.');

  const result = await sendWelcomeUserEmail({
    name: req.body?.name || 'Admin Tester',
    email: targetEmail,
    temporaryPassword: 'TestTemporaryPassword#123',
    websiteUrl: env.FRONTEND_ORIGIN,
  });

  if (!result.success) {
    throw new HttpError(500, `SMTP Test failed: ${result.error}`);
  }

  ok(res, { result }, `Test email sent successfully to ${targetEmail}.`);
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
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    await transaction.session.deleteMany({ where: { userId: id } });
    return deactivated;
  }, { isolationLevel: 'Serializable' });

  ok(res, { user }, 'User deleted.');
}));
