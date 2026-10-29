import {env} from 'cloudflare:workers';
export function config(){return env as unknown as {DB?:D1Database;BUCKET?:R2Bucket;OPENAI_API_KEY?:string;OPENAI_MODEL?:string};}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export async function readJson(req:Request,max=250000){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new Error('Formato no admitido.');
 if(Number(req.headers.get('content-length')||0)>max)throw new Error('Solicitud demasiado grande.');
 const reader=req.body?.getReader();if(!reader)throw new Error('Faltan datos.');let size=0,parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('Solicitud demasiado grande.');}parts.push(value);}
 const all=new Uint8Array(size);let at=0;for(const p of parts){all.set(p,at);at+=p.length;}return JSON.parse(new TextDecoder().decode(all));
}
export async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
