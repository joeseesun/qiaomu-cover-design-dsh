import {access,mkdir,readFile,writeFile,readdir,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {DataAdapter} from 'obsidian';
export function diskAdapter(root:string):DataAdapter{
  const full=(p:string)=>join(root,p);
  return {exists:async(p:string)=>{try{await access(full(p));return true;}catch{return false;}},mkdir:async(p:string)=>{await mkdir(full(p));},read:async(p:string)=>readFile(full(p),'utf8'),write:async(p:string,s:string)=>writeFile(full(p),s),writeBinary:async(p:string,b:ArrayBuffer)=>writeFile(full(p),new Uint8Array(b)),readBinary:async(p:string)=>{const b=await readFile(full(p));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);},rename:async(a:string,b:string)=>{await rename(full(a),full(b));},remove:async(p:string)=>{await rm(full(p));},rmdir:async(p:string)=>{await rm(full(p),{recursive:true});},list:async(p:string)=>{const entries=await readdir(full(p),{withFileTypes:true});return {files:entries.filter(e=>e.isFile()).map(e=>`${p}/${e.name}`),folders:entries.filter(e=>e.isDirectory()).map(e=>`${p}/${e.name}`)};}} as unknown as DataAdapter;
}
