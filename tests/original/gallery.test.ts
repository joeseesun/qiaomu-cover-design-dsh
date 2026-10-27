import { pictureIndex, removeGalleryEntries } from '../../src/original/gallery-actions';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir,symlink,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GalleryStore} from '../../src/original/gallery-store';
import {folderImages,folderImageData} from '../../src/host-services/gallery-folders';
import {ImageJobs} from '../../src/original/imagejobs';
import {VaultImageJobStore} from '../../src/original/imagejobstore';
import {mergeSettings} from '../../src/original/config';
import {diskAdapter} from './helpers/adapter';
const bytes=(n:number)=>new Uint8Array([n]).buffer;
const result={pictures:[1,2,3].map(n=>({data:bytes(n),type:'image/png'})),warnings:[]};
const input={prompt:'fixture',model:'fixture model',path:'Gallery.qcover',layers:false};
const until=async(fn:()=>boolean)=>{for(let i=0;i<200&&!fn();i++)await new Promise(r=>setTimeout(r,2));assert.ok(fn());};
test('uploaded copies survive restart and rename; removing them leaves external originals alone',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-gallery-'));try{const adapter=diskAdapter(root),store=new GalleryStore(adapter,'library');await writeFile(join(root,'original.png'),new Uint8Array([7]));const image=await store.add('example','image/png',bytes(7),120,80);await store.rename(image,'New name');const next=new GalleryStore(adapter,'library'),saved=(await next.list())[0]!;assert.equal(saved.name,'New name');assert.deepEqual(await next.data(saved),bytes(7));await next.remove(saved);assert.deepEqual(await next.list(),[]);assert.deepEqual(await readFile(join(root,'original.png')),Buffer.from([7]));await assert.rejects(store.add('bad','image/svg+xml',bytes(1),100,100));await assert.rejects(store.remove({...image,id:'../original.png'}));await mkdir(join(root,'library',crypto.randomUUID()));assert.deepEqual(await next.list(),[]);}finally{await rm(root,{recursive:true,force:true});}
});
test('folder browsing ignores symlinks, nested directories and non-images; insertion verifies ownership again',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-folders-'));try{const folder=join(root,'photos');await mkdir(folder);await writeFile(join(folder,'safe.png'),Buffer.from([8]));await writeFile(join(root,'outside.webp'),Buffer.from([9]));await writeFile(join(folder,'note.txt'),'fixture');await mkdir(join(folder,'nested'));await symlink(join(root,'outside.webp'),join(folder,'linked.webp'));const rows=await folderImages(folder);assert.deepEqual(rows.map(r=>r.name),['safe.png']);assert.deepEqual(await folderImageData(folder,rows[0]!),bytes(8));await assert.rejects(folderImageData(folder,{...rows[0]!,path:join(root,'outside.webp')}));await rm(join(folder,'safe.png'));await symlink(join(root,'outside.webp'),join(folder,'safe.png'));await assert.rejects(folderImageData(folder,rows[0]!));await assert.rejects(folderImages('relative'));}finally{await rm(root,{recursive:true,force:true});}
});
test('task record deletion retains generated binaries; image deletion preserves other candidates across restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-history-'));try{const adapter=diskAdapter(root),store=new VaultImageJobStore(adapter,'jobs'),jobs=new ImageJobs(store,()=>{});const job=await jobs.submit(input,async()=>result);await until(()=>job.state==='ready');await jobs.renamePicture(job,2,'third');await jobs.removeRecord(job);assert.ok(job.taskDeleted);assert.equal((await jobs.result(job)).pictures.length,3);await jobs.removePicture(job,1);await assert.rejects(access(join(root,'jobs',job.id,'1.image')));const next=new ImageJobs(new VaultImageJobStore(adapter,'jobs'),()=>{});await next.refresh();const saved=next.jobs.get(job.id)!;assert.ok(saved.taskDeleted);const images=(await next.result(saved)).pictures;assert.deepEqual(images.map(p=>new Uint8Array(p.data)[0]),[1,3]);assert.equal(images[1]!.name,'third');await next.removePicture(saved,0);await next.removePicture(saved,0);assert.equal((await next.result(saved)).pictures.length,0);}finally{await rm(root,{recursive:true,force:true});}
});
test('deleting a queued task never calls its paid runner; running deletion is rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-queue-'));try{const jobs=new ImageJobs(new VaultImageJobStore(diskAdapter(root),'jobs'),()=>{});let resolveA!:(x:typeof result)=>void,resolveB!:(x:typeof result)=>void,calls=0;const a=await jobs.submit(input,()=>new Promise(r=>resolveA=r));const b=await jobs.submit(input,()=>new Promise(r=>resolveB=r));await until(()=>a.state==='running'&&b.state==='running'&&!!resolveB);const queued=await jobs.submit(input,async()=>{calls++;return result;});assert.equal(queued.state,'queued');await jobs.removeRecord(queued);await assert.rejects(jobs.removeRecord(a));resolveA(result);resolveB(result);await until(()=>a.state==='ready'&&b.state==='ready');assert.equal(calls,0);assert.ok(queued.taskDeleted);assert.equal(queued.state,'interrupted');}finally{await rm(root,{recursive:true,force:true});}
});
test('folder settings ignore malformed or relative paths and keep user-chosen absolute references',()=>{
 const cfg=mergeSettings({galleryFolders:[{id:'a',name:'Pictures',path:'/Users/example/Pictures',hidden:['one.png','../bad.png']},{id:'b',name:'bad',path:'relative'},null,{id:3,name:'bad',path:'/foo'}]});assert.deepEqual(cfg.galleryFolders,[{id:'a',name:'Pictures',path:'/Users/example/Pictures',hidden:['one.png']}]);
});
test('reference images stay outside manifests, replay hydrates them, and deleting a task cleans old prompts and references',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-recipe-'));try{const adapter=diskAdapter(root),store=new VaultImageJobStore(adapter,'jobs'),jobs=new ImageJobs(store,()=>{});const url='data:image/png;base64,AQ==';const job=await jobs.submit({...input,request:{modelId:'configured-model',width:160,height:100,options:{references:[{url,width:160,height:100}]}}},async()=>result);await until(()=>job.state==='ready');const saved=(await store.list())[0]!;assert.equal(saved.request!.options.references![0]!.url,'qcover-reference:0');const replay=await jobs.recipe(saved);assert.equal(replay.request!.options.references![0]!.url,url);await jobs.removeRecord(job);const files=(await adapter.list(`jobs/${job.id}`)).files;assert.equal(files.filter(f=>f.endsWith('.json')).length,1);assert.ok(!files.some(f=>f.endsWith('.reference')));const remaining=(await store.list())[0]!;assert.equal(remaining.prompt,'');assert.equal(remaining.request,undefined);assert.equal((await store.result(remaining)).pictures.length,3);}finally{await rm(root,{recursive:true,force:true});}
});

test('batch deletion resolves changing indices, keeps unselected siblings, and survives restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'qc-batch-'));try{const store=new VaultImageJobStore(diskAdapter(root),'jobs'),jobs=new ImageJobs(store,()=>{}),job=await jobs.submit(input,async()=>result);await until(()=>job.state==='ready');
 const entries=[0,1].map(id=>({id:String(id),remove:()=>jobs.removePicture(job,pictureIndex(job,id))})),done:string[]=[];
 assert.deepEqual(await removeGalleryEntries(entries,id=>done.push(id)),{removed:2,failed:0});assert.deepEqual(done,['0','1']);
 assert.deepEqual((await jobs.result(job)).pictures.map(p=>new Uint8Array(p.data)[0]),[3]);
 const next=new ImageJobs(new VaultImageJobStore(diskAdapter(root),'jobs'),()=>{});await next.refresh();const saved=next.jobs.get(job.id)!;assert.equal(pictureIndex(saved,2),0);assert.throws(()=>pictureIndex(saved,1));assert.deepEqual(new Uint8Array((await next.result(saved)).pictures[0]!.data),new Uint8Array([3]));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('batch failures retain failed selections and never delete read-only entries',async()=>{
 const selected=new Set(['a','failed','b','remote']);let active=0,max=0;
 const remove=async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;};
 const entries=[{id:'a',remove},{id:'failed',remove:async()=>{throw Error('disk unavailable');}},{id:'b',remove},{id:'remote'}];
 assert.deepEqual(await removeGalleryEntries(entries,id=>selected.delete(id)),{removed:2,failed:1});assert.equal(max,1);assert.deepEqual([...selected],['failed','remote']);
});
