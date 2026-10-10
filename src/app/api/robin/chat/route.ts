import {chat,chatConfig} from '@/lib/robin/agent-chat.mjs';
import {input,reply} from '@/lib/robin/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
let busy=false,last=0;
export async function POST(req:Request){if(busy||Date.now()-last<1000)return reply({error:'Espera a que termine la respuesta anterior.'},429);busy=true;last=Date.now();try{return reply(await chat(await input(req),chatConfig(process.env)));}catch(e){const err=e as Error&{status?:number};return reply({error:err.status?err.message:'Solicitud de chat inválida.'},err.status||400);}finally{busy=false;}}
