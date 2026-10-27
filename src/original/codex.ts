// Host-backed original Codex app-server protocol. The browser never spawns processes.
import {nativeHost} from '../harness-ui';
import {watchJob,cancelNativeJobs} from '../native-jobs';
export interface CodexOptions {bin:string;model?:string;timeoutSec?:number}
export interface CodexInfo {path:string;version?:string}
const call=(method:string,...args:any[])=>nativeHost().codexCall({method,args});
export const detectCodex=(custom:string):Promise<CodexInfo>=>call('detectCodex',custom);
export const codexAccount=(custom:string):Promise<{signedIn:boolean;label:string}>=>call('codexAccount',custom);
export const codexModels=(custom:string):Promise<{id:string;name?:string}[]>=>call('codexModels',custom);
export const codexText=(o:CodexOptions,system:string,user:string):Promise<string>=>call('codexText',o,system,user);
export async function codexImage(o:CodexOptions,prompt:string,references:string[]=[]){const result=await call('codexImage',o,prompt,references);return{data:Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)).buffer,type:result.type};}
export function warmCodex(bin:string){void call('warmCodex',bin).catch(()=>{});}
export function shutdownCodex(){void call('shutdownCodex').catch(()=>{});}
export function cancelCodexLogins(){cancelNativeJobs();}
export async function startCodexLogin(custom:string){const job=await nativeHost().codexLoginStart({bin:custom});return{url:job.url,...watchJob(job.id,'codexLoginPoll','codexLoginCancel')};}
