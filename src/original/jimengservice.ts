import { requestUrl } from '../harness-ui';
import { trimBase, type AiConfig } from './aiparse';
import { jimengBody } from './jimeng';
import type { SeedreamOptions, ImageResult, GeneratedPicture } from './seedream';
export async function jimengGenerate(c: AiConfig, prompt: string, width: number, height: number, options: SeedreamOptions = {}): Promise<ImageResult> {
  if (options.layers || options.transparent) throw new Error('Jimeng: transparency and layer decomposition are not supported');
  const body = jimengBody(c.imageModel, prompt, width, height, options.resolution, options.responseFormat ?? 'url');
  const own=!!c.imageBaseUrl.trim(), key=(own ? c.imageKey : c.imageKey || c.apiKey).trim();
  const request=await jimengInput(body,options.references??[]);
  const res=await requestUrl({url:`${trimBase(c.imageBaseUrl || c.baseUrl)}/images/${request.edit?'compositions':'generations'}`,method:'POST',contentType:request.contentType,headers:{Authorization:`Bearer ${key}`},body:request.body,throw:false});
  let payload:unknown; try {payload=res.json;} catch { /* plain error */ }
  const json=payload as {code?:number;message?:string;error?:{message?:string};data?:{url?:string;b64_json?:string}[]} | undefined;
  if(res.status>=400 || (json?.code !== undefined && json.code !== 0) || json?.error) throw new Error(`Jimeng HTTP ${res.status}: ${json?.message?.slice(0,240) ?? json?.error?.message?.slice(0,240) ?? 'request failed'}`);
  if (!Array.isArray(json?.data) || !json.data.length) throw new Error('Jimeng: no images returned');
  const pictures:GeneratedPicture[]=[], warnings:string[]=[];
  for(const item of json.data){try {
    let data:ArrayBuffer, type:string;
    if(item.b64_json){const bytes=Uint8Array.from(atob(item.b64_json),ch=>ch.charCodeAt(0));data=bytes.buffer;type=bytes[0]===0x89?'image/png':bytes[0]===0xff?'image/jpeg':String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':'';}
    else if(item.url && /^https:\/\//i.test(item.url)){const img=await requestUrl({url:item.url,throw:false});if(img.status>=400)throw Error(`Image download HTTP ${img.status}`);data=img.arrayBuffer;type=(img.headers['content-type']??'').split(';')[0]!.trim();}
    else throw Error('Jimeng: empty image item');
    if(!['image/png','image/jpeg','image/webp'].includes(type) || !data.byteLength)throw Error('Jimeng: invalid image response');
    pictures.push({data,type});
  }catch(e){warnings.push(e instanceof Error?e.message:String(e));}}
  if(!pictures.length)throw Error(warnings.join('\n') || 'Jimeng: no valid images');
  return {pictures,warnings};
}

/** The upstream compositions route accepts URL JSON or binary multipart, never a Seedream image field. */
async function jimengInput(body:Record<string,unknown>,refs:NonNullable<SeedreamOptions['references']>):Promise<{edit:boolean;contentType:string;body:string|ArrayBuffer}>{
  if(!refs.length)return {edit:false,contentType:'application/json',body:JSON.stringify(body)};
  if(refs.length>10)throw Error('Jimeng: at most 10 references');
  if(refs.every(r=>/^https:\/\//i.test(r.url)))return {edit:true,contentType:'application/json',body:JSON.stringify({...body,images:refs.map(r=>r.url)})};
  const boundary=`qc-${crypto.randomUUID()}`,encoder=new TextEncoder(),parts:Uint8Array[]=[];let total=0;
  const add=(text:string)=>parts.push(encoder.encode(text));
  for(const [key,value] of Object.entries(body))add(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${String(value)}\r\n`);
  for(const [index,ref] of refs.entries()){
    let bytes:Uint8Array,type:string;
    const data=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(ref.url);
    if(data){type=data[1]!;bytes=Uint8Array.from(atob(data[2]!),c=>c.charCodeAt(0));}
    else if(/^https:\/\//i.test(ref.url)){const res=await requestUrl({url:ref.url,throw:false});if(res.status>=400)throw Error(`Reference download HTTP ${res.status}`);bytes=new Uint8Array(res.arrayBuffer);type=(res.headers['content-type']??'').split(';')[0]!.trim();}
    else throw Error('Jimeng: invalid reference image');
    total+=bytes.byteLength;if(!bytes.byteLength||total>25*1024*1024||!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Jimeng: reference images exceed limits or use an unsupported format');
    add(`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="reference-${index}.${type==='image/jpeg'?'jpg':type.split('/')[1]}"\r\nContent-Type: ${type}\r\n\r\n`);parts.push(bytes);add('\r\n');
  }
  add(`--${boundary}--\r\n`);const joined=new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0));let offset=0;for(const part of parts){joined.set(part,offset);offset+=part.byteLength;}
  return {edit:true,contentType:`multipart/form-data; boundary=${boundary}`,body:joined.buffer};
}
