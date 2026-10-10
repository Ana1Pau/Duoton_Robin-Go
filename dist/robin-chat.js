// No API keys in the browser. AI uses the same-origin local server only.
const $=s=>document.querySelector(s),history={company:[],shopping:[],daily:[]};
let enabled=false,busy=false,style='guided';
const mode=()=>document.querySelector('[data-mode][aria-pressed="true"]').dataset.mode;
const panel=$('#chat-panel'),log=$('#chat-log');
function message(role,text){const row=document.createElement('div');row.className='chat-message '+role;const label=document.createElement('strong');label.textContent=role==='user'?'Tú':'Robin';const body=document.createElement('p');body.textContent=text;row.append(label,body);log.append(row);}
function draw(){log.replaceChildren();for(const m of history[mode()])message(m.role,m.content);$('#chat-panel').hidden=style!=='ai';}
function note(text){$('#chat-status').textContent=text;}
function setStyle(value){style=value;document.querySelectorAll('[data-chat-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chatStyle===value)));draw();$('#result-section').hidden=true;note(style==='ai'?(enabled?'Modelo local configurado. Escribe una instrucción libre.':'Chat preparado; falta conectar un modelo. La demo guiada sigue disponible.'):'Acciones con reglas locales, sin un LLM.');}
document.querySelectorAll('[data-chat-style]').forEach(b=>b.onclick=()=>setStyle(b.dataset.chatStyle));document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',draw));
$('#clear-chat').onclick=()=>{history[mode()]=[];draw();};
$('#agent-form').addEventListener('submit',async e=>{
 if(style!=='ai')return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
 const text=$('#intent').value.trim();if(!text)return;
 if(!enabled){note('No hay un modelo conectado. Consulta la guía de conexión local; todavía no se envió tu mensaje a una IA.');return;}
 if(text.length>2000){note('Usa hasta 2,000 caracteres.');return;}
 const current=mode(),messages=[...history[current].slice(-10),{role:'user',content:text}];busy=true;panel.setAttribute('aria-busy','true');const controls=[...document.querySelectorAll('[data-mode],[data-chat-style],#agent-form button,#clear-chat,#suggestions button')];controls.forEach(b=>b.disabled=true);log.replaceChildren();messages.forEach(m=>message(m.role,m.content));note('Robin está pensando…');
 try{const response=await fetch('/api/agent/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:current,messages}),signal:AbortSignal.timeout(65000)});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo obtener respuesta.');if(typeof data.reply!=='string')throw Error('Respuesta inválida.');history[current]=[...messages,{role:'assistant',content:data.reply.slice(0,2000)}];draw();$('#intent').value='';note('Respuesta recibida. Ninguna acción fue ejecutada.');
 const links={company_overview:['company.html#overview','Abrir empresa'],company_budgets:['company.html#budgets','Ver presupuestos'],company_approvals:['company.html#approvals','Revisar propuestas'],shopping_catalog:['shopping.html#shop','Explorar catálogo'],shopping_orders:['shopping.html#orders','Ver pedidos'],daily_expenses:['expenses.html?scope=shopping','Abrir gastos personales'],company_expenses:['expenses.html?scope=company','Abrir gastos de empresa']};if(Object.hasOwn(links,data.action)){const [href,label]=links[data.action],a=document.createElement('a');a.href=href;a.textContent=label+' ↗';a.className='chat-action';log.append(a);}
 }catch(error){draw();note(error.name==='TimeoutError'?'El modelo tardó demasiado. Puedes volver a intentar.':error.message);}
 finally{busy=false;panel.setAttribute('aria-busy','false');controls.forEach(b=>b.disabled=false);}
},true);
$('#suggestions').addEventListener('click',e=>{if(style!=='ai')return;const button=e.target.closest('button');if(!button)return;e.stopImmediatePropagation();$('#intent').value=button.textContent.replace(/ ↗$/,'');$('#agent-form').requestSubmit();},true);
try{const r=await fetch('/api/agent/status',{signal:AbortSignal.timeout(4000)});if(r.ok){const s=await r.json();enabled=s.enabled===true;} }catch{}
$('#model-status').textContent=enabled?'IA local configurada':'IA pendiente de conexión';setStyle('guided');
