import {HybridResourceAgent} from './hybrid-agent.mjs';
import {budgetStats,checks,totalsFor} from './business-domain.mjs';
import {products,shippingOptions,totals} from './domain.mjs';
const engine=new HybridResourceAgent();
export const companyScenarios=[
 {id:'hybrid-invoice',title:'Liquidar factura internacional',description:'Pagar la factura del socio de diseño antes de su vencimiento. Datos demostrativos.',type:'international',supplierId:'s1',department:'marketing',amount:240000,currency:'EUR',priority:900,effort:1,duration:2,savings:0},
 {id:'hybrid-cloud',title:'Ampliar capacidad por un día',description:'Pasar de 6 a 8 instancias por un día. Costo incremental $32; gasto diario proyectado $128. No se ejecuta en un proveedor real.',type:'compute',supplierId:'s2',department:'engineering',amount:3200,currency:'USD',priority:650,effort:1,duration:1,savings:0,projectedDaily:12800,instances:8},
 {id:'hybrid-license',title:'Consolidar licencias del equipo',description:'Costo de migración de $120. Ahorro hipotético de $480 por mes; no se considera dinero disponible.',type:'purchase',supplierId:'s4',department:'operations',amount:12000,currency:'USD',priority:400,effort:2,duration:3,savings:48000},
 {id:'hybrid-equipment',title:'Renovar equipos de oficina',description:'Compra opcional de equipos con entrega estimada de cinco días. Se puede posponer para preservar liquidez.',type:'purchase',supplierId:'s3',department:'operations',amount:10000000,currency:'MXN',priority:220,effort:3,duration:5,savings:0}
];
export function planCompany(state,{objective='balanced',reserve=500000,capacity=3,horizon=7}={}){
 const funds=Object.fromEntries(state.budgets.map(b=>[b.id,Math.max(0,budgetStats(state,b.id).available)]));
 const candidates=companyScenarios.map(c=>{const quote={...c,...totalsFor(c.amount,c.currency,c.type)};const failures=checks(state,quote).filter(c=>!c.pass);const existing=state.requests.some(r=>r.agentScenario===c.id&&r.status!=='cancelled');return {...c,cost:quote.total,budget:c.department,blocked:existing?'Ya existe una propuesta de este escenario':failures.map(c=>c.name).join('; ')};});
 return engine.plan({mode:'company',objective,funds,reserve,capacity,horizon,candidates});
}
export function planShopping({kind='headphones',budget=17000,horizon=7,objective='frugal',quantity=1}={}){
 if(!['headphones','speaker','bag','lamp','bottle','all'].includes(kind))throw Error('Selecciona una categoría válida.');
 if(!Number.isSafeInteger(budget)||budget<=0)throw Error('Escribe un presupuesto válido.');
 const days={standard:7,economy:10,express:3,nextday:1,weekend:7,scheduled:7};
 const candidates=products.filter(p=>kind==='all'||p.kind===kind).flatMap(p=>shippingOptions.map(s=>{const t=totals(p.id,quantity,s.id);return {id:p.id+':'+s.id,title:p.name,cost:t.total,budget:'personal',priority:100,effort:objective==='speed'?days[s.id]:t.total/10000,duration:days[s.id],savings:0,productId:p.id,shippingId:s.id,shippingLabel:s.name,quantity,totals:t};}));
 engine.memory.shopping.routes=[]; // A fresh shopping comparison must not favor a costlier previous result.
 return engine.plan({mode:'shopping',objective,funds:{personal:budget},reserve:0,capacity:1,horizon,candidates});
}
export async function prepareProposal({mode,intent,instructions,context,state}){
 // Future remote boundary: POST /api/agent/requests with authenticated tenant,
 // quote version and idempotency key. Do NOT put secrets in browser code.
 // Real execution and tamper-resistant approval must be validated server-side.
 if(mode!=='company'||!state)throw Error('Se necesita el estado de la empresa.');
 const quote={...context,...totalsFor(context.amount,context.currency,context.type)};
 const policyChecks=checks(state,quote);
 return {demo:true,mode,intent,instructions,context:quote,state:policyChecks.every(c=>c.pass)?'needs_approval':'blocked',policyChecks,message:policyChecks.every(c=>c.pass)?'Propuesta validada: presupuesto y proveedor revisados.':'Propuesta bloqueada por las políticas actuales.'};
}
// Shipping and company demos execute this adapted deterministic engine locally.
// The unchanged agricultural Python is in reference/main.py, never executed with
// invented farm observations. This port adapts mechanisms, not the farm actions.
export function validateShoppingSelection(state){
 if(!state.agentConstraints)return;
 const {budget,horizon}=state.agentConstraints;
 const days={standard:7,economy:10,express:3,nextday:1,weekend:7,scheduled:7};
 const t=totals(state.productId,state.quantity,state.shippingId);
 if(t.total>budget)throw Error('Esta selección supera el presupuesto aprobado para el agente. Cambia cantidad o envío, o calcula una recomendación nueva.');
 if(!days[state.shippingId]||days[state.shippingId]>horizon)throw Error('Este envío supera tu plazo máximo. Elige otra opción.');
}
