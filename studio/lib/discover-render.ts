import { fitImage, type Asset, type AssetKind, type Lab, type Rect, type Scene } from './discover';
import { demoSvg, demoBSvg } from './demo';

const svgData = (s: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const palettes = [['#0063db','#04e4ec','#fff337'],['#4c165e','#f64393','#fff4c6'],['#123e35','#8acb36','#fbf0aa'],['#251c48','#7864e9','#68ffde'],['#67381a','#ff9d35','#ffffdf'],['#123659','#03a3ff','#fff']];
const titles = ['SKY\nPILLARS','NIGHT\nESCAPE','WILD\nTYCOON','NEON\nARENA','BOX\nDUEL','FROST\nRUN'];
export const demoNeighbors: Asset[] = palettes.map((p, i) => ({ name: titles[i].replace('\n', ' '), width: 900, height: 900, src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/><circle cx="710" cy="190" r="150" fill="${p[2]}" opacity=".7"/><g stroke="${p[2]}" stroke-width="4" opacity=".25"><path d="M0 650L900 280M0 850L900 480M0 450L900 80M0 900L900 680"/></g><g stroke="#10142e" stroke-width="12">${[0,1,2].map((j) => `<path d="M${80+j*240} ${400-j*60}l110-55 110 55-110 55z" fill="${p[2]}"/><path d="M${80+j*240} ${400-j*60}v220l110 55V${455-j*60}z" fill="${p[1]}"/><path d="M${190+j*240} ${455-j*60}v220l110-55V${400-j*60}z" fill="${p[0]}"/>`).join('')}</g><g font-family="Arial,sans-serif" font-weight="900" font-style="italic" font-size="115" text-anchor="middle" stroke="#11152c" stroke-width="13" paint-order="stroke" fill="white"><text x="450" y="715">${titles[i].split('\n')[0]}</text><text x="450" y="825" fill="${p[2]}">${titles[i].split('\n')[1]}</text></g></svg>`) }));
export const demoMain: Record<'A'|'B', Asset> = { A: { src: svgData(demoSvg), name: 'VOLT RUN · A', width:1920,height:1080 }, B: { src: svgData(demoBSvg),name:'VOLT RUN · B',width:1920,height:1080 } };
const cache = new Map<string, Promise<HTMLImageElement>>();
export function imageFor(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src); if (!p) { p = new Promise((resolve,reject) => { const i = new Image(); i.onload=()=>resolve(i); i.onerror=()=>reject(new Error('No pudimos abrir una imagen del escenario.')); i.src=src; }); cache.set(src,p); if(cache.size>50) cache.delete(cache.keys().next().value!); } return p;
}
export async function readAsset(file: Blob, name: string, transparent = false): Promise<Asset> {
  if(file.size>12000000) throw new Error('Cada archivo puede pesar hasta 12 MB.');
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Usá PNG, JPG o WebP.');
  const url=URL.createObjectURL(file); let i: HTMLImageElement;
  try { i=await imageFor(url); } finally { URL.revokeObjectURL(url); cache.delete(url); }
  if(i.width*i.height>64000000) throw new Error('La imagen supera 64 megapíxeles.');
  const c=document.createElement('canvas'), scale=Math.min(1,2560/Math.max(i.width,i.height)); c.width=Math.round(i.width*scale);c.height=Math.round(i.height*scale);
  c.getContext('2d')!.drawImage(i,0,0,c.width,c.height);
  const src=c.toDataURL(transparent?'image/png':'image/jpeg',.92);
  if(src.length>8500000) throw new Error('La copia es demasiado pesada. Reducí la imagen antes de subirla.');
  return {src,name:name.slice(0,120),width:i.width,height:i.height};
}
export type Hit = { rect: Rect; index: number; row: number; own: boolean };
export type Rendered = { width:number;height:number;hits:Hit[] };
export async function renderLab(canvas: HTMLCanvasElement, lab: Lab, options: { scene?:Scene; guides?:boolean; selection?:boolean } = {}): Promise<Rendered> {
  const scene=options.scene||lab.scene, capture=scene==='capture'&&lab.capture;
  const assets=[...Object.values(lab.packs.A),...Object.values(lab.packs.B),...lab.neighbors,...demoNeighbors,...Object.values(demoMain),...(lab.capture?[lab.capture]:[])];
  const images=new Map<string,HTMLImageElement>(); await Promise.all(assets.map(async a=>{if(a)images.set(a.src,await imageFor(a.src));}));
  const w=capture?Math.max(1,Math.round(capture.width*Math.min(1,2560/Math.max(capture.width,capture.height)))):1920, h=capture?Math.max(1,Math.round(capture.height*w/capture.width)):1080;
  canvas.width=w;canvas.height=h; const c=canvas.getContext('2d')!; const hits:Hit[]=[];
  const rr=(r:Rect,radius=12)=>{c.beginPath();c.roundRect(r.x,r.y,r.w,r.h,radius);};
  const fill=(r:Rect,color:string,radius=0)=>{c.fillStyle=color;rr(r,radius);c.fill();};
  const text=(s:string,x:number,y:number,size:number,color='#fff',weight='600',max?:number)=>{c.fillStyle=color;c.font=`${weight} ${size}px Arial,sans-serif`;c.textBaseline='alphabetic'; if(max)c.fillText(s,x,y,max);else c.fillText(s,x,y);};
  const picture=(a:Asset,r:Rect,fit:'cover'|'contain'='cover',radius=12,own=false,transparent=false)=>{const img=images.get(a.src)!;c.save();rr(r,radius);c.clip();if(!transparent){c.fillStyle='#080820';c.fillRect(r.x,r.y,r.w,r.h);}const d=fitImage(img.width,img.height,r,fit,own?lab.focusX:.5,own?lab.focusY:.5);c.drawImage(img,d.x,d.y,d.w,d.h);c.restore();};
  const outline=(r:Rect,color='#fff',line=4)=>{c.strokeStyle=color;c.lineWidth=line;rr({x:r.x-line,y:r.y-line,w:r.w+line*2,h:r.h+line*2},14);c.stroke();};
  const pack=lab.packs[lab.active];
  const ownImage=(kind:AssetKind,r:Rect,radius=12)=>{
    const a=pack[kind];
    if(a)picture(a,r,lab.fit,radius,true,kind==='logo');else {fill(r,'#192443',radius);text(`SUBÍ TU ${kind==='banner'?'A-SPOT':kind==='portrait'?'PORTRAIT':kind==='logo'?'LOGO':'HORIZONTAL'}`,r.x+20,r.y+r.h*.5,Math.min(28,r.w/15),'#92a9cf','700',r.w-40);text(`VARIANTE ${lab.active}`,r.x+20,r.y+r.h*.5+35,Math.min(18,r.w/20),'#93a3bf');}
    if(lab.logo&&pack.logo&&kind!=='logo'){const logo=images.get(pack.logo.src)!;const d=fitImage(logo.width,logo.height,{x:r.x+r.w*.12,y:r.y+r.h*.68,w:r.w*.76,h:r.h*.24},'contain');c.drawImage(logo,d.x,d.y,d.w,d.h);}
    if((options.guides??lab.guides)){c.save();rr(r,radius);c.clip();c.fillStyle='#ffda4b44';c.fillRect(r.x,r.y,r.w,r.h*.15);c.fillRect(r.x,r.y+r.h*.85,r.w,r.h*.15);c.strokeStyle='#ffdb58';c.lineWidth=2;c.setLineDash([8,5]);c.strokeRect(r.x+1,r.y+r.h*.15,r.w-2,r.h*.7);c.restore();}
  };
  const badge=(r:Rect)=>{if(!lab.overlays)return;fill({x:r.x+8,y:r.y+r.h-35,w:78,h:28},'#07071be6',12);text('♥  —',r.x+20,r.y+r.h-14,19);};
  const tile=(r:Rect,index:number,row:number,kind:'portrait'|'landscape')=>{const own=index===lab.position&&row===lab.row;if(own)ownImage(kind,r);else picture(lab.neighbors.length?lab.neighbors[(index+row*3)%lab.neighbors.length]:demoNeighbors[(index+row*2)%demoNeighbors.length],r);badge(r);if(own&&options.selection!==false)outline(r,'#f3ff54');hits.push({rect:r,index,row,own});};
  fill({x:0,y:0,w,h},'#090525');
  if(capture){picture(capture,{x:0,y:0,w,h},'contain',0);const r={x:lab.rect.x*w,y:lab.rect.y*h,w:lab.rect.w*w,h:lab.rect.h*h};ownImage(lab.captureKind,r,lab.radius);if(options.selection!==false)outline(r,'#f3ff54',2);return {width:w,height:h,hits};}
  const grad=c.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#08071c');grad.addColorStop(.7,'#11083c');grad.addColorStop(1,'#101c62');c.fillStyle=grad;c.fillRect(0,0,w,h);
  fill({x:65,y:38,w:170,h:58},'#f0edff',12);text('DESCUBRIR',83,77,24,'#14112f','900');text(lab.title.toUpperCase(),265,78,26,'#c9c3e6','800',1000);text('SIMULACIÓN / TI',1645,77,19,'#b3a5e5');
  if(scene==='discover'){
    ['Para vos','Más de tu género','Nuevas experiencias'].forEach((name,row)=>{const y=163+row*284;text(name,68,y,35,'#fff','800');if(row===0)text('Un mismo contexto. Dos decisiones posibles.',68,y+31,20,'#a8a3bb');for(let i=0;i<7;i++)tile({x:70+i*264,y:y+55,w:236,h:133},i,row,'landscape');});
  }else if(scene==='portrait'){
    text('Top 10',70,188,42,'#fff','900');text('Tu arte vertical, en contexto',70,228,24,'#b5aecb');
    for(let i=0;i<7;i++){text(String(i+1),42+i*264,405,140,'#ffffff24','900');tile({x:74+i*264,y:282,w:226,h:301},i,lab.row,'portrait');}
    text('Seguí explorando',70,698,36,'#fff','800');for(let i=0;i<7;i++){picture(lab.neighbors[i%Math.max(1,lab.neighbors.length)]||demoNeighbors[i%6],{x:74+i*264,y:737,w:226,h:127});}
  }else if(scene==='detail'){
    text('Creado por · '+lab.creator,80,159,25,'#aaa4bd');text(lab.title.toUpperCase(),80,220,58,'#fff','italic 900',1700);
    const r={x:80,y:260,w:1248,h:702};ownImage('landscape',r);fill({x:1360,y:260,w:480,h:600},'#29277d',14);text('Acerca de la isla',1410,321,31);['Vista previa del proyecto',lab.creator,'Código · XXXX-XXXX-XXXX','Tu imagen a tamaño grande'].forEach((s,i)=>text(s,1400,405+i*71,23,'#e1dcff','500',405));
    fill({x:80,y:980,w:340,h:64},'#f3ff00',24);text('SELECCIONAR',135,1023,28,'#111025','900');text('Presentación visual · no abre Fortnite',454,1022,22,'#bbb4d6');
  }else if(scene==='banner'){
    text('Tu destacado',80,175,42,'#fff','900');text(`A-Spot · lienzo ajustable ${lab.bannerRatio}:1`,80,218,24,'#b9b2ce');
    ownImage('banner',{x:80,y:270,w:1760,h:1760/lab.bannerRatio});text('Más para explorar',80,850,32);for(let i=0;i<7;i++)picture(demoNeighbors[i%6],{x:80+i*260,y:887,w:231,h:130});
  }else if(scene==='capture'){
    text('Tu pantalla. Tu contexto.',270,460,70,'#fff','900');text('Cargá una captura de Fortnite y marcá el espacio de tu miniatura.',270,525,30,'#b9b3d4');
  }
  fill({x:0,y:1051,w:1920,h:29},'#070818');text('THUMBNAIL INSIGHTS · VISTA PREVIA INDEPENDIENTE · ESCENARIO DE EJEMPLO, SIN ESTADÍSTICAS REALES',70,1071,15,'#b9b5cf');
  return {width:w,height:h,hits};
}
