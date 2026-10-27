// Run with the localhost wire fixture in tests/helpers/note-server.mjs, only in an isolated QA vault.
if (app.vault.getName() !== 'qiaomu-cover-note-qa') throw new Error('Use the isolated note QA vault');
const p = app.plugins.plugins['qiaomu-cover-design'];
require('fs').writeFileSync('/tmp/cover-note-wire.jsonl','');
const original = structuredClone(p.settings); const wait = ms => new Promise(r => setTimeout(r, ms));
const assert = (ok, why) => { if (!ok) throw new Error(why); };
const wires = () => require('fs').readFileSync('/tmp/cover-note-wire.jsonl','utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
const user = wire => wire.messages.at(-1).content;
const folder = 'QCover QA'; if (!app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
const files = []; const stamp = Date.now();
const create = async (name, raw, selection) => {
  const note = await app.vault.create(`${folder}/${name} ${stamp}.md`, raw); files.push(note.path);
  const file = await p.createDesign(name+' '+stamp, 'folio', note, name, 'xhs', undefined, selection); files.push(file.path);
  const view = app.workspace.getLeavesOfType('qiaomu-cover-design').map(l=>l.view).find(v=>v.file?.path===file.path);
  assert(view?.canvas, 'cover did not load'); return { note, file, view };
};
try {
  Object.assign(p.settings.ai, { enabled: true, preset: 'custom', protocol: 'openai', baseUrl: 'http://127.0.0.1:19131/v1', apiKey: 'synthetic-qa', model: 'note-fixture', imageOn: false });
  p.settings.assistant='ai'; p.settings.language='zh';
  const raw = '# Reader 4.0.1\n'+'阅读背景说明。'.repeat(1100)+'\n正文重点：离线朗读恢复。\n另一个重点：EPUB 导出。';
  const short = await create('正文封面', raw); const v = short.view;
  await v.ask('读取笔记内容设计封面');
  assert(user(wires().at(-1)).includes('离线朗读恢复'), 'tail fact absent on wire');
  assert(v.canvas.getObjects().find(o=>o.qcRole==='title').text.replace(/\s/g,'').includes('离线朗读'), 'body-derived copy not applied');
  await v.ask('突出 EPUB 导出'); assert(user(wires().at(-1)).includes('正文重点'), 'followup forgot note body');
  assert(v.contentEl.querySelector('.qc-note-context pre').textContent===raw, 'preview differs from sent source');
  await v.flush(); await v.leaf.detach(); await p.openDesign(short.file);
  const reopened = p.activeCover(); await reopened.ask('换一个标题'); assert(user(wires().at(-1)).includes('离线朗读恢复'), 'reopen forgot source');
  // A different active note must not contaminate source reads.
  const other = await app.vault.create(`${folder}/其他 ${stamp}.md`, '不应发送的其他笔记'); files.push(other.path);
  const md = app.workspace.getLeaf('tab'); await md.openFile(short.note); const editor = md.view.editor;
  editor.setValue(raw+'\n正文变更：暂停位置恢复');
  assert((await p.readNote(short.note)).includes('正文变更'), 'source editor changes not read');
  await app.workspace.getLeaf('tab').openFile(other); await reopened.ask('根据最新内容重新设计');
  assert(user(wires().at(-1)).includes('正文变更'), 'latest editor body missing'); assert(!user(wires().at(-1)).includes('不应发送的其他笔记'), 'active note leaked');
  const longRaw = '# 更新\n事实1:双语字幕同步\n'+'章节背景。'.repeat(12000)+'\n事实2:离线朗读恢复\n事实3:EPUB 导出';
  const long = await create('长文封面',longRaw); await long.view.ask('设计封面');
  assert(long.view.noteContext.kind==='summary', 'long note not summarized');
  assert(user(wires().at(-1)).includes('EPUB 导出'), 'long-note tail not on wire');
  const summaries = () => wires().filter(w=>w.messages[0].content.includes('整理封面设计素材'));
  const covered = summaries().map(w=>JSON.parse(user(w)).text).join(''); assert(covered===longRaw,'long note sections not fully read');
  const localCount=wires().length, title=long.view.canvas.getObjects().find(o=>o.qcRole==='title');
  long.view.canvas.setActiveObject(title); await long.view.ask('改成#224466');
  assert(title.fill==='#224466'&&wires().length===localCount,'local colour edit read/summarized the note');
  long.view.canvas.discardActiveObject(); const linked=long.view.design.source, enabled=p.settings.ai.enabled;
  p.settings.ai.enabled=false; long.view.design.source='Missing-local-note.md'; await long.view.ask('标题放大');
  assert(!long.view.chat.at(-1).failed&&wires().length===localCount,'offline edit was blocked by a missing note');
  p.settings.ai.enabled=enabled; long.view.design.source=linked;
  await long.view.flush(); const count=summaries().length; await long.view.leaf.detach(); await p.openDesign(long.file);
  await p.activeCover().ask('再突出离线朗读'); assert(summaries().length===count,'reopen repeated cached summary');
  const selected = await create('选区封面','全文包括 EPUB 导出与其他信息','只讲离线朗读');
  await selected.view.ask('设计封面'); assert(selected.view.noteContext.kind==='selection','selection scope lost');
  assert(!user(wires().at(-1)).includes('全文包括'), 'selection expanded silently'); await selected.view.flush();
  await selected.view.leaf.detach(); await p.openDesign(selected.file); const sv=p.activeCover();
  await sv.ask('换标题'); assert(sv.noteContext.text==='只讲离线朗读','selection snapshot lost on reopen');
  await sv.ask('读取笔记全文重新设计'); assert(sv.noteContext.text.includes('全文包括'),'explicit full-note request ignored'); assert(!sv.design.noteSelection,'full-note scope not persisted');
  const before = wires().length; sv.design.source='Missing-note-context.md'; await sv.ask('读取笔记内容设计封面');
  assert(wires().length===before&&sv.chat.at(-1).failed,'missing note silently fell back to title');
  const empty=await create('空笔记','---\ntitle: Empty\n---\n'); await empty.view.ask('设计封面'); assert(empty.view.chat.at(-1).failed,'empty note accepted');
  // Return to a useful visible example and exercise the English source UI.
  p.settings.language='en'; await p.openDesign(short.file); p.activeCover().refreshDrawer();
  assert(p.activeCover().contentEl.querySelector('.qc-note-context summary').textContent.includes('Note:'),'English source UI missing');
  p.settings.language='zh'; p.activeCover().refreshDrawer(); await p.activeCover().ask('突出 EPUB 导出');
  window.__noteContextExample = short.file.path;
  return { version:p.manifest.version, wireRequests:wires().length, firstAndFollowup:true, tailAfter6000:true, reopen:true, editorChanges:true, otherNoteExcluded:true, fullLongNoteCovered:true, cachedSummaryReopen:true, selectionReopen:true, explicitFullNote:true, missingAndEmptyBlocked:true, localEditsDoNotRead:true, previewMatches:true, zhEn:true, files };
} finally { p.settings=original; await p.saveSettings(); }
