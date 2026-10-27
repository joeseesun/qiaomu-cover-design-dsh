// Uses the existing configured text provider only with this synthetic QA note.
if (app.vault.getName() !== 'qiaomu-cover-note-qa') throw new Error('Use the isolated note QA vault');
const p = app.plugins.plugins['qiaomu-cover-design'];
if (!p.ai.ready()) throw new Error('Configure a text model before live QA');
const original = structuredClone(p.settings);
try {
  p.settings.language = 'zh';
  const note = await app.vault.create(`QCover QA/Reader 4.0.1 初始创建 ${Date.now()}.md`, '# Reader 更新\n\n本次主要解决离线朗读中断后丢失进度的问题。新增暂停位置保存，重开阅读器后能从上次段落继续朗读。其次是 EPUB 导出，可以把正文与阅读笔记保存成电子书。\n\n核心收益：阅读可以中断，进度不会丢。');
  p.openNew(note, note.basename);
  document.querySelector('.qc-modal .qc-modal-footer .qc-primary').click();
  const end = Date.now() + 90000;
  while (!(p.activeCover()?.design?.source === note.path && !p.activeCover().restoring && !p.activeCover().busy)) {
    if (Date.now() > end) throw new Error('Real model initial creation timed out');
    await new Promise(r => setTimeout(r, 100));
  }
  const v = p.activeCover(), message = v.chat.at(-1);
  if (message.failed) throw new Error(message.text);
  const words = v.copyText();
  if (!/朗读|进度|续读|断点|暂停|EPUB/.test(words.title+' '+words.subtitle)) throw new Error('Canvas copy did not reflect body facts');
  if (message.variants?.length && !message.variants[0].selected) throw new Error('Real-model first proposal was not applied');
  await v.flush();
  const exported = await v.exportWith({...v.exportPrefs(),format:'png',scale:1,destination:'system',systemDir:'/tmp',filename:'cover-note-create-live',insert:false,cover:false,copy:false,fitLimit:false});
  return {version:p.manifest.version,model:p.settings.ai.model,protocol:p.settings.ai.protocol,title:words.title,subtitle:words.subtitle,template:v.design.template,choices:message.variants?.length??0,firstSelected:message.variants?.[0]?.selected??false,sourceCharacters:v.noteContext.characters,exported,warnings:message.warn??[],file:v.file.path};
} finally { p.settings = original; await p.saveSettings(); }
