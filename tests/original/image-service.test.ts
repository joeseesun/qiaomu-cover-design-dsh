import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { AI_DEFAULTS, type AiConfig } from '../../src/original/aiparse';

// Exercise the shipped service's request assembly with controlled provider transports.
const bundle = await build({ entryPoints: ['src/original/ai.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, plugins: [{ name: 'image-provider-fixture', setup(b) {
  b.onResolve({ filter: /harness-ui$/ }, () => ({ path: 'obsidian', namespace: 'fixture' }));
  b.onResolve({ filter: /^\.\/codex$/ }, () => ({ path: 'codex', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'obsidian'
    ? 'export const nativeHost = () => globalThis.__nativeHost; export const Platform = { isDesktopApp: true }; export const getLanguage = () => "zh"; export const requestUrl = request => globalThis.__imageRequest(request);'
    : 'export const findCodex = () => "fixture"; export const warmCodex = () => {}; export const codexText = () => { throw Error("layout planner called"); }; export const codexImage = (options, prompt) => globalThis.__codexImage(options, prompt);' }));
} }] });
const mod = { exports: {} as { AiService: new (cfg: () => AiConfig) => { image(prompt: string, w: number, h: number, style?: string, subject?: boolean, mode?: string): Promise<{ data: ArrayBuffer; type: string }> } } };
new Function('require', 'module', 'exports', bundle.outputFiles[0]!.text)(createRequire(import.meta.url), mod, mod.exports);
const { AiService } = mod.exports;
const hooks = globalThis as typeof globalThis & { __imageRequest?: (request: { body: string; url: string }) => unknown; __codexImage?: (options: unknown, prompt: string) => unknown };
const fixture = { data: new Uint8Array([1, 2, 3]).buffer, type: 'image/png' };

test('direct generation sends the user prompt to each image provider without cover rules or layout planning', async () => {
  const prompt = '一张书店海报，写上“周末读书”，纸张风格';
  for (const engine of ['api', 'ark', 'gemini', 'openrouter', 'codex'] as const) {
    const cfg: AiConfig = { ...AI_DEFAULTS, enabled: true, imageOn: true, imageEngine: engine, imageKey: 'fixture', imageModel: 'fixture-model', imageBaseUrl: 'https://fixture.invalid/v1' };
    let calls = 0;
    hooks.__imageRequest = request => {
      ++calls; const body = JSON.parse(request.body);
      assert.equal(body.prompt ?? body.contents?.[0]?.parts?.[0]?.text, prompt);
      return { status: 200, json: engine === 'gemini' ? { candidates: [{ content: { parts: [{ inlineData: { data: 'AQID', mimeType: 'image/png' } }] } }] } : { data: [{ b64_json: 'AQID', output_format: 'png' }] } };
    };
    hooks.__codexImage = (_options, text) => { ++calls; assert.ok(text.startsWith(prompt)); assert.ok(text.includes('Requested image size:')); assert.ok(!text.includes('No text')); return fixture; };
    try {
      const result = await new AiService(() => cfg).image(prompt, 1080, 1440, 'ignored cover style', false, 'direct');
      assert.equal(calls, 1, engine); assert.equal(result.type, 'image/png'); assert.equal(result.data.byteLength, 3);
    } finally { delete hooks.__imageRequest; delete hooks.__codexImage; }
  }
});
test('the cover image route retains its existing rules', async () => {
  const cfg: AiConfig = { ...AI_DEFAULTS, imageEngine: 'api', imageBaseUrl: 'https://fixture.invalid/v1' };
  hooks.__imageRequest = request => { const text = JSON.parse(request.body).prompt; assert.ok(text.includes('No text')); assert.ok(text.includes('paper style')); return { status: 200, json: { data: [{ b64_json: 'AQID', output_format: 'png' }] } }; };
  try { await new AiService(() => cfg).image('a bookstore', 1000, 1000, 'paper style'); } finally { delete hooks.__imageRequest; }
});
test('an image provider failure is surfaced without silently retrying a paid generation', async () => {
  let calls = 0;
  hooks.__imageRequest = () => { ++calls; return { status: 429, text: '{"error":{"message":"quota exceeded"}}' }; };
  try {
    await assert.rejects(new AiService(() => ({ ...AI_DEFAULTS, imageEngine: 'ark' })).image('test', 1000, 1000, '', false, 'direct'), /quota exceeded/);
    assert.equal(calls, 1);
  } finally { delete hooks.__imageRequest; }
});

test('Seedream returns every successful group image, reports partial errors and retains layer metadata', async () => {
  const cfg = { ...AI_DEFAULTS, imageOn: true, imageEngine: 'ark' as const, imageKey: 'fixture', imageModel: 'doubao-seedream-5-0-260128' };
  const service = new AiService(() => cfg) as InstanceType<typeof AiService> & { images(prompt: string, w: number, h: number, options: unknown): Promise<{ pictures: {type:string; zIndex?:number; box?:number[]}[]; warnings:string[]; usage?:unknown }> };
  let calls = 0;
  hooks.__imageRequest = request => { ++calls; const body=JSON.parse(request.body); assert.equal(body.sequential_image_generation_options.max_images, 3); assert.ok(!('n' in body)); return { status:200, json:{data:[{b64_json:'AQID',output_format:'png'}, {error:{code:'Filtered',message:'blocked'}}, {b64_json:'AQID',output_format:'jpeg'}],usage:{generated_images:2,total_tokens:100}} }; };
  try { const output=await service.images('three variants',1080,1440,{maxImages:3}); assert.equal(calls,1); assert.equal(output.pictures.length,2); assert.equal(output.pictures[1]!.type,'image/jpeg'); assert.match(output.warnings[0]!,/Filtered/); assert.deepEqual(output.usage,{generated_images:2,total_tokens:100}); }
  finally {delete hooks.__imageRequest;}
  cfg.imageModel='doubao-seedream-5-0-pro-260628';
  hooks.__imageRequest = () => ({status:200,json:{data:[{b64_json:'AQID',output_format:'jpeg',z_index:0},{b64_json:'AQID',output_format:'png',z_index:1,name:'Fox',bounding_box:{absolute:[10,20,100,200]}}]}});
  try { const output=await service.images('',1080,1440,{layers:true,size:'auto',references:[{url:'data:image/png;base64,AQID',width:1024,height:1024}]}); assert.deepEqual(output.pictures[1]!.box,[10,20,100,200]); assert.equal(output.pictures[1]!.zIndex,1); }
  finally {delete hooks.__imageRequest;}
});

test('reference editing cannot silently fall back to text-only generation', async () => {
  const cfg={...AI_DEFAULTS,imageOn:true,imageEngine:'api' as const,imageKey:'fixture',imageBaseUrl:'https://fixture.invalid'};
  let calls=0; hooks.__imageRequest=()=>{calls++;throw Error('should not request');};
  try { await assert.rejects((new AiService(()=>cfg) as InstanceType<typeof AiService> & {images(prompt:string,w:number,h:number,options:unknown):Promise<unknown>}).images('edit',1000,1000,{references:[{url:'data:image/png;base64,AQID',width:1024,height:1024}]}),/requires Seedream or Codex/); assert.equal(calls,0); }
  finally {delete hooks.__imageRequest;}
});

test('Jimeng preserves all candidates, business failures, auth/quota errors and never retries a generation POST',async()=>{
 const cfg={...AI_DEFAULTS,imageOn:true,imageEngine:'api' as const,imageBaseUrl:'https://fixture.invalid/jimeng-api/v1',imageKey:'fixture',imageModel:'jimeng-4.5'};
 const service=new AiService(()=>cfg) as InstanceType<typeof AiService> & {images(prompt:string,w:number,h:number,options?:unknown):Promise<{pictures:{type:string}[];warnings:string[]}>};let posts=0;
 hooks.__imageRequest=req=>{if(req.body){posts++;const b=JSON.parse(req.body);assert.equal(b.ratio,'3:4');assert.equal(b.resolution,'2k');assert.ok(!('size'in b));return {status:200,json:{data:[{url:'https://img.invalid/1'},{url:'https://img.invalid/2'},{url:'https://img.invalid/3'},{url:'https://img.invalid/4'}]}};}return {status:200,headers:{'content-type':'image/png'},arrayBuffer:fixture.data};};
 try{const r=await service.images('draw',1200,1600);assert.equal(r.pictures.length,4);assert.equal(posts,1);
  for(const [status,payload,expected] of [[200,{code:-2000,message:'invalid ratio',data:null},/invalid ratio/],[401,{},/401/],[429,{},/429/],[200,{data:[]},/no images/]] as const){posts=0;hooks.__imageRequest=()=>{posts++;return {status,json:payload};};await assert.rejects(service.images('draw',1200,1600),expected);assert.equal(posts,1);}
  hooks.__imageRequest=()=>({status:200,json:{data:[{b64_json:'iVBORw=='}]}});assert.equal((await service.images('draw',1000,1000,{responseFormat:'b64_json'})).pictures[0]!.type,'image/png');
  hooks.__imageRequest=()=>({status:200,json:{data:[{url:'https://img.invalid/html'}]},headers:{'content-type':'text/html'},arrayBuffer:fixture.data});await assert.rejects(service.images('draw',1000,1000),/invalid image/);
  posts=0;hooks.__imageRequest=req=>{posts++;assert.ok(req.url.endsWith('/images/compositions'));assert.ok(req.contentType.startsWith('multipart/form-data; boundary='));const text=new TextDecoder().decode(req.body);assert.ok(text.includes('name="images"; filename="reference-0.png"'));assert.ok(text.includes('name="model"\r\n\r\njimeng-4.5'));return {status:200,json:{data:[{b64_json:'iVBORw=='}]}};};assert.equal((await service.images('edit',1000,1000,{references:[{url:'data:image/png;base64,AQID',width:1000,height:1000}]})).pictures.length,1);assert.equal(posts,1);
  hooks.__imageRequest=req=>{assert.ok(req.url.endsWith('/images/compositions'));assert.deepEqual(JSON.parse(req.body).images,['https://img.invalid/reference.png']);return {status:200,json:{data:[{b64_json:'iVBORw=='}]}};};await service.images('edit',1000,1000,{references:[{url:'https://img.invalid/reference.png',width:1000,height:1000}]});
  posts=0;hooks.__imageRequest=()=>{posts++;throw Error('must not post');};await assert.rejects(service.images('edit',1000,1000,{references:Array.from({length:11},()=>({url:'data:image/png;base64,AQID',width:1000,height:1000}))}),/10 references/);assert.equal(posts,0);
 }finally{delete hooks.__imageRequest;}
});
