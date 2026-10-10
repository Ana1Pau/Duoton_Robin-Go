import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chat,chatConfig,configured} from './agent-chat.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
export function createLocalServer(config=chatConfig(process.env),fetchImpl=globalThis.fetch){let busy=false;let lastRequest=0;
 return http.createServer(async(req,res)=>{try{
 // Loopback only; reject DNS rebinding and cross-origin POSTs. Not a production auth scheme.
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')){json(res,403,{error:'Host no permitido.'});return;}
 const url=new URL(req.url,'http://'+req.headers.host);
 if(url.pathname==='/api/agent/status'&&req.method==='GET'){json(res,200,{enabled:configured(config),provider:configured(config)?config.provider:null});return;}
 if(url.pathname==='/api/agent/chat'&&req.method==='POST'){
 if(req.headers.origin!=='http://'+req.headers.host){json(res,403,{error:'Origen no permitido.'});return;}
 if(!String(req.headers['content-type']).startsWith('application/json')){json(res,415,{error:'Envía JSON.'});return;}
 if(busy||Date.now()-lastRequest<1000){json(res,429,{error:'Espera a que termine la respuesta anterior.'});return;}
 busy=true;lastRequest=Date.now();try{let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>32768){json(res,413,{error:'Conversación demasiado grande.'});return;}}let input;try{input=JSON.parse(body);}catch{json(res,400,{error:'JSON inválido.'});return;}const result=await chat(input,config,fetchImpl);json(res,200,result);}finally{busy=false;}return;
 }
 if(url.pathname.startsWith('/api/')){json(res,404,{error:'Ruta no disponible.'});return;}
 if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'Método no permitido.'});return;}
 const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep)){json(res,403,{error:'Ruta no permitida.'});return;}
 try{const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);}catch{json(res,404,{error:'Archivo no encontrado.'});}
 }catch(error){json(res,error.status||400,{error:error.status?error.message:'Solicitud inválida.'});}});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4173);createLocalServer().listen(port,'127.0.0.1',()=>console.log(`Robin Go: http://127.0.0.1:${port} · IA ${configured(chatConfig(process.env))?'configurada':'desactivada'}`));}
