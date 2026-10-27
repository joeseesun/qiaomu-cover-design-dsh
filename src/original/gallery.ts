import { pictureIndex, removeGalleryEntries } from './gallery-actions';
import { Menu, Modal, Platform, setIcon } from '../harness-ui';
import type CoverPlugin from '../native-controller';
import type { CoverView } from './view';
import type { GeneratedPicture } from './seedream';
import type { ImageJob } from './imagejobs';
import type { GalleryImage } from './gallery-store';
import { folderImages, folderImageData } from './gallery-folders';
import { downloadPhoto, hasSource, searchPhotos, unsplashKey, type Photo, type Source } from './unsplash';
import { ImageResultsDialog } from './imagejobdialog';
import { emptyState, iconButton, quietName, textButton } from './ui';
export type GalleryTab = 'images' | 'tasks' | 'folders' | 'unsplash';
interface Entry { id:string; name:string; source:'generated'|'upload'|'folder'|'unsplash'; created:number; meta?:string; thumb?:string; photo?:Photo; data:()=>Promise<GeneratedPicture>; rename?:(name:string)=>Promise<void>; remove?:()=>Promise<void> }
const recommendations=new WeakMap<CoverPlugin,{at:number;source:string;photos:Photo[]}>();
/** One library for finished images; tasks and referenced folders retain their own ownership. */
export class GalleryDialog extends Modal {
  private tab:GalleryTab;private view?:CoverView;private closed=false;private busy=false;private token=0;private urls:string[]=[];private observer?:IntersectionObserver;private off?:()=>void;
  private selected=new Map<string,Entry>();private entries:Entry[]=[];private uploads:GalleryImage[]=[];private query='';private filter='all';private folder='';private page=1;private shown=48;
  private tabs!:HTMLElement;private tools!:HTMLElement;private body!:HTMLElement;private status!:HTMLElement;private count!:HTMLElement;private insert!:HTMLButtonElement;private upload!:HTMLInputElement;
  private deleteSelected!:HTMLButtonElement;private photos:Photo[]=[];private lastSearch='';private photoLoading=false;
  constructor(private plugin:CoverPlugin,tab:GalleryTab='images',view?:CoverView){super(plugin.app);this.tab=tab;this.view=view??plugin.activeCover();const cached=recommendations.get(plugin);if(cached&&Date.now()-cached.at<300000&&cached.source===`${plugin.settings.unsplashSecret}\0${plugin.settings.unsplashProxy}`)this.photos=cached.photos;}
  private w(zh:string,en:string):string{return this.plugin.isZh()?zh:en;}
  onOpen():void{
    this.closed=false;this.titleEl.setText(this.w('图库','Image library'));this.titleEl.addClass('qc-sr-only');this.modalEl.addClass('qc-gallery-modal');this.contentEl.addClass('qc-modal','qc-gallery');
    const el=this.contentEl;this.tabs=el.createDiv({cls:'qc-gallery-tabs',attr:{role:'tablist'}});quietName(this.tabs,this.w('图片来源','Image sources'));
    this.tools=el.createDiv('qc-gallery-tools');this.body=el.createDiv({cls:'qc-gallery-body',attr:{role:'tabpanel',tabindex:'0'}});
    const footer=el.createDiv('qc-gallery-footer');this.count=footer.createSpan('qc-gallery-count');this.status=footer.createSpan({cls:'qc-gallery-status',attr:{role:'status','aria-live':'polite'}});
    this.deleteSelected=iconButton(footer,'trash-2',this.w('删除选中图片','Delete selected images'),()=>this.removeSelection(),'qc-gallery-delete');
    this.insert=textButton(footer,this.w('插入画布','Insert into canvas'),()=>void this.apply(),'qc-primary','plus');
    this.upload=el.createEl('input',{cls:'qc-hidden',attr:{type:'file',accept:'image/png,image/jpeg,image/webp',multiple:''}});quietName(this.upload,this.w('上传图片','Upload images'),el);
    this.upload.addEventListener('change',()=>{const files=Array.from(this.upload.files??[]);this.upload.value='';void this.importFiles(files);});
    this.body.addEventListener('dragover',e=>{if(this.tab==='images'&&e.dataTransfer?.types.includes('Files')){e.preventDefault();this.body.addClass('is-drop');}});
    this.body.addEventListener('dragleave',()=>this.body.removeClass('is-drop'));
    this.body.addEventListener('drop',e=>{this.body.removeClass('is-drop');if(this.tab!=='images')return;e.preventDefault();void this.importFiles(Array.from(e.dataTransfer?.files??[]));});
    this.off=this.plugin.imageJobs.subscribe(()=>{if(!this.closed&&!this.busy&&(this.tab==='images'||this.tab==='tasks'))void this.draw();});
    void this.draw();void this.plugin.imageJobs.refresh().catch(e=>this.error(e));
  }
  private error(e:unknown):void{if(!this.closed)this.status.setText(e instanceof Error&&e.message==='key'?this.w('Unsplash 密钥不可用，请检查设置','Unsplash key unavailable. Check settings.'):e instanceof Error&&e.message==='limit'?this.w('Unsplash 请求额度已用尽，请稍后再试','Unsplash request limit reached. Try again later.'):e instanceof Error?e.message:String(e));}
  private async act(fn:()=>Promise<void>):Promise<void>{if(this.busy||this.closed)return;this.busy=true;this.sync();try{await fn();}catch(e){this.error(e);}finally{this.busy=false;if(!this.closed){this.sync();await this.draw();}}}
  private cleanup():void{this.observer?.disconnect();for(const u of this.urls)URL.revokeObjectURL(u);this.urls=[];}
  private async draw():Promise<void>{
    if(this.closed)return;const token=++this.token;this.cleanup();this.body.empty();this.tools.empty();this.tabs.empty();
    for(const [id,zh,en,icon] of [['images','我的图片','My images','images'],['tasks','生图任务','Generation tasks','sparkles'],['folders','本地文件夹','Local folders','folder-open'],['unsplash','Unsplash','Unsplash','camera']] as const){
      const b=textButton(this.tabs,this.w(zh,en),()=>{if(this.busy)return;this.tab=id;this.query='';this.shown=48;this.status.empty();void this.draw();},'',icon);b.dataset.tab=id;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(this.tab===id));b.id=`qc-gallery-tab-${id}`;b.tabIndex=this.tab===id?0:-1;
      b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const all=Array.from(this.tabs.querySelectorAll<HTMLButtonElement>('[role=tab]')),at=all.indexOf(b),next=e.key==='Home'?0:e.key==='End'?all.length-1:(at+(e.key==='ArrowRight'?1:-1)+all.length)%all.length;const id=all[next]!.dataset.tab;all[next]!.click();this.tabs.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`)?.focus();});
    }
    this.body.setAttribute('aria-labelledby',`qc-gallery-tab-${this.tab}`);
    if(this.tab==='tasks'){this.drawTasks();this.sync();return;}
    const search=this.tools.createEl('input',{type:'text',cls:'qc-gallery-search',attr:{placeholder:this.w(this.tab==='unsplash'?'搜索 Unsplash，回车查找':'搜索图片',this.tab==='unsplash'?'Search Unsplash, press Enter':'Search images')}});quietName(search,this.w('搜索图片','Search images'),this.tools);search.value=this.query;
    search.addEventListener('input',()=>{this.query=search.value;if(this.tab!=='unsplash'){this.shown=48;this.renderGrid();}});
    search.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&this.tab==='unsplash')void this.search();});
    try{
      if(this.tab==='images'){
        const filter=this.tools.createEl('select',{cls:'qc-select'});quietName(filter,this.w('来源筛选','Source filter'),this.tools);for(const [v,zh,en] of [['all','全部','All'],['generated','生成','Generated'],['upload','上传','Uploaded']])filter.createEl('option',{value:v,text:this.w(zh!,en!)});filter.value=this.filter;filter.addEventListener('change',()=>{this.filter=filter.value;this.shown=48;this.renderGrid();});
        textButton(this.tools,this.w('上传图片','Upload images'),()=>this.upload.click(),'qc-btn-sm','upload');
        this.uploads=await this.plugin.gallery.list();if(this.closed||token!==this.token)return;
        this.entries=[...this.uploads.map(image=>this.uploadEntry(image)),...this.generated()].sort((a,b)=>b.created-a.created);
      }else if(this.tab==='folders'){
        const folders=this.plugin.settings.galleryFolders,select=this.tools.createEl('select',{cls:'qc-select'});quietName(select,this.w('图片文件夹','Image folder'),this.tools);
        for(const f of folders)select.createEl('option',{value:f.id,text:f.name});if(!folders.some(f=>f.id===this.folder))this.folder=folders[0]?.id??'';select.value=this.folder;
        select.addEventListener('change',()=>{this.folder=select.value;this.shown=48;void this.draw();});
        textButton(this.tools,this.w('添加文件夹','Add folder'),()=>void this.addFolder(),'qc-btn-sm','folder-plus');
        const f=folders.find(x=>x.id===this.folder);if(f){iconButton(this.tools,'refresh-cw',this.w('刷新文件夹','Refresh folder'),()=>void this.draw());iconButton(this.tools,'folder-minus',this.w('移除文件夹引用','Remove folder reference'),()=>this.confirm(this.w('移除文件夹？','Remove folder?'),this.w('只移除图库中的引用，原文件保持不变。','Only removes this reference. Original files stay unchanged.'),()=>this.act(async()=>{this.plugin.settings.galleryFolders=folders.filter(x=>x.id!==f.id);await this.plugin.saveSettings();this.selected.forEach((e,id)=>{if(id.startsWith(`folder:${f.id}:`))this.selected.delete(id);});})));}
        if(!f){emptyState(this.body,{icon:'folder-open',title:this.w('连接你的图片文件夹','Connect an image folder'),hint:this.w('直接浏览 PNG、JPG、WebP；选中插入时才复制到封面。','Browse PNG, JPG and WebP. Images are copied only when inserted.'),actions:[{label:this.w('添加文件夹','Add folder'),run:()=>void this.addFolder(),primary:true}]});this.entries=[];this.sync();return;}
        const files=await folderImages(f.path);if(this.closed||token!==this.token)return;

        if(f.hidden?.length)textButton(this.tools,this.w(`已隐藏 ${f.hidden.length} 张`,`Hidden: ${f.hidden.length}`),()=>this.restoreFolder(f),'qc-btn-sm','eye-off');
        this.entries=files.filter(image=>!f.hidden?.includes(image.name)).map(image=>({id:`folder:${f.id}:${image.name}`,name:image.name,source:'folder' as const,created:image.modified,meta:f.name,data:async()=>({data:await folderImageData(f.path,image),type:image.type,name:image.name}),remove:async()=>{f.hidden=[...new Set([...(f.hidden??[]),image.name])];await this.plugin.saveSettings();}}));
      }else{
        textButton(this.tools,this.w('搜索','Search'),()=>void this.search(),'qc-btn-sm','search');
        if(!hasSource(this.source())){emptyState(this.body,{icon:'camera',title:this.w('连接 Unsplash','Connect Unsplash'),hint:this.w('使用你配置的 Access Key 或代理地址搜索摄影图片。','Search photography with your Access Key or proxy.'),actions:[{label:this.w('设置 Unsplash','Set up Unsplash'),run:()=>{this.close();this.plugin.openSettings('general');},primary:true}]});this.entries=[];this.sync();return;}
        this.entries=this.photos.map(photo=>this.photoEntry(photo));
        if(!this.photos.length&&!this.photoLoading){this.query='';search.value='';void this.search();}
      }
      for(const entry of this.entries)if(this.selected.has(entry.id))this.selected.set(entry.id,entry);
      this.renderGrid();this.sync();
    }catch(e){if(token===this.token){this.error(e);emptyState(this.body,{icon:'circle-alert',title:this.w('暂时无法读取图片','Could not read these images'),actions:[{label:this.w('重试','Retry'),run:()=>void this.draw()}]});}}
  }
  private uploadEntry(image:GalleryImage):Entry{return {id:`upload:${image.id}`,name:image.name,source:'upload',created:image.created,meta:`${image.width} × ${image.height}`,data:async()=>({data:await this.plugin.gallery.data(image),type:image.type,name:image.name}),rename:name=>this.plugin.gallery.rename(image,name),remove:()=>this.plugin.gallery.remove(image)};}
  private generated():Entry[]{return [...this.plugin.imageJobs.jobs.values()].filter(j=>j.state==='ready').flatMap(job=>(Array.isArray(job.pictures)?job.pictures:[]).map((pic,index)=>{
    const storageIndex=pic.storageIndex??index;
    return {id:`job:${job.id}:${storageIndex}`,name:pic.name||job.name||job.prompt.replace(/\s+/g,' ').slice(0,45)||this.w('生成图片','Generated image'),source:'generated' as const,created:job.created,meta:job.model,data:()=>this.plugin.imageJobs.picture(job,pictureIndex(job,storageIndex)),rename:name=>this.plugin.imageJobs.renamePicture(job,pictureIndex(job,storageIndex),name),remove:()=>this.plugin.imageJobs.removePicture(job,pictureIndex(job,storageIndex))};
  }));}
  private photoEntry(photo:Photo):Entry{return {id:`unsplash:${photo.id}`,name:photo.author,source:'unsplash',created:0,thumb:photo.thumb,photo,data:async()=>{const blob=await downloadPhoto(this.source(),photo);return {data:await blob.arrayBuffer(),type:blob.type,name:`Unsplash · ${photo.author} · ${photo.page}`};}};}
  private source():Source{return {key:unsplashKey(this.plugin.app,this.plugin.settings.unsplashSecret),proxy:this.plugin.settings.unsplashProxy};}
  private renderGrid():void{
    this.cleanup();this.body.empty();const token=this.token,entries=this.entries.filter(e=>(this.tab!=='images'||this.filter==='all'||e.source===this.filter)&&e.name.toLowerCase().includes(this.tab==='unsplash'?'':this.query.trim().toLowerCase()));
    if(!entries.length){emptyState(this.body,{icon:this.tab==='unsplash'?'camera':'images',title:this.w(this.tab==='unsplash'?'搜索一张好照片':this.query?'没有找到图片':'这里还没有图片',this.tab==='unsplash'?'Find a photograph':this.query?'No matching images':'No images yet'),...(this.tab==='images'&&!this.query?{actions:[{label:this.w('上传图片','Upload images'),run:()=>this.upload.click(),primary:true}]}:{})});return;}
    const grid=this.body.createDiv('qc-gallery-grid');let active=0;const queue:(()=>Promise<void>)[]=[];
    const pump=():void=>{while(active<4&&queue.length){const run=queue.shift()!;active++;void run().finally(()=>{active--;pump();});}};
    const lazy=new Map<Element,()=>Promise<void>>();const Win=this.contentEl.ownerDocument.defaultView! as Window & typeof globalThis;
    this.observer=new Win.IntersectionObserver(items=>{for(const item of items)if(item.isIntersecting){const fn=lazy.get(item.target);if(fn){lazy.delete(item.target);this.observer?.unobserve(item.target);queue.push(fn);pump();}}},{root:this.body,rootMargin:'120px'});
    for(const entry of entries.slice(0,this.shown)){
      const tile=grid.createDiv({cls:'qc-gallery-tile',attr:{'data-id':entry.id}}),card=tile.createEl('button',{cls:'qc-gallery-card',attr:{type:'button','aria-pressed':String(this.selected.has(entry.id))}});
      const image=card.createEl('img',{attr:{alt:entry.name,loading:'lazy'}});setIcon(card.createSpan('qc-gallery-check'),'check');card.createSpan({text:entry.name,cls:'qc-sr-only'});
      card.addEventListener('click',()=>{if(this.busy)return;if(this.selected.has(entry.id))this.selected.delete(entry.id);else if(this.selected.size<24)this.selected.set(entry.id,entry);else this.status.setText(this.w('一次最多选择 24 张图片','Select up to 24 images'));this.sync();});
      if(entry.thumb)image.src=entry.thumb;else{lazy.set(card,async()=>{try{if(this.closed||token!==this.token||!card.isConnected)return;const pic=await entry.data();if(this.closed||token!==this.token||!card.isConnected)return;
        const bitmap=await Win.createImageBitmap(new Blob([pic.data],{type:pic.type}));try{const canvas=this.contentEl.ownerDocument.createElement('canvas'),scale=Math.min(1,420/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/webp',0.8));if(blob&&!this.closed&&token===this.token&&card.isConnected){const url=URL.createObjectURL(blob);this.urls.push(url);image.src=url;}}
        finally{bitmap.close();}}catch{if(card.isConnected)tile.addClass('is-unavailable');}});this.observer.observe(card);}
      const copy=tile.createDiv('qc-gallery-tile-copy');copy.createSpan({text:entry.name,cls:'qc-gallery-name'});
      const actions=copy.createDiv('qc-gallery-tile-actions');iconButton(actions,'maximize-2',this.w('查看大图','View image'),()=>void this.preview(entry));
      if(entry.rename||entry.remove)iconButton(actions,'ellipsis',this.w('管理图片','Manage image'),ev=>{ev.preventDefault();ev.stopPropagation();const menu=new Menu().setUseNativeMenu(false).setParentElement(this.modalEl);if(entry.rename)menu.addItem(i=>i.setTitle(this.w('重命名','Rename')).setIcon('pencil').onClick(()=>this.rename(entry.name,name=>this.act(()=>entry.rename!(name)))));if(entry.remove)menu.addItem(i=>i.setTitle(this.w(entry.source==='folder'?'从图库隐藏':'删除图片',entry.source==='folder'?'Hide from library':'Delete image')).setIcon(entry.source==='folder'?'eye-off':'trash-2').onClick(()=>this.confirm(this.w(entry.source==='folder'?'从图库隐藏这张图片？':'删除这张图片？',entry.source==='folder'?'Hide this image?':'Delete this image?'),this.w(entry.source==='folder'?'只隐藏图库中的展示，原文件不变。可以从“已隐藏”恢复。':'删除图库中的图片；已经插入封面的副本不受影响。',entry.source==='folder'?'Hides the image here. Original files stay unchanged; restore from Hidden.':'Removes the library image. Copies inserted in covers stay unchanged.'),()=>this.act(async()=>{await entry.remove!();this.selected.delete(entry.id);})))) ;const rect=(ev.currentTarget as HTMLElement).getBoundingClientRect();menu.showAtPosition({x:rect.right,y:rect.bottom});});
      if(entry.photo){const credit=tile.createDiv('qc-gallery-credit');credit.createEl('a',{text:entry.photo.author,attr:{href:entry.photo.authorUrl,target:'_blank',rel:'noopener noreferrer'}});credit.createSpan({text:' · '});credit.createEl('a',{text:'Unsplash',attr:{href:entry.photo.page,target:'_blank',rel:'noopener noreferrer'}});}else tile.createDiv({text:entry.meta||this.w(entry.source==='generated'?'AI 生成':'上传图片',entry.source==='generated'?'AI generated':'Uploaded'),cls:'qc-gallery-meta'});
    }
    if(entries.length>this.shown)textButton(this.body,this.w('显示更多','Show more'),()=>{this.shown+=48;this.renderGrid();},'qc-btn-sm qc-gallery-load');
    if(this.tab==='unsplash'&&this.photos.length>=this.page*24)textButton(this.body,this.w('加载更多照片','Load more photos'),()=>void this.search(true),'qc-btn-sm qc-gallery-load');
  }
  private sync():void{if(this.closed)return;this.deleteSelected.disabled=this.busy||![...this.selected.values()].some(e=>e.remove);this.count.setText(this.selected.size?this.w(`已选 ${this.selected.size} 张`,`${this.selected.size} selected`):this.w('选择图片后插入画布','Select images to insert'));this.insert.disabled=this.busy||!this.selected.size||!this.view?.canvas;this.insert.setText(this.busy?this.w('处理中…','Working…'):this.w('插入画布','Insert into canvas'));this.contentEl.querySelectorAll('.qc-gallery-tile').forEach(tile=>tile.querySelector('.qc-gallery-card')?.setAttribute('aria-pressed',String(this.selected.has((tile as HTMLElement).dataset.id!))));if(!this.view?.canvas)this.status.setText(this.w('打开一张封面后即可插入','Open a cover to insert images'));}
  private removeSelection():void{
    if(this.busy||this.closed)return;
    const entries=[...this.selected.values()].filter(e=>e.remove);if(!entries.length)return;
    const local=entries.filter(e=>e.source==='folder').length,owned=entries.length-local,readonly=this.selected.size-entries.length;
    const title=this.w(owned?`删除选中的 ${entries.length} 张图片？`:`隐藏选中的 ${local} 张本地图片？`,owned?`Delete ${entries.length} selected images?`:`Hide ${local} local images?`);
    const parts:string[]=[];
    if(owned)parts.push(this.w(`${owned} 张生成或上传的图片将从图库永久删除。`,`${owned} generated or uploaded images will be permanently deleted from the library.`));
    if(local)parts.push(this.w(`${local} 张本地图片只从图库隐藏，原文件不变，可从“已隐藏”恢复。`,`${local} local images will only be hidden; originals stay unchanged and can be restored from Hidden.`));
    parts.push(this.w('已经插入封面的图片保持不变。','Images already inserted in covers stay unchanged.'));
    if(readonly)parts.push(this.w(`另外 ${readonly} 张 Unsplash 照片保留。`,`${readonly} Unsplash photos will be kept.`));
    this.confirm(title,parts.join(' '),()=>this.act(async()=>{
      const result=await removeGalleryEntries(entries,id=>this.selected.delete(id));
      this.status.setText(this.w(`已处理 ${result.removed} 张${result.failed?`，${result.failed} 张失败，保留选择可重试`:''}`,`${result.removed} removed${result.failed?`; ${result.failed} failed and remain selected for retry`:''}`));
    }));
  }
  private async apply():Promise<void>{if(this.busy||!this.selected.size||!this.view?.canvas)return;const view=this.view,guard=view.imageGuard();await this.act(async()=>{const pictures:GeneratedPicture[]=[];for(const e of this.selected.values()){if(this.closed)return;pictures.push({...await e.data(),name:e.source==='unsplash'?`Unsplash · ${e.photo!.author} · ${e.photo!.page}`:e.name});}
    if(await view.applyImageResult(pictures,undefined,false,()=>!this.closed&&guard())){await view.flush();this.close();}else throw Error(this.w('画布已经变动，请重新打开图库','Canvas changed. Reopen the library.'));});}
  private async importFiles(files:File[]):Promise<void>{if(!files.length)return;await this.act(async()=>{let added=0;const failed:string[]=[];for(const file of files.slice(0,50)){if(this.closed)break;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>30*1024*1024)throw Error('PNG / JPG / WebP, ≤30 MB');const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>36e6)throw Error('Image exceeds 36 MP');await this.plugin.gallery.add(file.name,file.type,await file.arrayBuffer(),bitmap.width,bitmap.height);added++;}finally{bitmap.close();}}catch{failed.push(file.name);}}
    this.tab='images';this.filter='all';this.query='';this.status.setText(this.w(`已上传 ${added} 张${failed.length?`，${failed.length} 张未导入（支持 PNG/JPG/WebP，≤30 MB、36 MP）`:''}`,`${added} uploaded${failed.length?`, ${failed.length} skipped (PNG/JPG/WebP, ≤30 MB and 36 MP)`:''}`));});}
  private async addFolder():Promise<void>{if(!Platform.isDesktopApp)return;await this.act(async()=>{const path=await this.plugin.chooseSystemFolder(this.contentEl.ownerDocument);if(!path||this.closed)return;await folderImages(path);const existing=this.plugin.settings.galleryFolders.find(f=>f.path===path);if(existing)this.folder=existing.id;else{if(this.plugin.settings.galleryFolders.length>=30)throw Error(this.w('最多添加 30 个文件夹','Add up to 30 folders'));const f={id:crypto.randomUUID(),path,name:path.split(/[\\/]/).filter(Boolean).pop()||path};this.plugin.settings.galleryFolders.push(f);this.folder=f.id;await this.plugin.saveSettings();}this.tab='folders';});}
  private restoreFolder(folder:CoverPlugin['settings']['galleryFolders'][number]):void{
    const modal=new Modal(this.plugin.app);modal.titleEl.setText(this.w('已隐藏的图片','Hidden images'));modal.contentEl.addClass('qc-modal');modal.modalEl.addClass('qc-gallery-hidden-modal');
    const hidden=(folder.hidden??[]).slice();textButton(modal.contentEl,this.w(`恢复全部 ${hidden.length} 张`,`Restore all ${hidden.length}`),()=>{modal.close();void this.act(async()=>{folder.hidden=[];await this.plugin.saveSettings();});},'qc-btn-sm','rotate-ccw');
    const list=modal.contentEl.createDiv('qc-gallery-hidden-list');for(const name of hidden){const row=list.createDiv('qc-gallery-hidden-row');row.createSpan({text:name});iconButton(row,'undo-2',this.w('恢复展示','Restore image'),()=>{void this.act(async()=>{folder.hidden=folder.hidden?.filter(x=>x!==name);await this.plugin.saveSettings();row.remove();if(!folder.hidden?.length)modal.close();});});}
    modal.open();
  }
  private async search(more=false):Promise<void>{if(this.photoLoading||!hasSource(this.source()))return;this.photoLoading=true;const query=this.query.trim();const append=more&&query===this.lastSearch,page=append?this.page+1:1;this.status.setText(this.w('正在搜索…','Searching…'));try{const photos=await searchPhotos(this.source(),query,page);if(this.closed||this.tab!=='unsplash'||this.query.trim()!==query)return;this.photos=append?[...this.photos,...photos]:photos;this.lastSearch=query;if(!query&&page===1)recommendations.set(this.plugin,{at:Date.now(),source:`${this.plugin.settings.unsplashSecret}\0${this.plugin.settings.unsplashProxy}`,photos:this.photos});this.page=page;this.shown=this.photos.length;this.entries=this.photos.map(p=>this.photoEntry(p));this.renderGrid();this.status.setText(photos.length?'':this.w('没有更多照片','No more photos'));}catch(e){this.error(e);}finally{this.photoLoading=false;if(!this.closed&&this.tab==='unsplash'&&this.query.trim()!==query)this.status.empty();}}
  private async preview(entry:Entry):Promise<void>{try{const pic=entry.source==='unsplash'?undefined:await entry.data();if(this.closed)return;const modal=new Modal(this.plugin.app);modal.titleEl.setText(entry.name);modal.modalEl.addClass('qc-image-preview-modal');modal.contentEl.addClass('qc-modal');const url=pic?URL.createObjectURL(new Blob([pic.data],{type:pic.type})):entry.photo!.regular;modal.contentEl.createEl('img',{cls:'qc-image-large-preview',attr:{src:url,alt:entry.name}});if(entry.photo){modal.contentEl.createEl('a',{text:`${entry.photo.author} · Unsplash`,attr:{href:entry.photo.page,target:'_blank',rel:'noopener noreferrer'}});}modal.onClose=()=>{if(pic)URL.revokeObjectURL(url);};modal.open();}catch(e){this.error(e);}}
  private drawTasks():void{
    const jobs=[...this.plugin.imageJobs.jobs.values()].filter(j=>!j.taskDeleted).sort((a,b)=>b.created-a.created);
    if(!jobs.length){emptyState(this.body,{icon:'sparkles',title:this.w('还没有生图任务','No generation tasks'),actions:this.view?[{label:this.w('AI 生图','Generate images'),run:()=>{this.close();this.view!.openImageGenerator();},primary:true}]:[]});return;}
    for(const job of jobs){const row=this.body.createDiv({cls:'qc-gallery-task',attr:{'data-job':job.id}}),top=row.createDiv('qc-gallery-task-top');top.createEl('strong',{text:job.name||job.prompt||this.w('图层拆分','Layer decomposition'),cls:'qc-gallery-task-title'});top.createSpan({text:this.w(({queued:'排队中',running:'生成中',ready:'已完成',failed:'失败',interrupted:'已中断'})[job.state],job.state),cls:`qc-gallery-task-state is-${job.state}`});
      row.createDiv({text:`${job.model} · ${new Date(job.created).toLocaleString()}${job.pictures?.length?` · ${job.pictures.length} ${this.w('张图片','images')}`:''}`,cls:'qc-gallery-meta'});
      if(job.name)row.createDiv({text:job.prompt,cls:'qc-gallery-task-prompt'});if(job.error)row.createDiv({text:job.error,cls:'qc-gallery-task-error'});
      const actions=row.createDiv('qc-gallery-task-actions');if(job.state==='ready'&&job.pictures?.length)textButton(actions,this.w('查看结果','View results'),()=>{this.close();new ImageResultsDialog(this.plugin,job).open();},'qc-btn-sm','images');
      const pending=job.state==='running'||job.state==='queued';
      const edit=textButton(actions,this.w('编辑再生成','Edit and regenerate'),()=>void this.editTask(job),'qc-btn-sm','pencil');edit.disabled=pending||!this.view?.canvas;
      const rename=iconButton(actions,'text-cursor-input',this.w('重命名任务','Rename task'),()=>this.rename(job.name||job.prompt,name=>this.act(()=>this.plugin.imageJobs.rename(job,name))));rename.disabled=pending;
      const del=iconButton(actions,'trash-2',this.w('删除任务记录','Delete task record'),()=>this.confirm(this.w(job.state==='queued'?'取消并删除排队任务？':'删除任务记录？',job.state==='queued'?'Cancel and delete queued task?':'Delete task record?'),this.w('已生成的图片仍保留在“我的图片”中。','Generated images stay in My images.'),()=>this.act(()=>this.plugin.imageJobs.removeRecord(job))));del.disabled=job.state==='running';
    }
  }
  private async editTask(job:ImageJob):Promise<void>{try{const file=this.plugin.app.vault.getFileByPath(job.path);if(file)await this.plugin.openDesign(file);const view=(this.plugin.app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>(l.view as CoverView).file?.path===job.path)?.view as CoverView|undefined)??this.view;if(!view?.canvas)throw Error(this.w('请先打开一张封面','Open a cover first'));if(this.closed)return;const recipe=await this.plugin.imageJobs.recipe(job);if(this.closed)return;this.close();view.openImageGenerator(undefined,{recipe});}catch(e){this.error(e);}}
  private rename(name:string,save:(name:string)=>Promise<void>):void{const modal=new Modal(this.plugin.app);modal.titleEl.setText(this.w('重命名','Rename'));modal.contentEl.addClass('qc-modal');const input=modal.contentEl.createEl('input',{type:'text',attr:{maxlength:'150'}});quietName(input,this.w('名称','Name'),modal.contentEl);input.value=name;const run=():void=>{if(input.value.trim()){modal.close();void save(input.value);}};textButton(modal.contentEl,this.w('保存','Save'),run,'qc-primary');input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing)run();});modal.open();input.focus();input.select();}
  private confirm(title:string,hint:string,run:()=>Promise<void>):void{const modal=new Modal(this.plugin.app);modal.titleEl.setText(title);modal.contentEl.addClass('qc-modal');modal.contentEl.createEl('p',{text:hint});const actions=modal.contentEl.createDiv('qc-gallery-confirm');textButton(actions,this.w('取消','Cancel'),()=>modal.close());textButton(actions,this.w(title.includes('隐藏')?'确认隐藏':'确认删除',title.includes('Hide')?'Hide':'Delete'),()=>{modal.close();void run();},'qc-primary');modal.open();}
  onClose():void{this.closed=true;this.token++;this.off?.();this.cleanup();this.contentEl.empty();}
}
