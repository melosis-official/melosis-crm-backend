import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';
export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ success: false, message: 'The requested resource was not found.' }); };
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const detail = firstIssue ? `${firstIssue.path.length ? `${firstIssue.path.join('.')}: ` : ''}${firstIssue.message}` : '';
    res.status(400).json({
      success: false,
      message: detail ? `Validation error (${detail})` : 'Please check the submitted information.',
      errors: error.issues.map(x => ({ path: x.path.join('.'), message: x.message }))
    });
    return;
  }
  if (error instanceof HttpError) { res.status(error.status).json({ success: false, message: error.message, ...(error.details ? { errors: error.details } : {}) }); return; }
  if (error?.code === 'P2002') { res.status(409).json({ success: false, message: 'A record with those details already exists.' }); return; }
  console.error('Request failed. An internal error occurred.');
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
};
