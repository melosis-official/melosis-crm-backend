import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { asyncHandler, HttpError, ok, paramId } from '../utils/http';
import { activitySchema, leadSchema, pagingSchema, statusSchema } from '../validators/schemas';
import { normalizeMobile, publicLeadSelect } from '../utils/lead';

export const leadsRouter = Router();
leadsRouter.get('/', asyncHandler(async (req, res) => {
  const q = pagingSchema.parse(req.query);
  const isArchivedOnly = q.archived === 'true';
  const where: Prisma.LeadWhereInput = {
    archivedAt: isArchivedOnly ? { not: null } : q.includeArchived === 'true' ? undefined : null
  };
  if (q.status) where.status = q.status;
  if (q.instituteType) where.instituteType = q.instituteType;
  if (q.source) where.source = q.source;
  if (q.called) where.hasBeenCalled = q.called === 'true';
  if (q.search) where.OR = ['instituteName','ownerName','mobileNumber','location'].map(k => ({ [k]: { contains: q.search } }));
  const [total, items, activeCount, archivedCount] = await prisma.$transaction([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      select: { ...publicLeadSelect, tasks: { where: { status: 'OPEN' }, orderBy: { dueAt: 'asc' }, take: 1, select: { dueAt: true } } },
      orderBy: isArchivedOnly ? { archivedAt: 'desc' } : { createdAt: q.sort },
      skip: (q.page - 1) * q.limit,
      take: q.limit
    }),
    prisma.lead.count({ where: { archivedAt: null } }),
    prisma.lead.count({ where: { archivedAt: { not: null } } }),
  ]);
  ok(res, {
    data: items.map(({ tasks, ...lead }) => ({ ...lead, nextFollowUp: tasks[0]?.dueAt ?? null })),
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    counts: { active: activeCount, archived: archivedCount }
  });
}));
leadsRouter.post('/', asyncHandler(async (req, res) => {
  const input = leadSchema.parse(req.body); const normalizedMobileNumber = normalizeMobile(input.mobileNumber);
  if (!normalizedMobileNumber) throw new HttpError(400, 'Enter a valid mobile number.');
  const duplicates = await prisma.lead.findMany({ where: { normalizedMobileNumber, archivedAt: null }, select: { id:true, instituteName:true }, take:5 });
  const lead = await prisma.$transaction(async tx=>{
    const created=await tx.lead.create({ data: { ...input, normalizedMobileNumber, createdById:req.user!.id }, select:publicLeadSelect });
    await tx.activity.create({data:{leadId:created.id,userId:req.user!.id,type:'OTHER',notes:'Lead created.'}});return created;
  });
  ok(res, { lead, duplicateWarning: duplicates.length ? duplicates : [] }, 'Lead created.', 201);
}));
leadsRouter.get('/:id', asyncHandler(async (req,res) => {
  const lead = await prisma.lead.findUnique({ where:{ id:paramId(req) }, select:{ ...publicLeadSelect, tasks:{ where:{status:'OPEN'},orderBy:{dueAt:'asc'},take:1,select:{dueAt:true} } } });
  if(!lead) throw new HttpError(404,'Lead not found.'); const {tasks,...rest}=lead;
  ok(res,{...rest,nextFollowUp:tasks[0]?.dueAt ?? null});
}));
leadsRouter.patch('/:id', asyncHandler(async(req,res)=>{
  const input=leadSchema.partial().parse(req.body); const data={...input,...(input.mobileNumber?{normalizedMobileNumber:normalizeMobile(input.mobileNumber)}:{})};
  const id=paramId(req); const exists=await prisma.lead.findFirst({where:{id,archivedAt:null}}); if(!exists) throw new HttpError(404,'Lead not found.');
  const lead=await prisma.lead.update({where:{id},data,select:publicLeadSelect});
  const duplicates=input.mobileNumber?await prisma.lead.findMany({where:{id:{not:lead.id},normalizedMobileNumber:normalizeMobile(input.mobileNumber),archivedAt:null},select:{id:true,instituteName:true},take:5}):[];
  ok(res,{lead,duplicateWarning:duplicates});
}));
leadsRouter.post('/:id/archive',asyncHandler(async(req,res)=>{
  const result=await prisma.lead.updateMany({where:{id:paramId(req),archivedAt:null},data:{archivedAt:new Date()}}); if(!result.count) throw new HttpError(404,'Lead not found.'); ok(res,null,'Lead archived.');
}));
leadsRouter.post('/:id/restore',asyncHandler(async(req,res)=>{
  const id=paramId(req);
  const result=await prisma.lead.updateMany({where:{id,archivedAt:{not:null}},data:{archivedAt:null}});
  if(!result.count) throw new HttpError(404,'Archived lead not found.');
  await prisma.activity.create({data:{leadId:id,userId:req.user!.id,type:'OTHER',notes:'Lead restored from archive.'}});
  ok(res,null,'Lead restored to active directory.');
}));
leadsRouter.delete('/:id',asyncHandler(async(req,res)=>{
  const id=paramId(req);
  const exists=await prisma.lead.findUnique({where:{id}});
  if(!exists) throw new HttpError(404,'Lead not found.');
  await prisma.$transaction([
    prisma.activity.deleteMany({where:{leadId:id}}),
    prisma.task.deleteMany({where:{leadId:id}}),
    prisma.lead.delete({where:{id}})
  ]);
  ok(res,null,'Lead permanently deleted.');
}));
leadsRouter.patch('/:id/status',asyncHandler(async(req,res)=>{
  const {status}=statusSchema.parse(req.body); const previous=await prisma.lead.findFirst({where:{id:paramId(req),archivedAt:null}}); if(!previous) throw new HttpError(404,'Lead not found.');
  const lead=await prisma.$transaction(async tx=>{
    const updated=await tx.lead.update({where:{id:previous.id},data:{status,...(status==='CUSTOMER'&&!previous.convertedAt?{convertedAt:new Date()}:{})},select:publicLeadSelect});
    await tx.activity.create({data:{leadId:previous.id,userId:req.user!.id,type:'STATUS_CHANGE',notes:`Status changed from ${previous.status} to ${status}.`}}); return updated;
  }); ok(res,lead,'Status updated.');
}));
leadsRouter.get('/:id/activities',asyncHandler(async(req,res)=>{
  const lead=await prisma.lead.findUnique({where:{id:paramId(req)},select:{id:true}}); if(!lead) throw new HttpError(404,'Lead not found.');
  const items=await prisma.activity.findMany({where:{leadId:lead.id},orderBy:{occurredAt:'desc'},take:200,select:{id:true,type:true,outcome:true,notes:true,occurredAt:true,createdAt:true,user:{select:{name:true}}}}); ok(res,items);
}));
leadsRouter.post('/:id/activities',asyncHandler(async(req,res)=>{
  const input=activitySchema.parse(req.body); const lead=await prisma.lead.findFirst({where:{id:paramId(req),archivedAt:null},select:{id:true}}); if(!lead) throw new HttpError(404,'Lead not found.');
  const activity=await prisma.$transaction(async tx=>{
    const created=await tx.activity.create({data:{...input,leadId:lead.id,userId:req.user!.id},include:{user:{select:{name:true}}}});
    if(input.type==='CALL') await tx.lead.update({where:{id:lead.id},data:{hasBeenCalled:true}}); return created;
  }); ok(res,activity,'Activity logged.',201);
}));
