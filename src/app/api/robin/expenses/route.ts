import {ctx} from '@/lib/service';
import {robinStore} from '@/lib/robin/store.mjs';
import {reply,problem,input} from '@/lib/robin/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){try{const {user}=await ctx();return reply({expenses:await robinStore.listExpenses(user.id),storage:robinStore.kind});}catch(e){return problem(e);}}
export async function POST(req:Request){try{const data=await input(req);const {user}=await ctx();return reply({expense:await robinStore.saveExpense(user.id,data)});}catch(e){return problem(e);}}
