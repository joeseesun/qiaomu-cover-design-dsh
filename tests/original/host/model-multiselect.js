const p=app.plugins.plugins['qiaomu-cover-design'],saved=structuredClone(p.settings),originalSave=p.saveSettings;
const wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(x,m)=>{if(!x)throw Error(m);};
let doc,server,releaseReply,theme;
const button=(root,text)=>[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const modal=()=>doc.querySelector('.qc-model-dialog');
const input=(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));};
const until=async(fn,msg)=>{for(let i=0;i<200;i++){if(fn())return;await wait(20);}throw Error(msg);};
const rows=()=>[...modal().querySelectorAll('.qc-md-model-option')];
const row=id=>rows().find(r=>r.textContent.includes(id));
const search=q=>input(modal().querySelector('input[type=search]'),q);
const all=()=>modal().querySelector('.qc-md-select-all input');
const selected=()=>modal().querySelector('.qc-md-selection-summary').textContent;
const shot=async name=>{await wait(80);const win=require('@electron/remote').BrowserWindow.getAllWindows().find(w=>w.getTitle()===doc.title);require('fs').writeFileSync(`/tmp/qc-multi-${name}.png`,(await win.webContents.capturePage()).toPNG());};
const models=[{id:'already-image',name:'Existing model'},...Array.from({length:160},(_,i)=>({id:`image-fixture-${String(i).padStart(3,'0')}`,name:`Model ${i}`}))];
try {
 server=require('http').createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:models}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/v1`;
 p.settings.language='zh';p.openSettings('assistant');await wait(50);doc=p.settingsTab.containerEl.ownerDocument;theme=doc.body.className;
 const original=structuredClone(saved.ai);
 p.settings.ai={...original,enabled:true,preset:'custom',protocol:'openai',baseUrl:base,apiKey:'fixture',model:'already-image',chatAlias:'Preserved alias',chatId:'qa-existing',chats:[{id:'qa-existing',snap:{preset:'custom',protocol:'openai',baseUrl:base,apiKey:'fixture',model:'already-image',codexBin:'',codexModel:'',chatAlias:'Preserved alias'}}],imageEngine:'api',imageBaseUrl:base,imageKey:'fixture',imageModel:'already-image',imageOn:true,imageId:'qa-existing-image',imageAlias:'Image alias',imageSize:'1536x1024',images:[{id:'qa-existing-image',snap:{imageEngine:'api',imageBaseUrl:base,imageKey:'fixture',imageModel:'already-image',imageOn:true,imageAlias:'Image alias',imageSize:'1536x1024'}}]};
 const open=async kind=>{p.openSettings('assistant');await wait(20);[...p.settingsTab.containerEl.querySelectorAll('button')].filter(b=>b.textContent==='添加模型')[kind==='chat'?0:1].click();await wait(20);[...modal().querySelectorAll('.qc-md-card')].find(b=>b.textContent.includes('自定义')).click();await wait(20);input(modal().querySelector('input[type=password]'),'fixture');input(modal().querySelector('details input'),base);button(modal(),'下一步：选择模型').click();await until(()=>row('image-fixture-001'),'model list not loaded');};
 await open('chat');assert(all(),'bulk selection missing (expected failure in 0.2.5)');
 assert(row('already-image').textContent.includes('已添加')&&row('already-image').querySelector('input').disabled,'Existing model not marked');
 assert(button(modal(),'添加 0 个模型').disabled,'Empty save should be disabled');
 assert(rows().length===150,'Initial visible page wrong');modal().querySelector('.qc-md-more').click();assert(rows().length===161,'More models cannot be reached');
 all().click();assert(selected().includes('已选 0 个')&&modal().textContent.includes('还可添加 99 个'),'Overflow must reject entire bulk selection');
 search('image-fixture-00');all().click();assert(selected().includes('已选 10 个')&&all().checked,'Select filtered results failed');
 const first=row('image-fixture-000').querySelector('input');first.focus();first.click();assert(first.isConnected&&doc.activeElement===first&&all().indeterminate,'Selection lost focus or mixed state');
 search('image-fixture-01');assert(selected().includes('其中 9 个不在当前结果中'),'Hidden selections not explained');all().click();assert(selected().includes('已选 19 个'),'Cross-search selection lost');
 button(modal(),'刷新列表').click();await until(()=>!button(modal(),'刷新列表').disabled,'Refresh not finished');assert(selected().includes('已选 19 个'),'Refresh lost selections');
 button(modal(),'清空选择').click();assert(selected().includes('已选 0 个')&&!all().checked&&!all().indeterminate,'Clear failed');
 search('image-fixture-159');row('image-fixture-159').querySelector('input').click();search('image-fixture-000');row('image-fixture-000').querySelector('input').click();
 button(modal(),'返回').click();await wait(20);button(modal(),'下一步：选择模型').click();await wait(20);assert(selected().includes('已选 2 个'),'Back lost selections');
 search('already-image');assert(all().disabled,'Already-added only result must disable select all');
 const manual=modal().querySelector('details');manual.open=true;input(manual.querySelector('input'),'already-image');button(manual,'加入选择').click();assert(modal().textContent.includes('此模型已添加')&&selected().includes('已选 2 个'),'Manual duplicate not rejected');
 search('image-fixture-0');await shot('zh');
 p.saveSettings=async()=>{throw Error('image-fixture-save-failure');};button(modal(),'添加 2 个模型').click();await wait(30);assert(modal().textContent.includes('保存失败')&&p.settings.ai.chats.length===1&&selected().includes('已选 2 个')&&modal().querySelector('[role=alert]').parentElement===modal(),'Save failure lost draft or mutated profiles');
 p.saveSettings=async()=>{await new Promise(r=>{releaseReply=r;});await originalSave.call(p);};button(modal(),'添加 2 个模型').click();await wait(10);assert(all().disabled&&button(modal(),'清空选择').disabled,'Saving controls still active');releaseReply();await until(()=>!modal(),'Save did not close');p.saveSettings=originalSave;
 assert(p.settings.ai.chatId==='qa-existing'&&p.settings.ai.model==='already-image'&&p.settings.ai.chatAlias==='Preserved alias','Adding changed chat default');assert((await p.loadData()).ai.chats.length===3,'Batch not persisted');
 await open('image');search('image-fixture-00');all().click();button(modal(),'添加 10 个模型').click();await until(()=>!modal(),'Image save failed');assert(p.settings.ai.imageId==='qa-existing-image'&&p.settings.ai.imageModel==='already-image'&&p.settings.ai.imageSize==='1536x1024'&&p.settings.ai.imageAlias==='Image alias','Adding changed image default');
 // Editing remains single-selection and preserves defaults.
 p.openSettings('assistant');await wait(20);const imageRows=[...p.settingsTab.containerEl.querySelectorAll('.qcs-model-row')];button(imageRows.find(r=>r.textContent.includes('image-fixture-001')&&r.closest('.qcs-model-list')?.parentElement?.textContent.includes('生图'))||imageRows.find(r=>r.textContent.includes('image-fixture-001')),'编辑').click();await wait(20);button(modal(),'下一步：选择模型').click();await until(()=>row('image-fixture-001'),'Edit list missing');assert(!all()&&rows().every(r=>r.querySelector('input').type==='radio'),'Edit is no longer single-select');button(modal(),'取消').click();
 p.settings.language='en';p.openSettings('assistant');await wait(20);button(p.settingsTab.containerEl,'Add models').click();await wait(20);[...modal().querySelectorAll('.qc-md-card')].find(b=>b.textContent.includes('OpenRouter')).click();await wait(20);input(modal().querySelector('input[type=password]'),'fixture');input(modal().querySelector('details input'),base);button(modal(),'Next: choose models').click();await until(()=>all(),'English selector missing');assert(modal().textContent.includes('Select all results')&&modal().textContent.includes('0 selected'),'English strings missing');
 modal().style.width='360px';modal().style.maxWidth='360px';await wait(20);assert(modal().scrollWidth<=modal().clientWidth+2,'Narrow modal overflow');await shot('narrow');doc.body.classList.remove('theme-light');doc.body.classList.add('theme-dark');await shot('dark');button(modal(),'Cancel').click();
 return {bulk:true,existing:true,manualDuplicate:true,showMore:true,limit:true,searchPersistence:true,hiddenCount:true,mixedState:true,focus:true,refresh:true,back:true,clear:true,saveRollback:true,pendingControls:true,chatDefault:true,imageDefault:true,editSingle:true,english:true,narrow:true,dark:true};
} finally {
 if(releaseReply)releaseReply();p.saveSettings=originalSave;
 if(doc){doc.querySelector('.qc-model-dialog')?.closest('.modal')?.querySelector('.modal-close-button')?.click();if(theme)doc.body.className=theme;}
 p.settings=saved;await p.saveSettings();app.setting.close();if(server)await new Promise(r=>server.close(r));
}
