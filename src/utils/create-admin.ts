import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
const prisma=new PrismaClient();
function hiddenPrompt(message:string):Promise<string>{
 if(!input.isTTY) return Promise.reject(new Error('Run this command from an interactive terminal so the password is not echoed.'));
 output.write(message);input.setRawMode(true);input.resume();
 return new Promise((resolve,reject)=>{
  let value='';
  const finish=(error?:Error)=>{input.off('data',onData);input.setRawMode(false);output.write('\n');error?reject(error):resolve(value);};
  const onData=(chunk:Buffer)=>{for(const char of chunk.toString('utf8')){
   if(char==='\u0003'){finish(new Error('Administrator creation cancelled.'));return;}
   if(char==='\r'||char==='\n'){finish();return;}
   if(char==='\u007f'||char==='\b'){if(value.length){value=value.slice(0,-1);output.write('\b \b');}continue;}
   if(char>=' '&&char<='~'){value+=char;output.write('*');}
  }};
  input.on('data',onData);
 });
}
async function main(){
 const rl=createInterface({input,output});
 try{
  if(await prisma.user.count({where:{role:'SUPERADMIN'}})>0)throw new Error('A superadmin already exists. Create regular users from Settings.');
  const name=(await rl.question('Administrator name: ')).trim();const email=(await rl.question('Administrator email: ')).trim().toLowerCase();rl.close();
  const password=await hiddenPrompt('Password (12+ characters): ');
  if(!name||!email.includes('@')||password.length<12)throw new Error('Enter a name, valid email, and a password of at least 12 characters.');
  const passwordHash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
  await prisma.user.create({data:{name,email,passwordHash,role:'SUPERADMIN'}});console.log(`Superadmin ${email} created.`);
 }finally{rl.close();await prisma.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Unable to create administrator.');process.exitCode=1;});
