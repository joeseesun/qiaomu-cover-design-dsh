// Run with COVER_NOTE_CHOICES=1 node tests/helpers/note-server.mjs.
if (app.vault.getName() !== 'qiaomu-cover-note-qa') throw new Error('Use the isolated note QA vault');
const p = app.plugins.plugins['qiaomu-cover-design'];
require('fs').writeFileSync('/tmp/cover-note-wire.jsonl','');
const original = structuredClone(p.settings), stamp = Date.now();
const assert = (ok, why) => { if (!ok) throw new Error(why); };
const until = async (fn, why) => {
  const end = Date.now() + 25000;
  while (!fn()) { if (Date.now() > end) throw new Error(why); await new Promise(r => setTimeout(r, 50)); }
};
const wires = () => require('fs').readFileSync('/tmp/cover-note-wire.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const latestModal = () => Array.from(document.querySelectorAll('.qc-modal')).at(-1);
const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4).reduce((s,x,i) => s+x*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
let modal;
const menuFor = note => {
  const items = [];
  const menu = { setSectionSubmenu() { return this; }, addSeparator() { return this; }, addItem(fn) {
    const item = { setTitle(text) { this.title = text; return this; }, setIcon() { return this; }, setSection() { return this; }, setDisabled() { return this; }, onClick(fn) { this.run = fn; return this; } };
    fn(item); items.push(item); return this;
  } };
  app.workspace.trigger('file-menu', menu, note);
  return items.find(x => x.title === p.t('fromNote'));
};
try {
  Object.assign(p.settings.ai, {enabled:true,preset:'custom',protocol:'openai',baseUrl:'http://127.0.0.1:19131/v1',apiKey:'synthetic-qa',model:'note-fixture',imageOn:false});
  p.settings.assistant = 'ai'; p.settings.language = 'zh';
  const raw = '# Reader 更新\n更新重点：离线朗读恢复，保存暂停位置，重开后继续阅读。支持导出 EPUB。';
  const note = await app.vault.create(`QCover QA/右键创建 ${stamp}.md`, raw);
  const item = menuFor(note); assert(item?.run, 'note context menu missing'); item.run();
  modal = latestModal(); assert(modal, 'note creation modal missing');
  const create = modal.querySelector('.qc-modal-footer .qc-primary'); assert(create?.textContent === p.t('createAction'), 'default Create missing');
  create.click();
  await until(() => p.activeCover()?.design?.source === note.path && !p.activeCover().restoring && !p.activeCover().busy, 'note creation did not finish');
  const v = p.activeCover();
  assert(v.chat.some(x => x.role === 'user'), 'Default Create bypassed AI');
  assert(wires().at(-1).messages.at(-1).content.includes(JSON.stringify(raw).slice(1,-1)), 'Default Create omitted the note body');
  assert(v.copyText().title.replace(/\s/g,'') === '离线朗读恢复', 'First body-based proposal not applied to canvas');
  const first = v.chat.at(-1); assert(first.variants?.filter(x => x.selected).length === 1 && first.variants[0].selected, 'Applied proposal not selected');
  await v.flush(); const saved = JSON.parse(await app.vault.read(v.file));
  assert(saved.canvas.objects.some(x => x.qcRole === 'title' && x.text.replace(/\s/g,'') === '离线朗读恢复'), 'Applied layout not saved');
  const initial = v.snapshot(); await v.ask('给这篇笔记三个新封面方向');
  assert(v.snapshot() === initial, 'Explicit proposals changed an existing canvas');
  const proposals = v.chat.at(-1); assert(proposals.variants?.length && !proposals.variants.some(x => x.selected), 'Explicit proposal selection changed');
  await v.chooseVariant(proposals, proposals.variants[1]); assert(v.copyText().title.replace(/\s/g,'') === '暂停不丢进度', 'Switching proposals failed');
  const badge = v.canvas.getObjects().find(x => x.qcRole === 'badge' && x.badgeBg);
  assert(badge && contrast(badge.fill,badge.badgeBg) >= 3, 'Readability pass made badge text unreadable against its own background');
  await v.flush(); const file = v.file; await v.leaf.detach(); const count = wires().length; await p.openDesign(file);
  assert(wires().length === count && p.activeCover().copyText().title.replace(/\s/g,'') === '暂停不丢进度', 'Reopen reran AI or lost chosen design');
  // Enter uses the same primary action, including the English UI.
  p.settings.language = 'en'; const second = await app.vault.create(`QCover QA/Enter note ${stamp}.md`, raw);
  menuFor(second).run(); modal = latestModal();
  const input = modal.querySelector('textarea'); input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',ctrlKey:true,bubbles:true,cancelable:true}));
  await until(() => p.activeCover()?.design?.source === second.path && !p.activeCover().restoring && !p.activeCover().busy, 'Enter did not create with AI');
  assert(p.activeCover().copyText().title.replace(/\s/g,'') === '离线朗读恢复', 'Enter omitted body layout');
  // A note default must never silently fall back to a file-name-only layout.
  p.settings.ai.enabled = false; const disabled = await app.vault.create(`QCover QA/No model ${stamp}.md`, raw);
  const before = p.designs().length, requests = wires().length; const openSettings = p.openSettings;
  let settingCalls = 0; p.openSettings = () => { settingCalls++; };
  try {
    menuFor(disabled).run(); modal = latestModal(); modal.querySelector('.qc-modal-footer .qc-primary').click();
    assert(settingCalls === 1 && p.designs().length === before && wires().length === requests, 'No-model Create silently made a generic layout');
    const manual = Array.from(modal.querySelectorAll('.qc-modal-footer button')).find(x => x.textContent === p.t('createManually')); assert(manual, 'Explicit manual creation missing');
    manual.click(); await until(() => p.activeCover()?.design?.source === disabled.path && !p.activeCover().restoring, 'Manual creation failed');
    assert(wires().length === requests && p.activeCover().chat.length === 0, 'Explicit manual creation called AI');
  } finally { p.openSettings = openSettings; }
  return {version:p.manifest.version,rightClickDefault:true,bodyOnWire:true,autoApplied:true,saved:true,explicitProposalsPreserved:true,switchAndReopen:true,englishEnter:true,noModelNoFallback:true,manualOffline:true,requests:wires().length};
} finally {
  modal?.closest('.modal-container')?.querySelector('.modal-close-button')?.click();
  p.settings = original; await p.saveSettings();
}
