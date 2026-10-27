// Assistant commands on a real canvas: scene ids, targeted edits, palette tokens, library icons, one undo step per turn.
const p=app.plugins.plugins['qiaomu-cover-design'];p.settings.language='zh';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const folder='QCover QA';if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
const file=await p.createDesign('助手 '+Date.now(),'folio',undefined,'普通人如何用 AI 做副业','xhs');
await wait(900);
const v=app.workspace.getLeavesOfType('qiaomu-cover-design').map(l=>l.view).find(x=>x.file?.path===file.path);
const out={};const run=async ops=>{const r=await v.runAssistantOps(ops);await wait(60);return r;};
const nodes=()=>v.sceneNodes();const node=id=>nodes().find(n=>n.id===id);
out.scene=nodes().filter(n=>n.kind!=='effect').map(n=>`${n.id}:${n.kind}:${n.role??''}:${n.tone??''}`);
out.palette=v.currentPalette();
// icon from the library, beside the title, in the accent colour
let r=await run([{op:'icon',want:{zh:'吉他',en:['guitar','music']},style:'line',near:'title',side:'right',size:0.12,tone:'accent'}]);
const icon=nodes().find(n=>n.name==='line:guitar');out.icon={done:r.done,problems:r.problems,node:icon,picks:v.turnPicks?.length};
const title=nodes().find(n=>n.role==='title');
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
out.iconClearOfTitle=icon&&title?overlap(icon.box,title.box)/(icon.box.w*icon.box.h):null;
// move to a corner keeps the margin
r=await run([{op:'move',target:'#'+icon.id,to:'bottom-left'}]);const moved=node(icon.id);
out.move={problems:r.problems,box:moved.box,margin:Math.round(v.design.width*0.06)};
// resize, rotate, opacity, recolor
r=await run([{op:'resize',target:'#'+icon.id,scale:2},{op:'set',target:'#'+icon.id,rotate:15,opacity:0.6},{op:'recolor',target:'#'+icon.id,color:'#2563eb'}]);
const ic=node(icon.id);out.edit={problems:r.problems,w:ic.box.w,angle:ic.angle,opacity:ic.opacity,color:ic.color};
// a missing target is a problem, not a crash
r=await run([{op:'move',target:'#i99',to:'top'}]);out.missing=r.problems;
// text style by role
const sub=nodes().find(n=>n.role==='subtitle');
r=await run([{op:'style',target:'subtitle',scale:1.2,bold:true,letterSpacing:60}]);out.style={before:sub?.size,after:nodes().find(n=>n.role==='subtitle')?.size,problems:r.problems};
// palette: relative and explicit; layers that followed a token follow the new one
const before=v.currentPalette();
r=await run([{op:'recolor',target:'#'+icon.id,tone:'accent'},{op:'palette',adjust:'cooler'}]);
const after=v.currentPalette();const gObj=v.canvas.getObjects().find(o=>o.qcAsset==='line:guitar');out.outline={type:gObj.type,fill:gObj.fill??null,stroke:gObj.stroke,kids:(gObj.getObjects?.()??[]).map(c=>c.fill??null)};out.palette2={before:before.accent,after:after.accent,iconColor:node(icon.id).color,bg:v.design.bg,saved:v.design.palette?.accent};
r=await run([{op:'palette',mood:'graphite'}]);out.mood={bg:v.design.bg,titleColor:nodes().find(n=>n.role==='title')?.color,done:r.done};
// duplicate + distribute + layer + remove
r=await run([{op:'duplicate',target:'#'+icon.id,count:2}]);const copies=nodes().filter(n=>n.name==='line:guitar').map(n=>n.id);out.dup={copies,done:r.done};
r=await run([{op:'distribute',target:copies,axis:'horizontal'},{op:'layer',target:'#'+copies[0],to:'back'},{op:'remove',target:copies.slice(1)}]);
out.after={problems:r.problems,left:nodes().filter(n=>n.name==='line:guitar').map(n=>n.id),z:node(copies[0])?.z,fxBelow:nodes().filter(n=>n.kind==='effect').every(n=>n.z<node(copies[0]).z)};
// swap with a runner-up
await v.swapAsset(copies[0],'line','music');out.swap=node(copies[0])?.name;
// one assistant turn = one undo step (offline provider, three commands)
await v.flush();const count=()=>v.canvas.getObjects().length;const c0=count();
p.settings.assistant='offline';
await v.ask('加一个火箭贴纸');await wait(200);const c1=count();
const last=v.chat[v.chat.length-1];out.turn={added:c1-c0,text:last.text,applied:last.applied,picks:last.picks?.length};
await v.undo();await wait(200);out.undoOneStep=count()===c0;
await v.flush();const saved=JSON.parse(await app.vault.read(file));out.persisted={ids:saved.canvas.objects.filter(o=>o.qcId).length,total:saved.canvas.objects.length,palette:!!saved.palette,asset:saved.canvas.objects.filter(o=>o.qcAsset).map(o=>o.qcAsset)};
return out;
