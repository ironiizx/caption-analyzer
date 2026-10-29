import {getChatGPTUser} from '@/app/chatgpt-auth';
import {config,json,readJson,checkOrigin} from '@/lib/server';
export async function GET(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:'Iniciá sesión para abrir tus proyectos.'},401);const {DB}=config();if(!DB)return json({error:'Almacenamiento no disponible.'},503);
 const id=new URL(req.url).searchParams.get('id');
 if(id){const row=await DB.prepare('SELECT payload FROM projects WHERE id=? AND owner=?').bind(id,user.userId).first<{payload:string}>();return row?json(JSON.parse(row.payload)):json({error:'Proyecto no encontrado.'},404);}
 const rows=await DB.prepare('SELECT id,name,updated FROM projects WHERE owner=? ORDER BY updated DESC LIMIT 40').bind(user.userId).all();return json({projects:rows.results});
}
export async function POST(req:Request){
 if(!checkOrigin(req))return json({error:'Origen no permitido.'},403);const user=await getChatGPTUser();if(!user)return json({error:'Iniciá sesión para guardar.'},401);const {DB}=config();if(!DB)return json({error:'Almacenamiento no disponible.'},503);
 try{const b=await readJson(req);if(typeof b.id!=='string'||!/^[\w-]{10,80}$/.test(b.id)||typeof b.name!=='string'||!b.name.trim()||b.name.length>120||!Array.isArray(b.variants)||b.variants.length>6)return json({error:'Proyecto inválido.'},400);
 for(const v of b.variants){if(typeof v.imageKey!=='string'||!v.imageKey.startsWith(user.userId+'/')||v.imageKey.length>220||!v.metrics||!Number.isFinite(v.width)||!Number.isFinite(v.height))return json({error:'Una imagen no pertenece a tu proyecto.'},400);delete v.src;}
 const old=await DB.prepare('SELECT owner FROM projects WHERE id=?').bind(b.id).first<{owner:string}>();if(old&&old.owner!==user.userId)return json({error:'Proyecto no disponible.'},403);
 const now=Date.now();await DB.prepare('INSERT INTO projects(id,owner,name,payload,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload=excluded.payload,updated=excluded.updated WHERE projects.owner=excluded.owner').bind(b.id,user.userId,b.name,JSON.stringify(b),now).run();return json({id:b.id,updated:now});
 }catch{return json({error:'No se pudo guardar. Exportá una copia y volvé a intentar.'},400);}
}
