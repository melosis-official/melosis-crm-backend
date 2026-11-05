import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { asyncHandler, HttpError, ok, paramId } from '../utils/http';
import { activitySchema, assignLeadsSchema, leadSchema, pagingSchema, statusSchema } from '../validators/schemas';
import { normalizeMobile, publicLeadSelect } from '../utils/lead';
import { requireSuperadmin } from '../middleware/permissions';

export const leadsRouter = Router();

// ---------------------------------------------------------------------------
// LEAD ASSIGNMENT ENDPOINTS (SUPERADMIN ONLY)
// Note: Must be registered before parameterized routes like /:id
// ---------------------------------------------------------------------------

leadsRouter.post('/assign', requireSuperadmin, asyncHandler(async (req, res) => {
  const input = assignLeadsSchema.parse(req.body);
  const targetUserId = input.assignedToUserId !== undefined ? input.assignedToUserId : input.targetUserId;
  let targetUser = null;
  if (targetUserId) {
    targetUser = await prisma.user.findFirst({ where: { id: targetUserId, isActive: true } });
    if (!targetUser) throw new HttpError(404, 'Target team user not found or inactive.');
    if (targetUser.role === 'SUPERADMIN') {
      throw new HttpError(400, 'Leads cannot be assigned to Superadmin accounts. Please select a sales representative.');
    }
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: input.leadIds }, archivedAt: null },
    select: { id: true, instituteName: true, assignedToId: true }
  });
  if (!leads.length) throw new HttpError(404, 'No active leads found for assignment.');

  await prisma.$transaction(async tx => {
    await tx.lead.updateMany({
      where: { id: { in: leads.map(l => l.id) } },
      data: { assignedToId: targetUserId }
    });

    for (const lead of leads) {
      await tx.leadAssignmentHistory.create({
        data: {
          leadId: lead.id,
          previousUserId: lead.assignedToId,
          assignedToUserId: targetUserId,
          assignedByUserId: req.user!.id,
          notes: input.notes || null,
        }
      });

      await tx.activity.create({
        data: {
          leadId: lead.id,
          userId: req.user!.id,
          type: 'OTHER',
          notes: targetUser
            ? `Lead assigned to ${targetUser.name} (${targetUser.email}) by ${req.user!.name}.${input.notes ? ` Note: ${input.notes}` : ''}`
            : `Lead unassigned by ${req.user!.name}.${input.notes ? ` Note: ${input.notes}` : ''}`,
        }
      });
    }
  });

  const msg = targetUser
    ? `Successfully assigned ${leads.length} lead(s) to ${targetUser.name}.`
    : `Successfully unassigned ${leads.length} lead(s).`;
  ok(res, { count: leads.length, assignedTo: targetUser }, msg);
}));

leadsRouter.get('/assignment-history', requireSuperadmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const leadId = typeof req.query.leadId === 'string' && req.query.leadId ? req.query.leadId : undefined;
  const userId = typeof req.query.userId === 'string' && req.query.userId !== 'all' && req.query.userId ? req.query.userId : undefined;
  const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;

  const andConditions: Prisma.LeadAssignmentHistoryWhereInput[] = [];

  if (leadId) andConditions.push({ leadId });

  if (userId) {
    andConditions.push({
      OR: [
        { assignedToUserId: userId },
        { previousUserId: userId }
      ]
    });
  }

  if (search) {
    andConditions.push({
      OR: [
        { assignedToUser: { name: { contains: search } } },
        { assignedToUser: { email: { contains: search } } },
        { previousUser: { name: { contains: search } } },
        { previousUser: { email: { contains: search } } },
        { lead: { instituteName: { contains: search } } },
        { notes: { contains: search } }
      ]
    });
  }

  const where: Prisma.LeadAssignmentHistoryWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, items] = await Promise.all([
    prisma.leadAssignmentHistory.count({ where }),
    prisma.leadAssignmentHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lead: { select: { id: true, instituteName: true, mobileNumber: true } },
        previousUser: { select: { id: true, name: true, email: true } },
        assignedToUser: { select: { id: true, name: true, email: true } },
        assignedByUser: { select: { id: true, name: true, email: true } },
      }
    })
  ]);

  ok(res, {
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}));

leadsRouter.get('/assignment-stats', requireSuperadmin, asyncHandler(async (_req, res) => {
  const [totalLeads, assignedLeads, unassignedLeads, users, groupedAssignments] = await Promise.all([
    prisma.lead.count({ where: { archivedAt: null } }),
    prisma.lead.count({ where: { archivedAt: null, assignedToId: { not: null } } }),
    prisma.lead.count({ where: { archivedAt: null, assignedToId: null } }),
    prisma.user.findMany({
      where: { isActive: true, role: { not: 'SUPERADMIN' } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' }
    }),
    prisma.lead.groupBy({
      by: ['assignedToId'],
      where: { archivedAt: null, assignedToId: { not: null } },
      _count: { _all: true }
    })
  ]);

  const countMap = new Map<string, number>();
  for (const g of groupedAssignments) {
    if (g.assignedToId) countMap.set(g.assignedToId, g._count._all);
  }

  const userDistribution = users.map(u => ({
    user: u,
    count: countMap.get(u.id) || 0
  }));

  ok(res, {
    totalLeads,
    assignedLeads,
    unassignedLeads,
    userDistribution
  });
}));

// ---------------------------------------------------------------------------
// STANDARD DIRECTORY & CRUD (WITH USER-TO-USER DATA ISOLATION)
// ---------------------------------------------------------------------------

leadsRouter.get('/', asyncHandler(async (req, res) => {
  const q = pagingSchema.parse(req.query);
  const isArchivedOnly = q.archived === 'true';
  const isSuperadmin = req.user?.role === 'SUPERADMIN';

  const where: Prisma.LeadWhereInput = {
    archivedAt: isArchivedOnly ? { not: null } : q.includeArchived === 'true' ? undefined : null
  };

  // User-to-User Lead Isolation:
  // Normal staff users can ONLY view leads assigned to them.
  if (!isSuperadmin) {
    where.assignedToId = req.user!.id;
  } else if (q.assignedToId) {
    if (q.assignedToId === 'unassigned') {
      where.assignedToId = null;
    } else if (q.assignedToId !== 'all') {
      where.assignedToId = q.assignedToId;
    }
  }

  if (q.status) where.status = q.status;
  if (q.instituteType) where.instituteType = q.instituteType;
  if (q.source) where.source = q.source;
  if (q.called) where.hasBeenCalled = q.called === 'true';
  if (q.search) where.OR = ['instituteName', 'ownerName', 'mobileNumber', 'location'].map(k => ({ [k]: { contains: q.search } }));

  const countWhereBase = isSuperadmin ? {} : { assignedToId: req.user!.id };

  const [total, items, activeCount, archivedCount] = await prisma.$transaction([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      select: { ...publicLeadSelect, tasks: { where: { status: 'OPEN' }, orderBy: { dueAt: 'asc' }, take: 1, select: { dueAt: true } } },
      orderBy: isArchivedOnly ? { archivedAt: 'desc' } : { createdAt: q.sort },
      skip: (q.page - 1) * q.limit,
      take: q.limit
    }),
    prisma.lead.count({ where: { ...countWhereBase, archivedAt: null } }),
    prisma.lead.count({ where: { ...countWhereBase, archivedAt: { not: null } } }),
  ]);

  ok(res, {
    data: items.map(({ tasks, ...lead }) => ({ ...lead, nextFollowUp: tasks[0]?.dueAt ?? null })),
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    counts: { active: activeCount, archived: archivedCount }
  });
}));

leadsRouter.post('/', requireSuperadmin, asyncHandler(async (req, res) => {
  const input = leadSchema.parse(req.body);
  const normalizedMobileNumber = normalizeMobile(input.mobileNumber);
  if (!normalizedMobileNumber) throw new HttpError(400, 'Enter a valid mobile number.');

  const duplicates = await prisma.lead.findMany({
    where: { normalizedMobileNumber, archivedAt: null },
    select: { id: true, instituteName: true },
    take: 5
  });

  // If created by regular user, automatically assign to them. If created by superadmin, unassigned by default.
  const assignedToId = req.user?.role === 'USER' ? req.user.id : null;

  const lead = await prisma.$transaction(async tx => {
    const created = await tx.lead.create({
      data: {
        ...input,
        normalizedMobileNumber,
        createdById: req.user!.id,
        assignedToId,
      },
      select: publicLeadSelect
    });
    await tx.activity.create({
      data: {
        leadId: created.id,
        userId: req.user!.id,
        type: 'OTHER',
        notes: assignedToId ? `Lead created and self-assigned.` : 'Lead created (unassigned pool).'
      }
    });
    return created;
  });

  ok(res, { lead, duplicateWarning: duplicates.length ? duplicates : [] }, 'Lead created.', 201);
}));

leadsRouter.get('/:id', asyncHandler(async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: paramId(req) },
    select: {
      ...publicLeadSelect,
      tasks: { where: { status: 'OPEN' }, orderBy: { dueAt: 'asc' }, take: 1, select: { dueAt: true } }
    }
  });
  if (!lead) throw new HttpError(404, 'Lead not found.');

  // User Isolation Verification
  if (req.user?.role !== 'SUPERADMIN' && lead.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have access to view this lead.');
  }

  const { tasks, ...rest } = lead;
  ok(res, { ...rest, nextFollowUp: tasks[0]?.dueAt ?? null });
}));

leadsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const id = paramId(req);
  const exists = await prisma.lead.findFirst({ where: { id, archivedAt: null } });
  if (!exists) throw new HttpError(404, 'Lead not found.');

  // User Isolation Verification
  if (req.user?.role !== 'SUPERADMIN' && exists.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have access to edit this lead.');
  }

  const input = leadSchema.partial().parse(req.body);
  const data = { ...input, ...(input.mobileNumber ? { normalizedMobileNumber: normalizeMobile(input.mobileNumber) } : {}) };

  const lead = await prisma.lead.update({ where: { id }, data, select: publicLeadSelect });
  const duplicates = input.mobileNumber
    ? await prisma.lead.findMany({
        where: { id: { not: lead.id }, normalizedMobileNumber: normalizeMobile(input.mobileNumber), archivedAt: null },
        select: { id: true, instituteName: true },
        take: 5
      })
    : [];

  ok(res, { lead, duplicateWarning: duplicates });
}));

leadsRouter.post('/:id/archive', asyncHandler(async (req, res) => {
  const id = paramId(req);
  const exists = await prisma.lead.findFirst({ where: { id, archivedAt: null } });
  if (!exists) throw new HttpError(404, 'Lead not found.');

  if (req.user?.role !== 'SUPERADMIN' && exists.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have permission to archive this lead.');
  }

  await prisma.lead.update({ where: { id }, data: { archivedAt: new Date() } });
  ok(res, null, 'Lead archived.');
}));

leadsRouter.post('/:id/restore', asyncHandler(async (req, res) => {
  const id = paramId(req);
  const exists = await prisma.lead.findFirst({ where: { id, archivedAt: { not: null } } });
  if (!exists) throw new HttpError(404, 'Archived lead not found.');

  if (req.user?.role !== 'SUPERADMIN' && exists.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have permission to restore this lead.');
  }

  await prisma.lead.update({ where: { id }, data: { archivedAt: null } });
  await prisma.activity.create({ data: { leadId: id, userId: req.user!.id, type: 'OTHER', notes: 'Lead restored from archive.' } });
  ok(res, null, 'Lead restored to active directory.');
}));

leadsRouter.delete('/:id', requireSuperadmin, asyncHandler(async (req, res) => {
  const id = paramId(req);
  const exists = await prisma.lead.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'Lead not found.');

  await prisma.$transaction([
    prisma.leadAssignmentHistory.deleteMany({ where: { leadId: id } }),
    prisma.activity.deleteMany({ where: { leadId: id } }),
    prisma.task.deleteMany({ where: { leadId: id } }),
    prisma.lead.delete({ where: { id } })
  ]);
  ok(res, null, 'Lead permanently deleted.');
}));

leadsRouter.patch('/:id/status', asyncHandler(async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const previous = await prisma.lead.findFirst({ where: { id: paramId(req), archivedAt: null } });
  if (!previous) throw new HttpError(404, 'Lead not found.');

  if (req.user?.role !== 'SUPERADMIN' && previous.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have access to update status for this lead.');
  }

  const lead = await prisma.$transaction(async tx => {
    const updated = await tx.lead.update({
      where: { id: previous.id },
      data: { status, ...(status === 'CUSTOMER' && !previous.convertedAt ? { convertedAt: new Date() } : {}) },
      select: publicLeadSelect
    });
    await tx.activity.create({
      data: {
        leadId: previous.id,
        userId: req.user!.id,
        type: 'STATUS_CHANGE',
        notes: `Status changed from ${previous.status} to ${status}.`
      }
    });
    return updated;
  });
  ok(res, lead, 'Status updated.');
}));

leadsRouter.get('/:id/activities', asyncHandler(async (req, res) => {
  const lead = await prisma.lead.findUnique({ where: { id: paramId(req) }, select: { id: true, assignedToId: true } });
  if (!lead) throw new HttpError(404, 'Lead not found.');

  if (req.user?.role !== 'SUPERADMIN' && lead.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have access to view activities for this lead.');
  }

  const items = await prisma.activity.findMany({
    where: { leadId: lead.id },
    orderBy: { occurredAt: 'desc' },
    take: 200,
    select: { id: true, type: true, outcome: true, notes: true, occurredAt: true, createdAt: true, user: { select: { name: true } } }
  });
  ok(res, items);
}));

leadsRouter.post('/:id/activities', asyncHandler(async (req, res) => {
  const input = activitySchema.parse(req.body);
  const lead = await prisma.lead.findFirst({ where: { id: paramId(req), archivedAt: null }, select: { id: true, assignedToId: true } });
  if (!lead) throw new HttpError(404, 'Lead not found.');

  if (req.user?.role !== 'SUPERADMIN' && lead.assignedToId !== req.user?.id) {
    throw new HttpError(403, 'You do not have access to log activity for this lead.');
  }

  const activity = await prisma.$transaction(async tx => {
    const created = await tx.activity.create({
      data: { ...input, leadId: lead.id, userId: req.user!.id },
      include: { user: { select: { name: true } } }
    });
    if (input.type === 'CALL') await tx.lead.update({ where: { id: lead.id }, data: { hasBeenCalled: true } });
    return created;
  });
  ok(res, activity, 'Activity logged.', 201);
}));
