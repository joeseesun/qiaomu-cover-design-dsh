import { Modal, Notice, setIcon } from '../harness-ui';
import { FabricImage, Group, type FabricObject } from 'fabric';
import type CoverPlugin from '../native-controller';
import { imageHash, type ImageJob } from './imagejobs';
import type { QObject } from './view';
import { iconButton, textButton } from './ui';

export class ImageResultsDialog extends Modal {
  private urls:string[]=[];private closed=false;private busy=false;
  constructor(private plugin:CoverPlugin,private job:ImageJob){super(plugin.app);}
  onOpen():void{this.closed=false;this.titleEl.setText(this.plugin.t('imageViewResults'));this.modalEl.addClass('qc-image-generate-modal');this.contentEl.addClass('qc-modal','qc-image-generate');void this.draw().catch(e=>{if(!this.closed)this.contentEl.createDiv({text:String(e),cls:'qc-hint'});});}
  private async draw():Promise<void>{
    const p=this.plugin,t=p.t.bind(p),job=this.job,output=await p.imageJobs.result(job);if(this.closed)return;
    const el=this.contentEl;el.empty();el.createDiv({text:job.prompt||t('imageDecompose'),cls:'qc-image-task-prompt'});el.createDiv({text:job.path,cls:'qc-hint'});
    const status=el.createDiv({cls:'qc-image-status',attr:{role:'status','aria-live':'polite'}});
    status.setText([t('imageResultsReady',{count:output.pictures.length}),...output.warnings].join('\n'));
    const grid=el.createDiv('qc-image-result-grid'),chosen=new Set<number>([0]);
    const apply=async(replace:boolean):Promise<void>=>{
      if(this.busy || !chosen.size)return;this.busy=true;sync();
      try{
        const file=p.app.vault.getFileByPath(job.path);if(!file)throw Error(t('imageTaskFileMissing'));
        await p.openDesign(file);const v=p.app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>(l.view as {file?:{path:string}}).file?.path===job.path)?.view;
        const view=v as import('./view').CoverView | undefined;if(!view?.canvas || !view.design || this.closed)throw Error(t('imageNotInserted'));
        let target:FabricImage|undefined;
        if(replace && job.target){const flatten=(objects:FabricObject[]):FabricObject[]=>objects.flatMap(o=>o instanceof Group?[o,...flatten(o.getObjects())]:[o]);const candidate=flatten(view.canvas.getObjects()).find(o=>(o as QObject).qcImageId===job.target!.id) as FabricImage | undefined;
          if(!candidate || !(candidate instanceof FabricImage) || await imageHash(candidate.getSrc())!==job.target.hash)throw Error(t('imageOriginalChanged'));target=candidate;}
        const guard=view.imageGuard(target),indices=job.layers?output.pictures.map((_,i)=>i):[...chosen];
        const pictures=indices.map(i=>({...output.pictures[i]!, name:output.pictures[i]!.name??`${job.prompt.replace(/\s+/g,' ').slice(0,28)||t('imageResult')} ${i+1}`}));
        if(await (replace && job.selection ? view.replaceImageSelection(pictures[0]!,job.selection,()=>!this.closed&&guard()) : view.applyImageResult(pictures,target,job.layers,()=>!this.closed&&guard()))){await view.flush();new Notice(t('imageInserted'));this.close();}else status.setText(t('imageNotInserted'));
      }catch(e){if(!this.closed)status.setText(e instanceof Error?e.message:String(e));}finally{this.busy=false;if(!this.closed)sync();}
    };
    for(const [i,pic] of output.pictures.entries()){
      const url=URL.createObjectURL(new Blob([pic.data],{type:pic.type}));this.urls.push(url);
      const tile=grid.createDiv('qc-image-result-tile');
      iconButton(tile,'maximize-2',t('imageLargePreview'),()=>{const modal=new Modal(p.app);modal.titleEl.setText(pic.name??`${t('imageResult')} ${i+1}`);modal.modalEl.addClass('qc-image-preview-modal');modal.contentEl.addClass('qc-modal');modal.contentEl.createEl('img',{cls:'qc-image-large-preview',attr:{src:url,alt:pic.name??`${t('imageResult')} ${i+1}`}});modal.open();},'qc-image-expand');
      const card=tile.createEl('button',{cls:'qc-image-result-card',attr:{type:'button','aria-pressed':String(job.layers || i===0)}});setIcon(card.createSpan({cls:'qc-image-result-check'}),'check');card.createEl('img',{attr:{src:url,alt:pic.name??`${t('imageResult')} ${i+1}`}});card.createSpan({text:pic.name??pic.size??`${i+1}`});
      card.addEventListener('click',()=>{if(this.busy||job.layers)return;if(chosen.has(i))chosen.delete(i);else chosen.add(i);card.setAttribute('aria-pressed',String(chosen.has(i)));sync();});
    }
    const actions=el.createDiv('qc-image-result-actions');
    const insert=textButton(actions,t(job.layers?'imageInsertLayers':job.target||job.selection?'imageInsertCopy':'imageInsertSelected'),()=>void apply(false),'qc-primary');
    const replace=(job.target||job.selection)&&!job.layers?textButton(actions,t(job.selection?'imageReplaceSelection':'imageReplaceOriginal'),()=>void apply(true)):undefined;
    const continueButton=textButton(actions,t('imageContinueCreate'),()=>void (async()=>{
      if(this.busy||chosen.size!==1)return;this.busy=true;sync();
      try{const file=p.app.vault.getFileByPath(job.path);if(!file)throw Error(t('imageTaskFileMissing'));await p.openDesign(file);const view=p.app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>(l.view as {file?:{path:string}}).file?.path===job.path)?.view as import('./view').CoverView|undefined;if(!view||this.closed)return;
        const pic=output.pictures[[...chosen][0]!]!,url=await view.prepareImage(new Blob([pic.data],{type:pic.type})),image=new view.win.Image();image.src=url;await image.decode();if(this.closed)return;
        this.close();view.openImageGenerator(undefined,{reference:{url,width:image.naturalWidth,height:image.naturalHeight},selection:job.selection,target:job.target,previousPrompt:job.prompt});
      }catch(e){if(!this.closed)status.setText(String(e));}finally{this.busy=false;if(!this.closed)sync();}
    })(),'qc-btn-sm','image-pen');
    const sync=():void=>{continueButton.disabled=this.busy||chosen.size!==1;insert.disabled=this.busy||!chosen.size;if(replace)replace.disabled=this.busy||chosen.size!==1;};
    textButton(el,t('imageTasks'),()=>{this.close();p.openImageTasks();},'qc-btn-sm');sync();
  }
  onClose():void{this.closed=true;for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];this.contentEl.empty();}
}
