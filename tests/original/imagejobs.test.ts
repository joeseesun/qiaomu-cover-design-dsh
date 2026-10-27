import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ImageJobs,type ImageJob,type ImageJobStore} from '../../src/original/imagejobs';
import type {ImageResult} from '../../src/original/seedream';
const output:ImageResult={pictures:[{data:new Uint8Array([1]).buffer,type:'image/png'},{data:new Uint8Array([2]).buffer,type:'image/png'}],warnings:[]};
const input={prompt:'make two',model:'fixture',path:'Test.qcover',layers:false};
function store(){const jobs=new Map<string,ImageJob>(),results=new Map<string,ImageResult>();return {jobs,results,list:async()=>[...jobs.values()].map(j=>structuredClone(j)),write:async(j:ImageJob,r?:ImageResult)=>{jobs.set(j.id,structuredClone(j));if(r)results.set(j.id,r);},result:async(j:ImageJob)=>results.get(j.id)!} satisfies ImageJobStore & {jobs:typeof jobs;results:typeof results};}
const until=async(test:()=>boolean)=>{for(let i=0;i<100&&!test();i++)await new Promise(r=>setTimeout(r,1));assert.ok(test());};
test('a closed frontend cannot lose images; completed candidates survive a new manager and no secret is stored',async()=>{
 const disk=store(),notices:string[]=[];let resolve!:(r:ImageResult)=>void,calls=0;
 const jobs=new ImageJobs(disk,j=>notices.push(j.id));const job=await jobs.submit(input,()=>{calls++;return new Promise(r=>resolve=r);});await until(()=>calls===1);jobs.dispose();resolve(output);await until(()=>job.state==='ready');assert.equal(notices.length,0);
 const restarted=new ImageJobs(disk,()=>{});await restarted.refresh();assert.equal(restarted.jobs.get(job.id)!.state,'ready');assert.equal((await restarted.result(job)).pictures.length,2);assert.equal(calls,1);assert.ok(!JSON.stringify([...disk.jobs.values()]).includes('apiKey'));
});
test('reload leaves pending tasks interrupted and never reissues a charged request; a late completion is recoverable',async()=>{
 const disk=store();let resolve!:(r:ImageResult)=>void,calls=0;const first=new ImageJobs(disk,()=>{});const job=await first.submit(input,()=>{calls++;return new Promise(r=>resolve=r);});await until(()=>calls===1);
 const next=new ImageJobs(disk,()=>{});await next.refresh();assert.equal(next.jobs.get(job.id)!.state,'interrupted');assert.equal(calls,1);first.dispose();resolve(output);await until(()=>job.state==='ready');await next.refresh();assert.equal(next.jobs.get(job.id)!.state,'ready');assert.equal(calls,1);
});
test('paid requests queue with at most two active; errors do not retry and retain the original prompt',async()=>{
 const disk=store(),jobs=new ImageJobs(disk,()=>{});let active=0,max=0,calls=0;const release:(()=>void)[]=[];
 const run=()=>{calls++;active++;max=Math.max(max,active);return new Promise<ImageResult>((resolve,reject)=>release.push(()=>{active--;calls===2?reject(Error('quota')):resolve(output);}));};
 const a=await jobs.submit(input,run),b=await jobs.submit(input,run),c=await jobs.submit(input,run);await until(()=>calls===2);assert.equal(c.state,'queued');release.shift()!();release.shift()!();await until(()=>calls===3);release.shift()!();await until(()=>c.state==='ready');assert.equal(max,2);assert.equal(calls,3);assert.equal(a.state,'failed');assert.equal(b.state,'failed');assert.equal(a.prompt,input.prompt);
});
