import {randomUUID} from 'node:crypto';
import {listenOAuth} from './oauth-loopback';
import * as codex from './codex';
/** Bounded long-running operation handles; cancelled dialogs cannot retain a callback server. */
export class NativeJobs {
 jobs=new Map<string,any>();
 add(promise:Promise<any>,cancel:()=>void){if(this.jobs.size>=20)throw Error('Too many pending operations');const id=randomUUID();const job:any={state:'pending',cancel};this.jobs.set(id,job);const timer=setTimeout(()=>{cancel();this.jobs.delete(id);},11*60_000);timer.unref?.();job.timer=timer;promise.then(value=>{job.state='done';job.value=value;},error=>{job.state='error';job.error=error?.message||'Operation failed';});return id;}
 poll(id:string){const job=this.jobs.get(id);if(!job)throw Error('Operation expired');if(job.state==='pending')return{state:'pending'};clearTimeout(job.timer);this.jobs.delete(id);return{state:job.state,value:job.value,error:job.error};}
 cancel(id:string){const job=this.jobs.get(id);if(job){clearTimeout(job.timer);job.cancel();this.jobs.delete(id);}return null;}
 async oauth(request:any){if(this.jobs.size>=20)throw Error('Too many pending operations');if(typeof request.state!=='string'||request.state.length>200||!request.state)throw Error('Invalid OAuth state');const controller=new AbortController();const listener=await listenOAuth(request.state,controller.signal,!!request.tokenDance);const id=this.add(listener.result.then(url=>url.href),()=>{controller.abort();listener.close();});return{id,redirect:listener.redirect};}
 async login(request:any){if(this.jobs.size>=20)throw Error('Too many pending operations');const login=await codex.startCodexLogin(String(request.bin||''));const id=this.add(login.result,()=>login.cancel());return{id,url:login.url};}
 async call(request:any){const {method,args=[]}=request;const allowed=['detectCodex','codexAccount','codexModels','codexText','codexImage','warmCodex','shutdownCodex'];if(!allowed.includes(method)||!Array.isArray(args))throw Error('Unknown Codex operation');if(['codexText','codexImage'].includes(method))args[0]={...args[0],bin:codex.findCodex(String(args[0]?.bin||''))};if(method==='warmCodex')args[0]=codex.findCodex(String(args[0]||''));const result=await (codex as any)[method](...args);if(method==='codexImage')return{base64:Buffer.from(result.data).toString('base64'),type:result.type};return result??null;}
 dispose(){for(const id of this.jobs.keys())this.cancel(id);codex.cancelCodexLogins();codex.shutdownCodex();}
}
