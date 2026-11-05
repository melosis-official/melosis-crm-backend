import { Router } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, HttpError, ok } from '../utils/http';
import { parseCsv, safeCsvCell } from '../utils/csv';
import { normalizeMobile } from '../utils/lead';
import { leadSchema } from '../validators/schemas';
export const transferRouter=Router();
const mapped=(headers:string[], values:string[])=>{
  const index=new Map(headers.map((h,i)=>[h.trim().toLowerCase(),values[i]?.trim()??'']));
  return {ownerName:index.get('institute owner name')||index.get('owner name')||null,instituteName:index.get('institute name')||'',location:index.get('location')||null,mobileNumber:index.get('mobile number')||'',hasBeenCalled:/^(yes|y|true|1)$/i.test(index.get('called or not')||''),remarks:index.get('remark')||null};
};
const parsedRows=(csv:string)=>{const rows=parseCsv(csv);if(rows.length<2)throw new HttpError(400,'CSV needs a header and at least one data row.');if(rows.length>1001)throw new HttpError(413,'Import at most 1,000 rows at a time.');return rows.slice(1).map((row,i)=>({row:i+2,...mapped(rows[0]!,row)}));};
transferRouter.post('/leads/import/preview',asyncHandler(async(req,res)=>{
  const csv=String(req.body?.csv??'');const rows=parsedRows(csv);const candidates=[] as {row:number;data:ReturnType<typeof leadSchema.parse>;normalized:string}[];const invalid=[] as unknown[];
  for(const item of rows){const {row,...data}=item;const result=leadSchema.safeParse(data);if(!result.success){invalid.push({row,reasons:result.error.issues.map(x=>x.message)});continue;}candidates.push({row,data:result.data,normalized:normalizeMobile(result.data.mobileNumber)});}
  const existing=candidates.length?await prisma.lead.findMany({where:{normalizedMobileNumber:{in:[...new Set(candidates.map(x=>x.normalized))]},archivedAt:null},select:{id:true,instituteName:true,normalizedMobileNumber:true},take:1000}):[];
  const byNumber=new Map<string,{id:string;instituteName:string}[]>();for(const lead of existing){const current=byNumber.get(lead.normalizedMobileNumber)||[];if(current.length<3)current.push({id:lead.id,instituteName:lead.instituteName});byNumber.set(lead.normalizedMobileNumber,current);}
  const seen=new Set<string>();const valid=candidates.map(x=>{const duplicateWarning=[...(byNumber.get(x.normalized)||[]),...(seen.has(x.normalized)?[{id:'same-file',instituteName:'Another row in this CSV'}]:[])];seen.add(x.normalized);return {...x.data,row:x.row,duplicateWarning};});
  ok(res,{valid,invalid,total:rows.length});
}));
transferRouter.post('/leads/import/confirm',asyncHandler(async(req,res)=>{
  const csv=String(req.body?.csv??'');const skipDuplicates=req.body?.skipDuplicates!==false;const rows=parsedRows(csv);let imported=0,skipped=0;const failed=[] as unknown[];const candidates=[] as {row:number;data:ReturnType<typeof leadSchema.parse>;normalized:string}[];
  for(const item of rows){const {row,...data}=item;const parsed=leadSchema.safeParse(data);if(!parsed.success){failed.push({row,reasons:parsed.error.issues.map(x=>x.message)});continue;}candidates.push({row,data:parsed.data,normalized:normalizeMobile(parsed.data.mobileNumber)});}
  const existing=candidates.length&&skipDuplicates?await prisma.lead.findMany({where:{normalizedMobileNumber:{in:[...new Set(candidates.map(x=>x.normalized))]},archivedAt:null},select:{normalizedMobileNumber:true},take:2000}):[];const known=new Set(existing.map(x=>x.normalizedMobileNumber));
  for(const {row,data,normalized} of candidates){if(skipDuplicates&&known.has(normalized)){skipped++;continue;}
    try{await prisma.$transaction(async tx=>{const lead=await tx.lead.create({data:{...data,normalizedMobileNumber:normalized,createdById:req.user!.id}});await tx.activity.create({data:{leadId:lead.id,userId:req.user!.id,type:'OTHER',notes:'Lead imported from CSV.'}});});imported++;if(skipDuplicates)known.add(normalized);}catch{failed.push({row,reasons:['Unable to save this row.']});}
  }ok(res,{imported,skipped,failed});
}));
transferRouter.get('/leads/export',asyncHandler(async(_req,res)=>{
  const leads=await prisma.lead.findMany({where:{archivedAt:null},orderBy:{createdAt:'desc'},select:{instituteName:true,ownerName:true,mobileNumber:true,email:true,location:true,instituteType:true,source:true,status:true,hasBeenCalled:true,remarks:true,createdAt:true}});
  const header=['Institute Name','Institute Owner Name','Mobile Number','Email','Location','Institute Type','Lead Source','Lead Status','Called or Not','Remark','Created At'];
  const lines=[header,...leads.map(l=>[l.instituteName,l.ownerName,l.mobileNumber,l.email,l.location,l.instituteType,l.source,l.status,l.hasBeenCalled?'Yes':'No',l.remarks,l.createdAt.toISOString()])].map(r=>r.map(safeCsvCell).join(','));
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="melosis-leads.csv"');res.send('\uFEFF'+lines.join('\r\n'));
}));
