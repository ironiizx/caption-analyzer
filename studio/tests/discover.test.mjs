import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampRect, rectFromPoints, fitImage, freshLab, readLab, ratioWarning } from '../lib/discover.ts';
const asset = (src='data:image/png;base64,YQ==',width=1920,height=1080)=>({src,width,height,name:'test.png'});
test('capture selection normalizes reverse drags and clamps boundaries',()=>{
 assert.deepEqual(rectFromPoints({x:.8,y:.7},{x:.2,y:.1}),{x:.2,y:.1,w:.6000000000000001,h:.6});
 assert.deepEqual(rectFromPoints({x:-.2,y:-.1},{x:1.2,y:1.3}),{x:0,y:0,w:1,h:1});
 const r=clampRect({x:1,y:1,w:.4,h:.3}); assert.equal(r.x+r.w,1); assert.equal(r.y+r.h,1);
 assert.equal(clampRect({x:NaN,y:Infinity,w:0,h:-2}).w,.01);
});
test('cover and contain preserve aspect ratio with predictable focal position',()=>{
 const rect={x:10,y:20,w:100,h:100};
 assert.deepEqual(fitImage(200,100,rect,'cover'),{x:-40,y:20,w:200,h:100});
 assert.deepEqual(fitImage(200,100,rect,'contain'),{x:10,y:45,w:100,h:50});
 assert.equal(fitImage(200,100,rect,'cover',1).x,-90);
 assert.equal(fitImage(100,200,rect,'cover',.5,0).y,20);
});
test('backup round trip preserves independent A/B packages and alpha data',()=>{
 const lab=freshLab();lab.active='B';lab.scene='capture';lab.packs.A.landscape=asset();lab.packs.B.landscape=asset('data:image/jpeg;base64,Yg==');lab.packs.B.logo=asset('data:image/png;base64,Yw==',1440,608);lab.capture=asset();
 const parsed=readLab(JSON.parse(JSON.stringify(lab)));assert.deepEqual(parsed,lab);assert.notEqual(parsed.packs.A.landscape.src,parsed.packs.B.landscape.src);
});
test('backup disallows external images, SVG, excessive dimensions and payloads',()=>{
 for(const a of [asset('https://example.com/x.png'),asset('data:image/svg+xml;base64,YQ=='),asset(undefined,100000,100000),asset('data:image/png;base64,'+'A'.repeat(8500000))]){
 const lab=freshLab();lab.packs.A.landscape=a;assert.throws(()=>readLab(lab),/incompatible/);
 }
 const large=asset('data:image/png;base64,'+'A'.repeat(8000000));const lab=freshLab();lab.neighbors=Array(5).fill(large);assert.throws(()=>readLab(lab),/32 MB/);
});
test('backup sanitizes enum prototypes and bounds user positioning',()=>{
 const lab=readLab({...freshLab(),scene:'constructor',captureKind:'__proto__',position:100,row:-3,focusX:5,focusY:-1,title:'x'.repeat(100)});
 assert.equal(lab.scene,'discover');assert.equal(lab.captureKind,'landscape');assert.equal(lab.position,6);assert.equal(lab.row,0);assert.equal(lab.focusX,1);assert.equal(lab.focusY,0);assert.equal(lab.title.length,65);
});
test('format warnings distinguish landscape and portrait without inventing A-Spot dimensions',()=>{
 assert.equal(ratioWarning(asset(),'landscape'),false);assert.equal(ratioWarning(asset(),'portrait'),true);assert.equal(ratioWarning(asset(undefined,1440,1920),'portrait'),false);assert.equal(ratioWarning(asset(),'banner'),false);
});
