import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(90).default(14),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),

  // Email SMTP Configuration
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default('false')
    .transform(v => v === true || v === 'true'),
  EMAIL_USER: z.string().default('noreply.melosis@gmail.com'),
  EMAIL_PASSWORD: z.string().default('pgaz tudn okaa fnxo'),
  EMAIL_FROM: z.string().default('noreply.melosis@gmail.com'),
  EMAIL_FROM_NAME: z.string().default('Melosis CRM'),
});
export const env = schema.parse(process.env);
