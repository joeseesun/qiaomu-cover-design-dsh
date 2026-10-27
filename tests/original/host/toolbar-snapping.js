// Actual Fabric pointer drags at several zoom levels; independent insertion panels and unobstructed fit controls.
const p=app.plugins.plugins['qiaomu-cover-design'],wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(x,m)=>{if(!x)throw Error(m);};
document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0}));
const file=await p.createDesign('吸附和插入 QA '+Date.now(),'minimal',undefined,'吸附验收','xhs');await wait(150);const v=app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>l.view.file?.path===file.path).view;for(let i=0;v.restoring&&i<100;i++)await wait(20);
const oldLabels=p.settings.toolbarLabels,oldSnap=p.settings.guides.snap,oldWidth=v.contentEl.style.width,results={};
const emit=(target,type,x,y)=>target.dispatchEvent(new MouseEvent(type,{clientX:x,clientY:y,button:0,buttons:type==='mouseup'?0:1,bubbles:true,cancelable:true}));
try {
 p.settings.guides.snap=true;v.canvas.clear();const shape=v.addShape('rect');shape.set({left:100,top:350,width:400,height:100,strokeWidth:0,scaleX:1,scaleY:1,angle:0});shape.setCoords();
 for(const zoom of [.25,.55,1]){
  v.setZoom(zoom);shape.set({left:100,top:350});shape.setCoords();v.canvas.setActiveObject(shape);v.canvas.requestRenderAll();await wait(40);
  const rect=v.canvas.upperCanvasEl.getBoundingClientRect(),x=n=>rect.left+n*zoom,y=n=>rect.top+n*zoom;
  emit(v.canvas.upperCanvasEl,'mousedown',x(300),y(400));const positions=[];
  // The pointer advances inside the release radius; the right edge must stay exactly on x=540.
  for(const offset of [-5,-3,-1,1,3,5,7,9]){const raw=140+offset/zoom;emit(document,'mousemove',x(300+raw-100),y(400));positions.push(shape.left);}
  assert(positions.every(n=>Math.abs(n-140)<.01),`Snap oscillation at ${zoom}: ${positions}`);
  const raw=140+12/zoom;emit(document,'mousemove',x(300+raw-100),y(400));assert(Math.abs(shape.left-raw)<=1/zoom,`Snap failed to release at ${zoom}: ${shape.left}`);
  emit(document,'mouseup',x(300+raw-100),y(400));assert(!v.containerEl.querySelector('.qc-snap-v'),'Guides not cleared after drag');
  results[zoom]={stableFrames:positions.length,released:true};
 }
 p.settings.guides.snap=false;v.setZoom(.55);shape.set({left:100,top:350});shape.setCoords();v.canvas.setActiveObject(shape);v.canvas.requestRenderAll();await wait(40);const r=v.canvas.upperCanvasEl.getBoundingClientRect();emit(v.canvas.upperCanvasEl,'mousedown',r.left+300*.55,r.top+400*.55);emit(document,'mousemove',r.left+322*.55,r.top+400*.55);emit(document,'mouseup',r.left+322*.55,r.top+400*.55);assert(Math.abs(shape.left-122)<=1/.55,`Snap-off moved to ${shape.left}; width ${shape.width}; angle ${shape.angle}`);
 const create=v.containerEl.querySelector('.qc-header-create');assert(create.parentElement.classList.contains('qc-header-tools'),'Creation tools not in editor toolbar');assert(create.querySelectorAll('button').length===6,'Creation categories missing');
 await v.flush();const before=v.canvas.getObjects().length;create.querySelector('.qc-insert-shape').click();let pop=document.querySelector('.qc-insert');assert(pop.dataset.category==='shape'&&pop.querySelector('.qc-shape-grid'),'Shape insertion missing');pop.querySelector('.qc-shape-btn').click();await wait(50);assert(v.canvas.getObjects().length===before+1&&!document.querySelector('.qc-insert'),'Shape insertion did not close');await v.flush();await v.travel(-1);assert(v.canvas.getObjects().length===before,'Shape insert undo failed');
 create.querySelector('.qc-insert-text').click();pop=document.querySelector('.qc-insert');assert(pop.dataset.category==='text'&&pop.querySelector('.qc-text-grid'),'Text panel missing');pop.querySelector('.qc-text-card').dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await wait(40);assert(document.querySelector('.qc-insert'),'Shift continuous insert closed');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!document.querySelector('.qc-insert'),'Escape did not close');
 create.querySelector('.qc-insert-asset').click();pop=document.querySelector('.qc-insert');for(let i=0;!pop.querySelector('.qc-asset')&&i<100;i++)await wait(20);assert(pop.querySelector('.qc-asset'),'Offline assets missing');
 // Switching directly to another category replaces the panel rather than only closing it.
 create.querySelector('.qc-insert-shape').click();pop=document.querySelector('.qc-insert');assert(pop?.dataset.category==='shape'&&pop.querySelector('.qc-shape-grid')&&!pop.querySelector('.qc-insert-tab'),'Shape panel must replace other inserts');document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));assert(!document.querySelector('.qc-insert'),'Outside click did not close');
 assert(v.contentEl.classList.contains('qc-toolbar-icons'),'Default toolbar must be icons only');assert(create.querySelector('.qc-ai-image-btn .qc-image-sparkles-icon svg'),'AI image icon missing');p.settings.toolbarLabels=true;v.refreshToolbar();assert(!v.contentEl.classList.contains('qc-toolbar-icons'),'Label setting failed');
 const geometry=[];for(const width of [1468,900,620,390]){
  v.contentEl.style.width=`${width}px`;await wait(60);v.setZoom('fit');await wait(20);const root=v.contentEl.getBoundingClientRect(),bar=v.containerEl.querySelector('.qc-zoombar').getBoundingClientRect(),center=v.centerEl.getBoundingClientRect(),canvas=v.canvas.wrapperEl.getBoundingClientRect();
  if(width>980&&v.drawerEl.getBoundingClientRect().width)assert(Math.abs(create.getBoundingClientRect().left-center.left)<2,`Tools not aligned to editor at ${width}`);
  assert(v.contentEl.scrollWidth<=v.contentEl.clientWidth+2,`Root overflow at ${width}`);assert(Math.abs(center.right-bar.right-10)<2&&Math.abs(center.bottom-bar.bottom-10)<2,'Zoom not bottom right');assert(bar.height<=32,'Zoom bar not compact');assert(canvas.bottom<=bar.top-1,`Fit artboard covered by zoom at ${width}`);
  for(const b of create.querySelectorAll('button')){const br=b.getBoundingClientRect();assert(br.left>=root.left&&br.right<=root.right+1,`Hidden insertion button at ${width}`);}
  create.querySelector('.qc-insert-shape').click();pop=document.querySelector('.qc-insert');const pr=pop.getBoundingClientRect();assert(pr.left>=0&&pr.right<=innerWidth&&pr.bottom<=innerHeight,'Panel outside viewport');pop.querySelector('.qc-insert-x').click();geometry.push({width,height:bar.height,clearance:Math.round(bar.top-canvas.bottom)});
 }
 results.layout=geometry;v.contentEl.style.width=oldWidth;p.settings.toolbarLabels=oldLabels;v.refreshToolbar();v.setZoom('fit');await wait(50);
 const remote=require('@electron/remote');require('fs').writeFileSync('/tmp/qcover-toolbar-right-zoom.png',(await remote.getCurrentWindow().webContents.capturePage()).toPNG());
 await v.flush();return {drag:results,independentPanels:true,insertUndo:true,continuousInsert:true,categorySwitch:true,zoomNoCover:true,file:file.path};
} finally {document.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:0,buttons:0}));p.settings.guides.snap=oldSnap;p.settings.toolbarLabels=oldLabels;v.refreshToolbar();v.contentEl.style.width=oldWidth;v.setZoom('fit');document.querySelector('.qc-insert')?.dispatchEvent(new Event('qc-close'));}
