import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {expenseRecord} from '../../../public/robin/expenses-domain.mjs';
export class StoreError extends Error{constructor(status,message){super(message);this.status=status;}}
export function expenseInput(input){if(!input||!Number.isSafeInteger(input.amountMinor))throw new StoreError(400,'Importe inválido.');try{return expenseRecord({...input,amount:(input.amountMinor/100).toFixed(2)});}catch(e){throw new StoreError(400,e.message);}}
export function workspaceInput(scope,input){if(!['company','shopping'].includes(scope)||!input||!Number.isSafeInteger(input.revision)||input.revision<0)throw new StoreError(400,'Revisión o contexto inválidos.');const s=input.state;if(!s||typeof s!=='object'||Array.isArray(s)||JSON.stringify(s).length>200000)throw new StoreError(400,'Estado inválido o demasiado grande.');if(scope==='company'&&(s.version!==1||!Array.isArray(s.budgets)||!Array.isArray(s.requests)))throw new StoreError(400,'Estado empresarial inválido.');if(scope==='shopping'&&(!/^p[1-6]$/.test(s.productId)||!Number.isInteger(s.quantity)||s.quantity<1||s.quantity>10||!['standard','economy','express','nextday','weekend','scheduled'].includes(s.shippingId)))throw new StoreError(400,'Estado de compras inválido.');return {revision:input.revision,state:s};}
export function createStore({connectionString='',directory=join(process.cwd(),'data')}={}){let queue=Promise.resolve(),poolPromise;
 async function pool(){const sql=(await import('mssql')).default;if(!poolPromise)poolPromise=new sql.ConnectionPool(connectionString).connect().catch(e=>{poolPromise=null;throw e;});return {sql,pool:await poolPromise};}
 async function query(text,params){const {sql,pool:p}=await pool();const r=p.request();for(const [name,type,value] of params)r.input(name,name==='payload'?sql.NVarChar(sql.MAX):sql[type],value);return (await r.query(text)).recordset||[];}
 async function fileTask(fn,write=false){const work=queue.then(async()=>{await mkdir(directory,{recursive:true});const file=join(directory,'robin-store.json');let db;try{db=JSON.parse(await readFile(file,'utf8'));if(!db||!Array.isArray(db.expenses)||!db.workspaces)throw Error('Formato inválido');}catch(e){if(e.code!=='ENOENT')throw new StoreError(500,'No se pudo leer el archivo de datos. No se sobrescribió.');db={expenses:[],workspaces:{}};}const result=await fn(db);if(write){const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(db),{mode:0o600});await rename(temp,file);}return result;});queue=work.catch(()=>{});return work;}
 const mapExpense=r=>JSON.parse(r.payload);
 return {
 kind:connectionString?'sqlserver':'json',
 async listExpenses(userId){if(!connectionString)return fileTask(db=>db.expenses.filter(r=>r.userId===userId).map(r=>r.value));return (await query('SELECT payload FROM dbo.robin_expenses WHERE user_id=@user ORDER BY updated_at DESC',[['user','Int',userId]])).map(mapExpense);},
 async saveExpense(userId,input){const validated=expenseInput(input);if(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.id))throw new StoreError(400,'Identificador de gasto inválido.');
 if(!connectionString)return fileTask(db=>{const existing=db.expenses.find(r=>r.value.id===input.id);if(existing&&existing.userId!==userId)throw new StoreError(409,'Identificador no disponible.');const value={...validated,id:input.id,createdAt:existing?.value.createdAt||validated.createdAt};if(existing)existing.value=value;else db.expenses.push({userId,value});return value;},true);
 const rows=await query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
 DECLARE @prior nvarchar(max); SELECT @prior=payload FROM dbo.robin_expenses WITH (UPDLOCK,HOLDLOCK) WHERE id=@id AND user_id=@user;
 IF @prior IS NOT NULL SET @payload=JSON_MODIFY(@payload,'$.createdAt',JSON_VALUE(@prior,'$.createdAt'));
 IF @prior IS NULL INSERT dbo.robin_expenses(id,user_id,scope,currency,amount_minor,expense_date,payload) VALUES(@id,@user,@scope,@currency,@amount,@date,@payload);
 ELSE UPDATE dbo.robin_expenses SET scope=@scope,currency=@currency,amount_minor=@amount,expense_date=@date,payload=@payload,updated_at=SYSUTCDATETIME() WHERE id=@id AND user_id=@user;
 SELECT payload FROM dbo.robin_expenses WHERE id=@id AND user_id=@user; COMMIT;`,[['id','UniqueIdentifier',input.id],['user','Int',userId],['scope','NVarChar',validated.scope],['currency','NVarChar',validated.currency],['amount','BigInt',validated.amountMinor],['date','Date',validated.date],['payload','NVarChar',JSON.stringify({...validated,id:input.id})]]);return mapExpense(rows[0]);
 },
 async getWorkspace(userId,scope){if(!['company','shopping'].includes(scope))throw new StoreError(400,'Contexto inválido.');if(!connectionString)return fileTask(db=>db.workspaces[userId+':'+scope]||{revision:0,state:null});const r=(await query('SELECT revision,payload FROM dbo.robin_demo_workspaces WHERE user_id=@user AND scope=@scope',[['user','Int',userId],['scope','NVarChar',scope]]))[0];return r?{revision:Number(r.revision),state:JSON.parse(r.payload)}:{revision:0,state:null};},
 async saveWorkspace(userId,scope,input){const value=workspaceInput(scope,input);if(!connectionString)return fileTask(db=>{const key=userId+':'+scope,current=db.workspaces[key]||{revision:0};if(current.revision!==value.revision)throw new StoreError(409,'Otra pestaña modificó los datos. Recarga antes de continuar.');const next={revision:value.revision+1,state:value.state};db.workspaces[key]=next;return next;},true);
 try{const rows=await query(`SET XACT_ABORT ON; BEGIN TRANSACTION; DECLARE @current bigint;
 SELECT @current=revision FROM dbo.robin_demo_workspaces WITH (UPDLOCK,HOLDLOCK) WHERE user_id=@user AND scope=@scope;
 IF COALESCE(@current,0)<>@revision BEGIN ROLLBACK; THROW 51001,'WORKSPACE_CONFLICT',1; END;
 IF @current IS NULL INSERT dbo.robin_demo_workspaces(user_id,scope,revision,payload) VALUES(@user,@scope,1,@payload);
 ELSE UPDATE dbo.robin_demo_workspaces SET revision=revision+1,payload=@payload,updated_at=SYSUTCDATETIME() WHERE user_id=@user AND scope=@scope;
 SELECT revision,payload FROM dbo.robin_demo_workspaces WHERE user_id=@user AND scope=@scope; COMMIT;`,[['user','Int',userId],['scope','NVarChar',scope],['revision','BigInt',value.revision],['payload','NVarChar',JSON.stringify(value.state)]]);return {revision:Number(rows[0].revision),state:JSON.parse(rows[0].payload)};}catch(e){if(e.number===51001)throw new StoreError(409,'Otra pestaña modificó los datos. Recarga antes de continuar.');throw e;}
 }
 };
}
export const robinStore=createStore({connectionString:process.env.SQLSERVER_CONNECTION_STRING||''});
