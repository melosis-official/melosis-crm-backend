import type { RequestHandler } from 'express';
import { isAllowedOrigin } from '../config/origins';
export const checkOrigin:RequestHandler=(req,res,next)=>{
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
  const origin=req.get('origin');
  if(origin&&!isAllowedOrigin(origin)){res.status(403).json({success:false,message:'Request origin is not allowed.'});return;}
  next();
};
