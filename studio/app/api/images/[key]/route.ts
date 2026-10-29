import {getChatGPTUser} from '@/app/chatgpt-auth';
import {config,json,checkOrigin} from '@/lib/server';
export async function GET(_req:Request,{params}:{params:Promise<{key:string}>}){
 const user=await getChatGPTUser();if(!user)return json({error:'Iniciá sesión.'},401);const {BUCKET}=config();if(!BUCKET)return json({error:'Almacenamiento no disponible.'},503);
 const {key}=await params;if(!/^[\w-]{10,90}$/.test(key))return json({error:'Imagen inválida.'},400);
 const obj=await BUCKET.get(user.userId+'/'+key);if(!obj)return json({error:'Imagen no encontrada.'},404);
 return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
export async function POST(req:Request,{params}:{params:Promise<{key:string}>}){
 if(!checkOrigin(req))return json({error:'Origen no permitido.'},403);const user=await getChatGPTUser();if(!user)return json({error:'Iniciá sesión para guardar imágenes.'},401);const {BUCKET}=config();if(!BUCKET)return json({error:'Almacenamiento no disponible.'},503);
 const {key}=await params;if(!/^[\w-]{10,90}$/.test(key))return json({error:'Imagen inválida.'},400);
 const type=req.headers.get('content-type');if(!['image/png','image/jpeg','image/webp'].includes(type||''))return json({error:'Formato no admitido.'},415);
 if(Number(req.headers.get('content-length')||0)>1500000)return json({error:'Imagen demasiado grande.'},413);
 const reader=req.body?.getReader();if(!reader)return json({error:'Falta la imagen.'},400);let size=0,parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();return json({error:'Imagen demasiado grande.'},413);}parts.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,webp=new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP';
 if(!(type==='image/jpeg'&&jpg||type==='image/png'&&png||type==='image/webp'&&webp))return json({error:'El contenido no es una imagen compatible.'},400);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const imageKey=user.userId+'/'+hash;await BUCKET.put(imageKey,bytes,{httpMetadata:{contentType:type!}});return json({imageKey,url:'/api/images/'+hash});
}
