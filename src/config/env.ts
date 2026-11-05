import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(90).default(14),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});
export const env = schema.parse(process.env);
