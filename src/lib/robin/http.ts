import { NextResponse } from 'next/server';
import { StoreError } from './store.mjs';
export const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function problem(error:unknown){if(error instanceof StoreError)return reply({error:error.message},error.status);console.error('[Robin API] request failed');return reply({error:'No se pudo completar la operación. Comprueba la base y la migración 004.'},500);}
export async function input(req:Request){if(!req.headers.get('content-type')?.startsWith('application/json'))throw new StoreError(415,'Se requiere JSON.');const text=await req.text();if(new TextEncoder().encode(text).length>250000)throw new StoreError(413,'Solicitud demasiado grande.');try{return JSON.parse(text);}catch{throw new StoreError(400,'JSON inválido.');}}
