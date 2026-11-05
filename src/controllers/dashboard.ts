import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { asyncHandler, ok } from '../utils/http';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', asyncHandler(async (req, res) => {
  const isSuperadmin = req.user?.role === 'SUPERADMIN';
  const leadWhere: Prisma.LeadWhereInput = isSuperadmin ? { archivedAt: null } : { archivedAt: null, assignedToId: req.user!.id };
  const now = new Date();
  const [totalLeads, overdueFollowUps, pipeline] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.task.count({ where: { status: 'OPEN', dueAt: { lt: now }, lead: leadWhere } }),
    prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
  ]);
  const statusMap = Object.fromEntries(pipeline.map((x) => [x.status, x._count._all]));
  ok(res, {
    totalLeads,
    newLeads: statusMap['NEW'] ?? 0,
    contactedLeads: statusMap['CONTACTED'] ?? 0,
    interestedInstitutes: statusMap['INTERESTED'] ?? 0,
    demosScheduled: statusMap['DEMO_SCHEDULED'] ?? 0,
    inPilot: statusMap['PILOT'] ?? 0,
    customers: statusMap['CUSTOMER'] ?? 0,
    overdueFollowUps,
    pipeline: statusMap,
  });
}));

dashboardRouter.get('/follow-ups', asyncHandler(async (req, res) => {
  const isSuperadmin = req.user?.role === 'SUPERADMIN';
  const leadWhere: Prisma.LeadWhereInput = isSuperadmin ? { archivedAt: null } : { archivedAt: null, assignedToId: req.user!.id };
  const now = new Date();
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const tomorrow = new Date(day);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [today, overdue, upcoming] = await Promise.all([
    prisma.task.findMany({
      where: { status: 'OPEN', dueAt: { gte: now, lt: tomorrow }, lead: leadWhere },
      orderBy: { dueAt: 'asc' },
      include: { lead: { select: { id: true, instituteName: true, mobileNumber: true } } },
    }),
    prisma.task.findMany({
      where: { status: 'OPEN', dueAt: { lt: now }, lead: leadWhere },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: { lead: { select: { id: true, instituteName: true, mobileNumber: true } } },
    }),
    prisma.task.findMany({
      where: { status: 'OPEN', dueAt: { gte: tomorrow }, lead: leadWhere },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: { lead: { select: { id: true, instituteName: true, mobileNumber: true } } },
    }),
  ]);

  ok(res, { today, overdue, upcoming });
}));

dashboardRouter.get('/recent-activities', asyncHandler(async (req, res) => {
  const isSuperadmin = req.user?.role === 'SUPERADMIN';
  const leadWhere: Prisma.LeadWhereInput = isSuperadmin ? {} : { assignedToId: req.user!.id };
  const activities = await prisma.activity.findMany({
    where: { lead: leadWhere },
    orderBy: { occurredAt: 'desc' },
    take: 12,
    include: {
      lead: { select: { id: true, instituteName: true } },
      user: { select: { name: true } },
    },
  });
  ok(res, activities);
}));
