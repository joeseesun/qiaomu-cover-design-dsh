import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,readdir,access,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {DataAdapter} from 'obsidian';
import {VaultImageJobStore} from '../../src/original/imagejobstore';
import type {ImageJob} from '../../src/original/imagejobs';
test('task manifests publish without replacing existing files, and binary candidates survive fresh storage instances',async()=>{
 const root=await mkdtemp(join(tmpdir(),'imagejob-test-'));
 const full=(p:string)=>join(root,p);
 const adapter={exists:async(p:string)=>{try{await access(full(p));return true;}catch{return false;}},mkdir:async(p:string)=>{await mkdir(full(p));},read:async(p:string)=>readFile(full(p),'utf8'),write:async(p:string,s:string)=>writeFile(full(p),s),writeBinary:async(p:string,b:ArrayBuffer)=>writeFile(full(p),new Uint8Array(b)),readBinary:async(p:string)=>{const b=await readFile(full(p));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},rename:async(a:string,b:string)=>{try{await access(full(b));throw Error('Destination exists');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await rename(full(a),full(b));},list:async(p:string)=>{const es=await readdir(full(p),{withFileTypes:true});return {files:es.filter(e=>e.isFile()).map(e=>`${p}/${e.name}`),folders:es.filter(e=>e.isDirectory()).map(e=>`${p}/${e.name}`)};}} as unknown as DataAdapter;
 try{const store=new VaultImageJobStore(adapter,'jobs');const job:ImageJob={id:crypto.randomUUID(),created:Date.now(),prompt:'draw',model:'fixture',path:'Poster.qcover',layers:false,state:'queued'};
  await store.write(job);job.state='running';await store.write(job);job.state='ready';job.pictures=[{type:'image/png'},{type:'image/png',name:'second'}];await store.write(job,{pictures:job.pictures.map((p,i)=>({...p,data:new Uint8Array([i+1]).buffer})),warnings:[]});
  const next=new VaultImageJobStore(adapter,'jobs'),saved=(await next.list())[0]!;assert.equal(saved.state,'ready');assert.deepEqual((await next.result(saved)).pictures.map(p=>Array.from(new Uint8Array(p.data))),[[1],[2]]);assert.equal((await adapter.list(`jobs/${job.id}`)).files.filter(f=>f.endsWith('.json')).length,3);
 }finally{await rm(root,{recursive:true,force:true});}
});
