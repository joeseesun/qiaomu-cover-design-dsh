import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jimengBody,jimengProtocol,jimengModels,JIMENG_MODELS} from '../../src/original/jimeng';
import {marqueeHits} from '../../src/original/marquee';
test('Jimeng self-hosted detection keeps other protocols and video separate; all seven mapped candidates are visible',()=>{
 assert.ok(jimengProtocol({imageEngine:'api',imageBaseUrl:'https://custom.invalid/v1',imageModel:'jimeng-4.5'}));assert.ok(jimengProtocol({imageEngine:'api',imageBaseUrl:'https://custom.invalid/jimeng-api/v1',imageModel:'jimeng'}));
 for(const engine of ['ark','gemini','openrouter','codex'] as const)assert.ok(!jimengProtocol({imageEngine:engine,imageBaseUrl:'https://custom.invalid/jimeng-api/v1',imageModel:'jimeng-4.5'}));
 assert.ok(!jimengProtocol({imageEngine:'api',imageBaseUrl:'https://custom.invalid/jimeng-api/v1',imageModel:'jimeng-video-3.0'}));assert.ok(!jimengProtocol({imageEngine:'api',imageBaseUrl:'https://api.openai.com/v1',imageModel:'gpt-image-1'}));
 const list=jimengModels('https://custom.invalid/v1',[{id:'jimeng'},{id:'jimeng-video-3.0'}]);assert.deepEqual(new Set(list.map(m=>m.id)),new Set(JIMENG_MODELS.map(m=>m.id)));assert.equal(list.length,7);assert.ok(!list.some(m=>/nanobanana/.test(m.id)));
});
test('Jimeng sends only ratio and resolution; nearest-ratio selection is symmetric',()=>{
 for(const [w,h,ratio] of [[1080,1080,'1:1'],[1200,1600,'3:4'],[1600,1200,'4:3'],[1920,1080,'16:9'],[1080,1920,'9:16'],[1500,600,'21:9']] as const){const body=jimengBody('jimeng-4.5','draw',w,h);assert.equal(body.ratio,ratio);assert.equal(body.resolution,'2k');assert.equal(body.intelligent_ratio,false);for(const key of ['n','size','width','height','watermark','image'])assert.ok(!(key in body));}
 assert.throws(()=>jimengBody('unknown','draw',100,100),/unknown/);assert.throws(()=>jimengBody('jimeng-video-3.0','draw',100,100),/unknown/);
});
test('partial marquee selects visible unlocked items while a full background needs complete enclosure',()=>{
 const items=[{box:{left:0,top:0,width:100,height:100},selectable:true,visible:true,background:true},{box:{left:20,top:20,width:20,height:20},selectable:true,visible:true,background:false},{box:{left:25,top:25,width:20,height:20},selectable:false,visible:true,background:false}];
 assert.deepEqual(marqueeHits({left:10,top:10,width:40,height:40},items),[1]);assert.deepEqual(marqueeHits({left:-1,top:-1,width:102,height:102},items),[0,1]);
});
