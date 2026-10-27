const LIMIT=32*1024*1024;
/** Host-side HTTP retains the original service clients while bounding remote responses. */
export async function boundedHttpRequest(request,{fetchImpl=fetch}={}){
 if(!request||typeof request.url!=='string')throw Error('Invalid HTTP request');
 let url=new URL(request.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('HTTP(S) URLs without embedded credentials are required');
 const method=String(request.method||'GET').toUpperCase();if(!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(method))throw Error('Unsupported HTTP method');
 const headers=new Headers(request.headers||{});if(request.contentType)headers.set('content-type',request.contentType);
 let body=request.base64?Buffer.from(request.base64,'base64'):request.body;if(body!=null&&(typeof body!=='string'&&!Buffer.isBuffer(body)))throw Error('Invalid request body');if(body&&Buffer.byteLength(body)>LIMIT)throw Error('HTTP request exceeds 32 MB');
 const signal=AbortSignal.timeout(180000);
 for(let hop=0;hop<5;hop++){
  const response=await fetchImpl(url,{method,headers,body:['GET','HEAD'].includes(method)?undefined:body,redirect:'manual',signal});
  if([301,302,303,307,308].includes(response.status)&&response.headers.get('location')){
   await response.body?.cancel();const target=new URL(response.headers.get('location'),url);
   // Provider credentials can be in headers or query strings. Never forward across origins.
   if(target.origin!==url.origin||!['http:','https:'].includes(target.protocol))throw Error('Cross-origin HTTP redirect refused');
   if(method!=='GET'&&method!=='HEAD')throw Error('Provider request redirect refused');url=target;continue;
  }
  if(Number(response.headers.get('content-length'))>LIMIT){await response.body?.cancel();throw Error('HTTP response exceeds 32 MB');}
  const chunks=[];let total=0;for await(const chunk of response.body||[]){total+=chunk.length;if(total>LIMIT)throw Error('HTTP response exceeds 32 MB');chunks.push(chunk);}
  return{status:response.status,headers:Object.fromEntries(response.headers),base64:Buffer.concat(chunks).toString('base64')};
 }
 throw Error('Too many HTTP redirects');
}
