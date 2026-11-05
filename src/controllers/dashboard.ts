import { Router } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, ok } from '../utils/http';
export const dashboardRouter=Router();
dashboardRouter.get('/summary',asyncHandler(async(_req,res)=>{
  const now=new Date();
  const [totalLeads,newLeads,contactedLeads,interestedInstitutes,demosScheduled,inPilot,customers,overdueFollowUps,pipeline]=await Promise.all([
    prisma.lead.count({where:{archivedAt:null}}),prisma.lead.count({where:{status:'NEW',archivedAt:null}}),prisma.lead.count({where:{status:'CONTACTED',archivedAt:null}}),
    prisma.lead.count({where:{status:'INTERESTED',archivedAt:null}}),prisma.lead.count({where:{status:'DEMO_SCHEDULED',archivedAt:null}}),prisma.lead.count({where:{status:'PILOT',archivedAt:null}}),
    prisma.lead.count({where:{status:'CUSTOMER',archivedAt:null}}),prisma.task.count({where:{status:'OPEN',dueAt:{lt:now},lead:{archivedAt:null}}}),
    prisma.lead.groupBy({by:['status'],where:{archivedAt:null},_count:{_all:true}}),
  ]);
  ok(res,{totalLeads,newLeads,contactedLeads,interestedInstitutes,demosScheduled,inPilot,customers,overdueFollowUps,pipeline:Object.fromEntries(pipeline.map(x=>[x.status,x._count._all]))});
}));
dashboardRouter.get('/follow-ups',asyncHandler(async(req,res)=>{
  const now=new Date();const day=new Date(now);day.setHours(0,0,0,0);const tomorrow=new Date(day);tomorrow.setDate(tomorrow.getDate()+1);
  const [today,overdue,upcoming]=await Promise.all([
    prisma.task.findMany({where:{status:'OPEN',dueAt:{gte:now,lt:tomorrow},lead:{archivedAt:null}},orderBy:{dueAt:'asc'},include:{lead:{select:{id:true,instituteName:true,mobileNumber:true}}}}),
    prisma.task.findMany({where:{status:'OPEN',dueAt:{lt:now},lead:{archivedAt:null}},orderBy:{dueAt:'asc'},take:8,include:{lead:{select:{id:true,instituteName:true,mobileNumber:true}}}}),
    prisma.task.findMany({where:{status:'OPEN',dueAt:{gte:tomorrow},lead:{archivedAt:null}},orderBy:{dueAt:'asc'},take:8,include:{lead:{select:{id:true,instituteName:true,mobileNumber:true}}}}),
  ]);ok(res,{today,overdue,upcoming});
}));
dashboardRouter.get('/recent-activities',asyncHandler(async(_req,res)=>{
  const activities=await prisma.activity.findMany({orderBy:{occurredAt:'desc'},take:12,include:{lead:{select:{id:true,instituteName:true}},user:{select:{name:true}}}}); ok(res,activities);
}));
