const p=app.plugins.plugins['qiaomu-cover-design'],wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(x,m)=>{if(!x)throw Error(m);};
assert(p,'Plugin not loaded');
const fs=require('fs'),path=require('path'),base=app.vault.adapter.basePath,pack=path.join(base,p.manifest.dir,'assets-pack.json.gz'),backup=pack+'.release-qa';
assert(!fs.existsSync(backup),'Existing QA backup'); if(fs.existsSync(pack))fs.renameSync(pack,backup);
try{
 const f=await p.createDesign('官方安装素材 QA '+Date.now(),'minimal',undefined,'创作，从一个想法开始','xhs');await wait(150);const v=app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>l.view.file?.path===f.path).view;while(v.restoring)await wait(20);
 const before=v.canvas.getObjects().length;await v.action(()=>v.addSticker('火箭'));await v.flush();await wait(250);assert(v.canvas.getObjects().length===before+1,'Bundled sticker missing');await v.action(()=>v.addIcon({op:'icon',want:{en:['star']},style:'line'}));assert(v.canvas.getObjects().length===before+2,'Bundled line icon missing');await v.flush();await v.travel(-1);assert(v.canvas.getObjects().length===before+1,'Asset undo failed');await v.travel(1);await v.flush();
 v.containerEl.querySelector('.qc-insert-asset').click();await wait(250);assert(document.querySelectorAll('.qc-asset').length>30,'Asset browser missing');document.querySelector('.qc-insert-x').click();
 return {threeFileAssets:true,stickers:true,lineIcons:true,undoRedo:true,file:f.path,minAppVersion:p.manifest.minAppVersion};
}finally{if(fs.existsSync(backup))fs.renameSync(backup,pack);}
