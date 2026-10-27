import { test } from 'node:test';
import assert from 'node:assert/strict';
import {folderPath,History,parseDesign,safeName,SerialWriter} from '../../src/original/model';
import {en,zh,translate} from '../../src/original/i18n';
const valid = {format:'qiaomu-cover-design',schema:1,width:960,height:1280,canvas:{objects:[]}};
test('design roundtrip and reject incompatible or broken dimensions',()=>{
  assert.equal(parseDesign(JSON.stringify(valid)).width,960);
  for(const change of [{schema:2},{width:0},{height:5000},{width:960.5},{canvas:null},{canvas:{objects:'broken'}}])assert.throws(()=>parseDesign(JSON.stringify({...valid,...change})));
  assert.throws(()=>parseDesign('broken'));
});
test('opening a design cannot trigger external image or prototype payloads',()=>{
  for(const src of ['https://example.com/a.png','file:///tmp/x','data:image/svg+xml;base64,abcd','javascript:x'])assert.throws(()=>parseDesign(JSON.stringify({...valid,canvas:{objects:[{type:'Image',src}]}})));
  assert.throws(()=>parseDesign(JSON.stringify(valid).replace('"objects":[]','"objects":[],"__proto__":{}')));
  assert.doesNotThrow(()=>parseDesign(JSON.stringify({...valid,canvas:{objects:[{type:'Image',src:'data:image/png;base64,YWJj'}]}})));
});
test('folder paths remain within vault; names cannot introduce nested folders',()=>{
  assert.equal(folderPath('Cover designs/Exports/'),'Cover designs/Exports');
  for(const path of ['/tmp/x','../x','x/../y','C:\\x','x//y','x/./y',''])assert.throws(()=>folderPath(path));
  assert.equal(safeName('../a/b:标题'),'a b 标题');
});
test('undo branch discards redo and bounds memory',()=>{
  const h=new History();h.reset('a');h.push('b');h.push('c');assert.equal(h.step(-1),'b');h.push('d');assert.equal(h.step(1),undefined);assert.equal(h.step(-1),'b');assert.equal(h.step(-1),'a');assert.equal(h.step(-1),undefined);
  for(let i=0;i<100;i++)h.push(String(i));let count=0;while(h.step(-1)!==undefined)count++;assert.equal(count,39);
});
test('writes stay ordered after failures, avoiding stale asynchronous saves',async()=>{
  const w=new SerialWriter();const result:number[]=[];
  const a=w.run(async()=>{await new Promise(r=>setTimeout(r,10));result.push(1);});
  const b=w.run(async()=>{result.push(2);throw new Error('failed');});
  const c=w.run(async()=>{result.push(3);});await Promise.allSettled([a,b,c]);assert.deepEqual(result,[1,2,3]);
});
test('complete zh/en keys and interpolation, deterministic unknown locale fallback',()=>{
  assert.deepEqual(Object.keys(en).sort(),Object.keys(zh).sort());
  for(const key of Object.keys(en) as (keyof typeof en)[]){assert.deepEqual(en[key].match(/\{\w+\}/g),zh[key].match(/\{\w+\}/g));}
  assert.equal(translate('zh-CN','exportDone',{path:'设计.png'}),'已导出：设计.png');assert.equal(translate('xx','save'),'Save');
});
import { SnapshotCodec, renderFilename, validBackground } from '../../src/original/model';
import { interpret } from '../../src/original/ops';
import { PLATFORMS } from '../../src/original/platforms';
test('snapshots share one copy of each embedded image and restore it exactly',()=>{
  const c=new SnapshotCodec();const img='data:image/png;base64,YWJj';
  const d={...valid,canvas:{objects:[{type:'Image',src:img}]}} as never;
  const a=c.encode(d),b=c.encode(d);assert.ok(!a.includes('base64'));assert.equal(a,b);
  assert.equal((c.decode(a).canvas.objects as {src:string}[])[0]!.src,img);
  assert.throws(()=>c.decode(a.replace('@img:0','@img:9')));
});
test('file names from templates are safe and background specs validated',()=>{
  const safe=renderFilename('{name}-{platform}/../x',{name:'封面 A',platform:'xhs'});assert.equal(safe,'封面-A-xhs-..-x');assert.ok(!/[\\/]/.test(safe));
  assert.equal(renderFilename('',{}),'Cover');
  assert.ok(validBackground({kind:'solid',color:'#ffffff'}));assert.ok(!validBackground({kind:'solid',color:'red'}));
  assert.ok(validBackground({kind:'linear',from:'#000000',to:'#ffffff',angle:90}));
});
test('offline commands map Chinese requests to ops; platform presets are valid',()=>{
  const base={zh:true,fonts:['PingFang SC'],size:{width:1,height:1}};
  assert.deepEqual(interpret({...base,prompt:'切换到 YouTube'}).ops,[{op:'platform',id:'youtube'}]);
  assert.deepEqual(interpret({...base,prompt:'背景改成深蓝渐变黑色'}).ops.map(o=>o.op),['background']);
  assert.ok(interpret({...base,prompt:'添加文字“限时福利”'}).ops.some(o=>o.op==='addText'));
  assert.equal(interpret({...base,prompt:'今天天气怎么样'}).ops.length,0);
  for(const p of PLATFORMS)assert.ok(p.width>=200&&p.height>=200&&p.width<=4096&&p.height<=4096);
});
