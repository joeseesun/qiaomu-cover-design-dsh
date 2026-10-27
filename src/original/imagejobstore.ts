import type { DataAdapter } from '../harness-ui';
import type { ImageJob, ImageJobStore } from './imagejobs';
import type { GeneratedPicture, ImageResult } from './seedream';
const validId=(id:string)=>/^[0-9a-f-]{36}$/i.test(id);
/** Binary results live beside the plugin, separately from secrets and canvas autosaves. */
export class VaultImageJobStore implements ImageJobStore {
  private stamp = 0;
  constructor(private adapter:DataAdapter,private root:string) {}
  private async folder(path:string):Promise<void>{if(!await this.adapter.exists(path)){try{await this.adapter.mkdir(path);}catch(e){if(!await this.adapter.exists(path))throw e;}}}
  async list():Promise<ImageJob[]> {
    if(!await this.adapter.exists(this.root))return [];
    const out:ImageJob[]=[];
    for(const folder of (await this.adapter.list(this.root)).folders){const id=folder.slice(folder.lastIndexOf('/')+1);if(!validId(id))continue;
      try{const files=(await this.adapter.list(`${this.root}/${id}`)).files.filter(f=>/\/\d{16}-[0-9a-f-]+\.json$/i.test(f)).sort().reverse();
        const manifest=files[0]??`${this.root}/${id}/job.json`;
        const j=JSON.parse(await this.adapter.read(manifest)) as ImageJob;
        if(j.id===id && typeof j.prompt==='string' && typeof j.model==='string' && typeof j.path==='string' && j.path.endsWith('.qcover') && !j.path.split('/').includes('..') && ['queued','running','ready','failed','interrupted'].includes(j.state))out.push(j);
      }catch{ /* A damaged task must not prevent plugin startup or hide other results. */ }
    }return out;
  }
  async write(job:ImageJob,output?:ImageResult):Promise<void>{
    if(!validId(job.id))throw Error('Invalid image task');
    await this.folder(this.root);const dir=`${this.root}/${job.id}`;await this.folder(dir);
    if(output)for(const [i,pic] of output.pictures.entries())await this.adapter.writeBinary(`${dir}/${i}.image`,pic.data);
    const manifest=structuredClone(job);
    if(manifest.request?.options.references)for(const [i,ref] of manifest.request.options.references.entries()){
      if(ref.url.startsWith('data:image/')){const file=`${dir}/${i}.reference`;if(!await this.adapter.exists(file))await this.adapter.write(file,ref.url);ref.url=`qcover-reference:${i}`;}
    }
    // Same-directory rename publishes the complete manifest only after all image files are saved.
    this.stamp=Math.max(Date.now(),this.stamp+1);
    const version=`${String(this.stamp).padStart(16,'0')}-${crypto.randomUUID()}`,tmp=`${dir}/${version}.tmp`;
    await this.adapter.write(tmp,JSON.stringify(manifest));await this.adapter.rename(tmp,`${dir}/${version}.json`);
  }
  async recipe(job:ImageJob):Promise<ImageJob>{
    if(!validId(job.id))throw Error('Invalid task');const copy=structuredClone(job);
    for(const ref of copy.request?.options.references??[]){const m=/^qcover-reference:(\d+)$/.exec(ref.url);if(m)ref.url=await this.adapter.read(`${this.root}/${job.id}/${Number(m[1])}.reference`);}
    return copy;
  }
  async forgetRecord(job:ImageJob):Promise<void>{
    if(!validId(job.id)||!job.taskDeleted)throw Error('Invalid task');const dir=`${this.root}/${job.id}`,files=(await this.adapter.list(dir)).files;
    const manifests=files.filter(f=>/\/\d{16}-[0-9a-f-]+\.json$/i.test(f)).sort().reverse();
    for(const file of files)if((manifests.includes(file)&&file!==manifests[0])||/\/\d+\.reference$/.test(file)||file===`${dir}/job.json`)await this.adapter.remove(file);
  }
  async picture(job:ImageJob,index:number):Promise<GeneratedPicture>{
    const meta=job.pictures?.[index],stored=meta?.storageIndex??index;
    if(!validId(job.id)||job.state!=='ready'||!meta||!Number.isInteger(stored)||stored<0)throw Error('Image unavailable');
    return {...meta,data:await this.adapter.readBinary(`${this.root}/${job.id}/${stored}.image`)};
  }
  async removeBinary(job:ImageJob,index:number):Promise<void>{
    if(!validId(job.id)||!Number.isInteger(index)||index<0)throw Error('Invalid image');
    const path=`${this.root}/${job.id}/${index}.image`;if(await this.adapter.exists(path))await this.adapter.remove(path);
  }
  async result(job:ImageJob):Promise<ImageResult>{
    if(!validId(job.id) || job.state!=='ready' || !Array.isArray(job.pictures))throw Error('Image results unavailable');
    const pictures=await Promise.all(job.pictures.map((_,i)=>this.picture(job,i)));
    return {pictures,warnings:job.warnings??[],usage:job.usage};
  }
}
