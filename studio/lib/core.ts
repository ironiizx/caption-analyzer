export type Metrics = { brightness:number; contrast:number; saturation:number; edges:number; palette:{color:string;share:number}[]; histogram:number[]; method:string };
export function pixelMetrics(rgba:ArrayLike<number>, width:number, height:number):Metrics {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4) throw new Error('Imagen inválida');
  const luma=new Float64Array(width*height), histogram=Array(16).fill(0), bins=new Map<string,{count:number;r:number;g:number;b:number}>();
  let sum=0,sq=0,sat=0;
  for(let i=0;i<luma.length;i++) {
    const alpha=rgba[i*4+3]/255;
    const r=(rgba[i*4]*alpha+255*(1-alpha))/255,g=(rgba[i*4+1]*alpha+255*(1-alpha))/255,b=(rgba[i*4+2]*alpha+255*(1-alpha))/255;
    const y=.2126*r+.7152*g+.0722*b, max=Math.max(r,g,b),min=Math.min(r,g,b),den=1-Math.abs(max+min-1);
    luma[i]=y;sum+=y;sq+=y*y;sat+=den>0?(max-min)/den:0;histogram[Math.min(15,Math.floor(y*16))]++;
    const key=[r,g,b].map(v=>Math.min(7,Math.floor(v*8))).join(','); const bin=bins.get(key)||{count:0,r:0,g:0,b:0};bin.count++;bin.r+=r*255;bin.g+=g*255;bin.b+=b*255;bins.set(key,bin);
  }
  let edges=0,available=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x,a=luma;
    const gx=-a[i-width-1]+a[i-width+1]-2*a[i-1]+2*a[i+1]-a[i+width-1]+a[i+width+1];
    const gy=-a[i-width-1]-2*a[i-width]-a[i-width+1]+a[i+width-1]+2*a[i+width]+a[i+width+1];
    if(Math.hypot(gx,gy)/4>.12)edges++;available++;
  }
  const n=luma.length,mean=sum/n;
  return {brightness:mean*100,contrast:Math.sqrt(Math.max(0,sq/n-mean*mean))*200,saturation:sat/n*100,edges:available?edges/available*100:0,
    histogram:histogram.map(v=>v/n),palette:[...bins.values()].sort((a,b)=>b.count-a.count).slice(0,5).map(v=>({color:'#'+[v.r,v.g,v.b].map(c=>Math.round(c/v.count).toString(16).padStart(2,'0')).join(''),share:v.count/n*100})),method:'sRGB ponderado · HSL por píxel · Sobel > 0,12 · muestra ≤ 320 px · transparencia sobre blanco'};
}
export function rate(clicks:number, impressions:number) {
 if(!Number.isSafeInteger(clicks)||!Number.isSafeInteger(impressions)||impressions<1||clicks<0||clicks>impressions||impressions>1e9)throw new Error('Usá impresiones enteras mayores a 0 y clics entre 0 e impresiones.');
 const p=clicks/impressions,z=1.95996398454,d=1+z*z/impressions,center=(p+z*z/(2*impressions))/d,half=z*Math.sqrt(p*(1-p)/impressions+z*z/(4*impressions*impressions))/d;
 return {ctr:p*100,low:Math.max(0,center-half)*100,high:Math.min(1,center+half)*100};
}
export function compareRates(a:{clicks:number;impressions:number},b:{clicks:number;impressions:number}) {
 const A=rate(a.clicks,a.impressions),B=rate(b.clicks,b.impressions);return{a:A,b:B,delta:B.ctr-A.ctr,uplift:A.ctr>0?(B.ctr/A.ctr-1)*100:null};
}
export function parseExperimentCsv(text:string) {
 const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(l=>l.trim());
 const delimiter=rows[0]?.includes(';')?';':',';
 if(rows.length!==3||rows[0].toLowerCase().split(delimiter).map(v=>v.trim()).join(',')!=='variante,impresiones,clics')throw new Error('Usá la plantilla: variante,impresiones,clics y dos filas A/B.');
 const data=rows.slice(1).map(r=>{const p=r.split(delimiter).map(v=>v.trim());if(p.length!==3||!/^\d+$/.test(p[1])||!/^\d+$/.test(p[2]))throw new Error('El CSV debe tener conteos enteros sin separadores de miles.');return {variant:p[0].toUpperCase(),impressions:Number(p[1]),clicks:Number(p[2])};});
 if(data[0].variant!=='A'||data[1].variant!=='B')throw new Error('Las filas deben ser A y B, en ese orden.');data.forEach(r=>rate(r.clicks,r.impressions));return data;
}
export function localReview(m:Metrics,width:number,height:number) {
 const result:{title:string;body:string;tone:string}[]=[];
 if(Math.abs(width/height-16/9)>.06)result.push({title:'Revisá el formato horizontal',body:'La proporción es distinta de 16:9. Comprobá el recorte antes de publicar; no estires la imagen.',tone:'attention'});
 if(width<1920||height<1080)result.push({title:'Revisá la resolución de origen',body:`El archivo mide ${width} × ${height}. Para tu entrega de 1920 × 1080, conviene exportar desde el original.`,tone:'attention'});
 if(m.brightness<25)result.push({title:'Una imagen de tono oscuro',body:'Probá la vista pequeña: fijate si la acción principal se sigue distinguiendo. El brillo bajo no es un error por sí solo.',tone:'attention'});
 if(m.contrast<20)result.push({title:'Tonos con poca separación global',body:'Comprobá si el sujeto se separa del fondo. Esta medida global no evalúa el contraste de cada objeto.',tone:'attention'});
 result.push({title:'Probá la lectura en pequeño',body:'Mirala a 160 px. ¿Se entiende la acción y se reconoce el elemento principal sin ampliar?',tone:'neutral'});
 result.push({title:'Compará una sola decisión',body:'Prepará una variante cambiando el tamaño del sujeto, el fondo o el texto. Así vas a poder explicar qué estás probando.',tone:'neutral'});
 return result.slice(0,3);
}
export const analysisSchema={type:'object',additionalProperties:false,properties:{caption:{type:'string'},understanding:{type:'string'},detected_text:{type:'string'},strengths:{type:'array',items:{type:'string'},maxItems:3},improvements:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},reason:{type:'string'},action:{type:'string'}},required:['title','reason','action']}},hypothesis:{type:'string'},limitations:{type:'string'}},required:['caption','understanding','detected_text','strengths','improvements','hypothesis','limitations']};
export type Analysis={caption:string;understanding:string;detected_text:string;strengths:string[];improvements:{title:string;reason:string;action:string}[];hypothesis:string;limitations:string};
export function parseAnalysis(response:any):Analysis {
 if(response.status!=='completed')throw new Error('El análisis no se completó.');
 const text=response.output?.flatMap((m:any)=>m.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('')||'';
 let a:any;try{a=JSON.parse(text);}catch{throw new Error('El modelo no devolvió un análisis válido.');}
 for(const k of ['caption','understanding','detected_text','hypothesis','limitations'])if(typeof a[k]!=='string')throw new Error('Respuesta incompleta.');
 if(!Array.isArray(a.strengths)||!a.strengths.every((v:any)=>typeof v==='string')||!Array.isArray(a.improvements)||a.improvements.some((v:any)=>!v||['title','reason','action'].some(k=>typeof v[k]!=='string')))throw new Error('Respuesta incompleta.');return a;
}
