import type { Request, Response, NextFunction } from 'express';
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };
export const ok = (res: Response, data: unknown, message?: string, status = 200) =>
  res.status(status).json({ success: true, ...(message ? { message } : {}), data });
export const paramId = (req: Request) => {
  const value = req.params.id;
  if (typeof value !== 'string' || value.length === 0) throw new HttpError(400, 'Invalid resource identifier.');
  return value;
};
