import {ctx} from '@/lib/service';
import {robinStore} from '@/lib/robin/store.mjs';
import {reply,problem,input} from '@/lib/robin/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
type Context={params:Promise<{scope:string}>};
export async function GET(_req:Request,context:Context){try{const {scope}=await context.params;const {user}=await ctx();return reply(await robinStore.getWorkspace(user.id,scope));}catch(e){return problem(e);}}
export async function PUT(req:Request,context:Context){try{const {scope}=await context.params;const data=await input(req);const {user}=await ctx();return reply(await robinStore.saveWorkspace(user.id,scope,data));}catch(e){return problem(e);}}
