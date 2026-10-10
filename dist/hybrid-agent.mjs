/** Domain adaptation of reference/main.py, not a farm simulation or an LLM.
 * Preserves priority/(1 + .65 * effort), 1.8 commitment, 15% profile
 * hysteresis, per-instance memory, shared reservations, hard constraints,
 * and cash buffers. New business objectives and catalog data are demo inputs.
 * Heuristic allocation, NOT a mathematically optimal allocation guarantee.
 */
export class HybridResourceAgent {
 constructor(){this.memory={company:{profile:'balanced',routes:[]},shopping:{profile:'balanced',routes:[]}};}
 chooseProfile(mode,objective,scores){const m=this.memory[mode];if(objective!=='auto')return objective;const best=Object.keys(scores).reduce((a,b)=>scores[a]>=scores[b]?a:b);return scores[m.profile]>=scores[best]*.85?m.profile:best;}
 plan({mode='company',objective='balanced',funds,reserve=0,capacity=3,horizon=7,candidates=[],profileScores={balanced:1,frugal:0,speed:0}}){
 if(!this.memory[mode])throw Error('Unknown agent mode');
 if(!['auto','balanced','frugal','speed'].includes(objective))throw Error('Unknown objective');
 if(!Number.isSafeInteger(reserve)||reserve<0||!Number.isSafeInteger(capacity)||capacity<1||!Number.isFinite(horizon)||horizon<1)throw Error('Invalid resource limits');
 for(const v of Object.values(funds))if(!Number.isSafeInteger(v)||v<0)throw Error('Invalid available funds');
 const total=Object.values(funds).reduce((a,b)=>a+b,0);
 if(reserve>total)throw Error('La reserva supera el presupuesto disponible.');
 const profile=this.chooseProfile(mode,objective,profileScores),remaining={...funds};let cash=total-reserve,slots=capacity;
 const scored=candidates.map((c,index)=>{let priority=c.priority;
 if(profile==='frugal')priority*=1+(c.savings||0)/Math.max(1,c.cost);
 if(profile==='speed')priority*=1+1/Math.max(1,c.duration);
 let score=priority/(1+.65*c.effort);
 if(this.memory[mode].routes.includes(c.id))score*=1.8;
 return {...c,index,score};}).sort((a,b)=>b.score-a.score||a.index-b.index);
 const selected=[],deferred=[],seen=new Set();
 for(const c of scored){let reason='';
 if(seen.has(c.id))continue;seen.add(c.id);
 if(!Number.isSafeInteger(c.cost)||c.cost<0||!Number.isFinite(c.score)||!Number.isFinite(c.duration)||c.duration<0||!Number.isFinite(c.effort)||c.effort<0)reason='Datos de costo o capacidad inválidos';
 else if(c.blocked)reason=c.blocked;
 else if(c.duration>horizon)reason='No cabe en el plazo indicado';
 else if(!Object.hasOwn(remaining,c.budget)||c.cost>remaining[c.budget])reason='Presupuesto del área insuficiente';
 else if(c.cost>cash)reason='Se conserva la reserva de efectivo';
 else if(slots<1)reason='Límite de tareas simultáneas';
 if(reason){deferred.push({...c,reason});continue;}
 remaining[c.budget]-=c.cost;cash-=c.cost;slots--;selected.push({...c,reason:`Prioridad ${Math.round(c.priority)}, esfuerzo ${c.effort}, plazo ${c.duration} día(s). Dentro de presupuesto y reserva.`});
 }
 this.memory[mode]={profile,routes:selected.map(c=>c.id)};
 return {mode,profile,selected,deferred,committed:selected.reduce((a,c)=>a+c.cost,0),remaining,totalAvailable:total,reserve,spendable:cash,trace:{formula:'priority / (1 + 0.65 × effort)',commitmentBonus:1.8,hysteresis:0.85,forecastSavingsSpent:false}};
 }
}
