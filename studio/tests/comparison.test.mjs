import test from 'node:test';
import assert from 'node:assert/strict';
import { imageSignature, visualDifference, technicalChecks, parseComparison, validateComparison, predictionTiming } from '../lib/comparison.ts';
const solid = (r,g,b,a=255) => imageSignature(Array.from({length:96},()=>[r,g,b,a]).flat(),12,8);
test('reference grids distinguish a real spatial change from identical pixels',()=>{
 const a=solid(20,40,60);assert.equal(visualDifference(a,a).difference,0);
 const b=structuredClone(a);b.grid[0]=255;assert.ok(visualDifference(a,b).difference>0);assert.equal(visualDifference(a,b).cells.filter(x=>x>0).length,1);
 assert.equal(visualDifference(solid(0,0,0),solid(255,255,255)).difference,100);
});
test('transparent reference pixels are composited consistently over white',()=>assert.deepEqual(solid(200,0,10,0),solid(255,255,255)));
test('malformed signatures cannot produce a visual score',()=>{
 assert.throws(()=>visualDifference({grid:[1]},solid(0,0,0)));
 const bad=solid(0,0,0);bad.grid[30]=NaN;assert.throws(()=>visualDifference(bad,solid(0,0,0)));
 assert.throws(()=>imageSignature([1,2,3,4],.5,2));
});
test('original file metadata is required for file checks, not inferred from a working copy',()=>{
 const missing=technicalChecks({width:1920,height:1080});assert.equal(missing[2].state,'unknown');assert.equal(missing[3].state,'unknown');
 const good=technicalChecks({width:1920,height:1080,originalBytes:1024,originalType:'image/png'});assert.ok(good.every(x=>x.state==='ok'));
 const bad=technicalChecks({width:1440,height:1920,originalBytes:6*1024*1024,originalType:'image/webp'});assert.equal(bad[0].state,'review');assert.equal(bad[2].state,'review');assert.equal(bad[3].state,'review');
});
const sample={recommendation:'B',summary:'La acción se distingue.',reasons:[{title:'Escala',a:'Sujeto pequeño',b:'Sujeto grande'}],improvements:[{variant:'A',action:'Acercar el encuadre'}],hypothesis:'Probar la escala',limitations:'Preferencia visual, sin CTR previsto'};
test('incomplete, refused and malformed comparisons fail without a fabricated preference',()=>{
 for(const r of [{status:'incomplete'},{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}])assert.throws(()=>parseComparison(r));
 assert.throws(()=>validateComparison({...sample,recommendation:'75%'}));assert.throws(()=>validateComparison({...sample,reasons:[]}));assert.throws(()=>validateComparison({...sample,improvements:[{variant:'C',action:'x'}]}));
});
test('valid comparison retains both evidence and abstention',()=>{
 assert.deepEqual(parseComparison({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(sample)}]}]}),sample);
 assert.equal(validateComparison({...sample,recommendation:'tie'}).recommendation,'tie');
});
test('decisions recorded after or on the start date are not labeled prospective validation',()=>{
 assert.match(predictionTiming('2026-10-29T10:00:00Z','2026-10-20'),/No cuenta/);
 assert.match(predictionTiming('2026-10-20T01:00:00Z','2026-10-20'),/No cuenta/);
 assert.match(predictionTiming('2026-10-19T10:00:00Z','2026-10-20'),/antes del período/);
 assert.match(predictionTiming('invalid','2026-10-20'),/insuficiente/);
});
