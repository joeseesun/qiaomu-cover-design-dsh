async function runtime():Promise<{fs:typeof import('fs');path:typeof import('path')}>{
  const req=typeof window === 'undefined' ? undefined : (window as unknown as {require?:(id:string)=>unknown}).require;
  if(req)return {fs:req('fs') as typeof import('fs'),path:req('path') as typeof import('path')};
  return {fs:await import('node:fs'),path:await import('node:path')};
}
export interface FolderImage { name: string; path: string; type: string; size: number; modified: number }
const types: Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
/** Only regular files directly inside a user-chosen directory. Symlinks never grant extra access. */
export async function folderImages(folder:string):Promise<FolderImage[]>{
  const {fs:module,path}=await runtime(),fs=module.promises;
  if(!path.isAbsolute(folder))throw Error('Choose an absolute folder');
  const dir=await fs.realpath(folder),entries=await fs.readdir(dir,{withFileTypes:true}),out:FolderImage[]=[];
  for(const e of entries){const type=types[path.extname(e.name).toLowerCase()];if(!e.isFile()||!type)continue;
    const file=path.join(dir,e.name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>30*1024*1024||!stat.size)continue;
    out.push({name:e.name,path:file,type,size:stat.size,modified:stat.mtimeMs});
  }return out.sort((a,b)=>b.modified-a.modified||a.name.localeCompare(b.name));
}
export async function folderImageData(folder:string,image:FolderImage):Promise<ArrayBuffer>{
  const {fs:module,path}=await runtime(),fs=module.promises;
  const dir=await fs.realpath(folder),file=path.resolve(image.path);
  if(path.dirname(file)!==dir||!types[path.extname(file).toLowerCase()])throw Error('Image outside folder');
  const handle=await fs.open(file,module.constants.O_RDONLY|module.constants.O_NOFOLLOW);
  try{const stat=await handle.stat();if(!stat.isFile()||!stat.size||stat.size>30*1024*1024)throw Error('Image too large');const data=await handle.readFile();return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength) as ArrayBuffer;}
  finally{await handle.close();}
}
