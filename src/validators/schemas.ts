import { z } from 'zod';
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform(v => v || null);
export const leadSchema = z.object({
  instituteName: z.string().trim().min(1).max(180), ownerName: optionalText(160),
  mobileNumber: z.string().trim().min(5).max(40).refine(v=>v.replace(/\D/g,'').replace(/^0+/,'').length>=5,'Enter a valid mobile number.'), email: z.union([z.string().trim().email().max(254), z.literal('')]).optional().transform(v => v || null),
  location: optionalText(180), instituteType: z.enum(['COACHING_CENTRE','COMPUTER_INSTITUTE','COLLEGE','SCHOOL','OTHER']).default('OTHER'),
  source: z.enum(['COLD_CALLING','REFERRAL','WHATSAPP','WEBSITE','LINKEDIN','WALK_IN','OTHER']).default('OTHER'),
  remarks: optionalText(10000), hasBeenCalled: z.boolean().optional().default(false),
  onboardingStatus: z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED']).optional(), customerNotes: optionalText(10000),
});
export const statusSchema = z.object({ status: z.enum(['NEW','CONTACTED','INTERESTED','DEMO_SCHEDULED','PILOT','CUSTOMER','NOT_INTERESTED','LOST']) });
export const activitySchema = z.object({
  type: z.enum(['CALL','WHATSAPP','EMAIL','DEMO','MEETING','NOTE','OTHER']),
  outcome: z.enum(['NO_ANSWER','SPOKE_SUCCESSFULLY','INTERESTED','CALLBACK_REQUESTED','NOT_INTERESTED','WRONG_NUMBER','OTHER']).nullable().optional(),
  notes: z.string().trim().max(10000).optional().nullable(), occurredAt: z.coerce.date().optional(),
});
export const taskSchema = z.object({ title: z.string().trim().min(1).max(180), description: optionalText(10000), leadId: z.string().min(1),
  type: z.enum(['FOLLOW_UP','DEMO','ONBOARDING','OTHER']).default('FOLLOW_UP'), priority: z.enum(['LOW','MEDIUM','HIGH']).default('MEDIUM'),
  status: z.enum(['OPEN','COMPLETED','CANCELLED']).optional(), dueAt: z.coerce.date(),
});
export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(200),
  role: z.enum(['SUPERADMIN', 'USER']).default('USER'),
});
export const pagingSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(500).default(20),
  search: z.string().trim().max(180).optional(), status: z.enum(['NEW','CONTACTED','INTERESTED','DEMO_SCHEDULED','PILOT','CUSTOMER','NOT_INTERESTED','LOST']).optional(),
  instituteType: z.enum(['COACHING_CENTRE','COMPUTER_INSTITUTE','COLLEGE','SCHOOL','OTHER']).optional(),
  source: z.enum(['COLD_CALLING','REFERRAL','WHATSAPP','WEBSITE','LINKEDIN','WALK_IN','OTHER']).optional(),
  called: z.enum(['true','false']).optional(), sort: z.enum(['asc','desc']).default('desc'),
  includeArchived: z.enum(['true','false']).optional(),
  archived: z.enum(['true','false']).optional(),
  assignedToId: z.string().optional(),
});

export const assignLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'Select at least one lead.'),
  assignedToUserId: z.string().trim().nullable().optional().transform(v => (v === '' ? null : v)),
  targetUserId: z.string().trim().nullable().optional().transform(v => (v === '' ? null : v)),
  notes: z.string().trim().max(255).optional().nullable(),
});
