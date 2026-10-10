import {checkoutResult} from './reap-contract.mjs';
const panel=document.querySelector('#reap-demo');
let stage=0;
if(new URLSearchParams(location.search).has('return'))document.querySelector('#return-state').innerHTML='<div class="callout">Regreso recibido. No hay un backend conectado para verificar el estado. Esto no confirma el registro de tarjeta ni un pago.</div>';
const stages=[
 ['Registrar tarjeta','REQUIRES_ACTION','En sandbox abriríamos nextAction.url para que completes el registro directamente en REAP. Este ensayo no contiene un formulario de tarjeta.','Simular regreso del registro'],
 ['Verificar enrollment','ACTIVE','La lectura simulada confirma el enrollment. En la integración real consultaremos REAP antes de habilitar el checkout.','Preparar cotización de ejemplo'],
 ['Revisar cotización','Quote vigente','Ejemplo local: producto $129 + envío $5 + impuesto $10.72 = $144.72 USD. El quote real se leerá desde REAP y tendrá expiresAt.','Crear checkout simulado'],
 ['Aprobar en REAP','REQUIRES_ACTION','La aprobación del cargo se abrirá en la página alojada por REAP. Aquí solo ensayamos el regreso, sin autorizar una tarjeta.','Simular aprobación y regreso'],
 ['Consultar checkout','PROCESSING','El regreso no prueba que se completó la compra. Este estado mantiene la operación pendiente.','Simular lectura final']
];
function render(){panel.hidden=false;if(stage<stages.length){const [title,status,body,action]=stages[stage];panel.innerHTML=`<span class="badge review">SIMULACIÓN LOCAL · ${status}</span><h2 style="font-size:20px;margin:16px 0">${stage+1}. ${title}</h2><p class="muted">${body}</p><button class="btn" id="demo-next" style="margin-top:18px">${action} →</button>`;document.querySelector('#demo-next').onclick=()=>{stage++;render();};}else{const result=checkoutResult({status:'COMPLETED',orderId:'DEMO-REAP-001',finalAmount:{amount:144.72,currency:'USD'}});panel.innerHTML=`<span class="badge approved">SIMULACIÓN LOCAL · COMPLETED</span><h2 style="font-size:20px;margin:16px 0">${result.label} · Ejemplo</h2><p class="muted">Orden ${result.orderId} · Total final $144.72 USD. No hubo una llamada a REAP, un cargo ni un pedido real.</p><button class="btn secondary" id="again" style="margin-top:18px">Repetir ensayo</button>`;document.querySelector('#again').onclick=()=>{stage=0;render();};}}
document.querySelector('#start-demo').onclick=()=>{stage=0;render();panel.scrollIntoView({behavior:'smooth',block:'start'});};
