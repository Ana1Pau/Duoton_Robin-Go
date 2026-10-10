export class StoreError extends Error { constructor(status:number,message:string);status:number; }
export interface RobinStore {kind:'sqlserver'|'json';listExpenses(userId:number):Promise<unknown[]>;saveExpense(userId:number,input:unknown):Promise<unknown>;getWorkspace(userId:number,scope:string):Promise<{revision:number;state:unknown}>;saveWorkspace(userId:number,scope:string,input:unknown):Promise<{revision:number;state:unknown}>;}
export function createStore(config?:{connectionString?:string;directory?:string}):RobinStore;
export const robinStore:RobinStore;
