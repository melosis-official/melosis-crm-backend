import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/database';
const server=app.listen(env.PORT,()=>console.log(`Melosis CRM API listening on port ${env.PORT}`));
const shutdown=()=>{server.close(()=>{void prisma.$disconnect().finally(()=>process.exit(0));});};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
