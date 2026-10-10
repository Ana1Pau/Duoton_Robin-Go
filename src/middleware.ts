// LOCAL DEMO ONLY. Replace with real authentication + tenant authorization before hosting.
import {NextRequest,NextResponse} from 'next/server';
export function middleware(req:NextRequest){const host=req.headers.get('host')||'';if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host))return NextResponse.json({error:'Esta API es una demostración local. No tiene autenticación multiusuario.'},{status:403});if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.get('origin')!=='http://'+host)return NextResponse.json({error:'Origen no permitido.'},{status:403});return NextResponse.next();}
export const config={matcher:'/api/:path*'};
