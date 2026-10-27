/* Narrow-width + overflow-source probe for the export dialog. */
const p = app.plugins.plugins['qiaomu-cover-design'];
const REMOTE = require('electron').remote || require('@electron/remote');
const win = REMOTE.getCurrentWindow();
const before = win.getSize();

const file = await p.createDesign('导出布局检查 ' + Date.now(), 'editorial', undefined, 'TRAE\n升级了', 'vertical');
const view = app.workspace.getLeavesOfType('qiaomu-cover-design').find(l => l.view.file?.path === file.path).view;
view.design.export = { format: 'webp', scale: 1, quality: 0.92, destination: 'system', systemDir: '~/Downloads/qcover-qa' };
await new Promise(r => setTimeout(r, 250));
await view.openExport();
await new Promise(r => setTimeout(r, 700));

const probe = () => {
  const c = [...document.querySelectorAll('.modal-container')].pop();
  const exp = c.querySelector('.qc-export');
  const form = c.querySelector('.qc-export-form');
  const offenders = [];
  const walk = (el, path) => {
    for (const child of el.children) {
      const cp = `${path}>${child.className || child.tagName}`;
      if (child.scrollWidth > child.clientWidth + 1) offenders.push({ sel: cp, scrollW: child.scrollWidth, clientW: child.clientWidth, over: child.scrollWidth - child.clientWidth });
      walk(child, cp);
    }
  };
  walk(form, 'form');
  const modal = c.querySelector('.modal');
  const cs = getComputedStyle(modal);
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    contentWidth: Math.round(c.querySelector('.modal-content').getBoundingClientRect().width),
    gridColumns: getComputedStyle(exp).gridTemplateColumns,
    exportOverX: exp.scrollWidth - exp.clientWidth,
    modalMaxHeight: cs.maxHeight,
    modalHeight: Math.round(modal.getBoundingClientRect().height),
    windowInnerHeight: window.innerHeight,
    offenders: offenders.slice(0, 12),
    formScrollOver: form.scrollWidth - form.clientWidth,
  };
};

const out = {};
for (const [w, h] of [[760, 700], [900, 640]]) { win.setSize(w, h); await new Promise(r => setTimeout(r, 450)); out[`${w}x${h}`] = probe(); }
win.setSize(1512, 949); await new Promise(r => setTimeout(r, 300));

[...document.querySelectorAll('.modal-container')].pop()?.querySelector('.modal-close-button')?.click();
await new Promise(r => setTimeout(r, 200));
await app.vault.delete(file);
return { windowBefore: before, out };