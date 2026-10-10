// This combined package uses the same-origin Katerbot backend, not IndexedDB.
import {request} from './server-store.mjs';
export const listExpenses=()=>request('expenses').then(r=>r.expenses);
export const saveExpense=record=>request('expenses',{method:'POST',body:JSON.stringify(record)});
