import { HttpError } from '../utils/http';
import { asyncHandler } from '../utils/http';

export const requireSuperadmin = asyncHandler(async (req, _res, next) => {
  if (req.user?.role !== 'SUPERADMIN') throw new HttpError(403, 'Superadmin access is required.');
  next();
});
