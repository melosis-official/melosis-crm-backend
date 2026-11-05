import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { asyncHandler, HttpError, ok, paramId } from '../utils/http';
import { taskSchema } from '../validators/schemas';
export const tasksRouter=Router();
tasksRouter.get('/',asyncHandler(async(req,res)=>{
  const status=typeof req.query.status==='string'?req.query.status:undefined;
  if(status&&!['OPEN','COMPLETED','CANCELLED'].includes(status)) throw new HttpError(400,'Invalid task status.');
  const priority=typeof req.query.priority==='string'?req.query.priority:undefined;
  if(priority&&!['LOW','MEDIUM','HIGH'].includes(priority)) throw new HttpError(400,'Invalid task priority.');
  const leadId=typeof req.query.leadId==='string'?req.query.leadId:undefined;
  const where={...(status?{status:status as 'OPEN'|'COMPLETED'|'CANCELLED'}:{}),...(priority?{priority:priority as 'LOW'|'MEDIUM'|'HIGH'}:{}),...(leadId?{leadId}:{}),lead:{archivedAt:null}};
  const tasks=await prisma.task.findMany({where,orderBy:{dueAt:'asc'},take:200,include:{lead:{select:{id:true,instituteName:true,ownerName:true,mobileNumber:true,status:true}}}}); ok(res,tasks);
}));
tasksRouter.post('/',asyncHandler(async(req,res)=>{
  const input=taskSchema.parse(req.body); const lead=await prisma.lead.findFirst({where:{id:input.leadId,archivedAt:null},select:{id:true}}); if(!lead) throw new HttpError(404,'Lead not found.');
  const task=await prisma.task.create({data:{...input,userId:req.user!.id},include:{lead:{select:{id:true,instituteName:true}}}}); ok(res,task,'Follow-up scheduled.',201);
}));
tasksRouter.get('/:id',asyncHandler(async(req,res)=>{const task=await prisma.task.findUnique({where:{id:paramId(req)},include:{lead:{select:{id:true,instituteName:true}}}}); if(!task) throw new HttpError(404,'Task not found.'); ok(res,task);}));
tasksRouter.patch('/:id',asyncHandler(async(req,res)=>{
  const input=taskSchema.partial().omit({leadId:true,status:true}).parse(req.body);
  const task=await prisma.task.findUnique({where:{id:paramId(req)}}); if(!task) throw new HttpError(404,'Task not found.');
  ok(res,await prisma.task.update({where:{id:task.id},data:input,include:{lead:{select:{id:true,instituteName:true}}}}),'Task updated.');
}));
tasksRouter.patch('/:id/complete',asyncHandler(async(req,res)=>{
  const completion=z.object({outcome:z.enum(['NO_ANSWER','SPOKE_SUCCESSFULLY','INTERESTED','CALLBACK_REQUESTED','NOT_INTERESTED','WRONG_NUMBER','OTHER']).optional(),notes:z.string().trim().max(10000).optional()}).parse(req.body??{});
  const task=await prisma.task.findUnique({where:{id:paramId(req)}}); if(!task) throw new HttpError(404,'Task not found.');if(task.status!=='OPEN')throw new HttpError(409,'Only open tasks can be completed.');
  const updated=await prisma.$transaction(async tx=>{
    const record=await tx.task.update({where:{id:task.id},data:{status:'COMPLETED',completedAt:new Date()}});
    if(completion.outcome||completion.notes) await tx.activity.create({data:{leadId:task.leadId,userId:req.user!.id,type:'NOTE',outcome:completion.outcome,notes:completion.notes||`Completed follow-up: ${task.title}`}});
    return record;
  }); ok(res,updated,'Task completed.');
}));
tasksRouter.patch('/:id/cancel',asyncHandler(async(req,res)=>{const result=await prisma.task.updateMany({where:{id:paramId(req),status:'OPEN'},data:{status:'CANCELLED'}}); if(!result.count) throw new HttpError(404,'Open task not found.'); ok(res,null,'Task cancelled.');}));
