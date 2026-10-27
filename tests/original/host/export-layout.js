/* Export dialog layout check: opens the real modal and reports whether an inner scroll region
   (and therefore a horizontal/vertical scrollbar) exists, at several window sizes. */
const p = app.plugins.plugins['qiaomu-cover-design'];
const REMOTE = require('electron').remote || require('@electron/remote');
const win = REMOTE.getCurrentWindow();
const before = win.getSize();

const file = await p.createDesign('导出布局检查 ' + Date.now(), 'editorial', undefined, 'TRAE\n升级了', 'vertical');
const view = app.workspace.getLeavesOfType('qiaomu-cover-design').find(l => l.view.file?.path === file.path).view;
view.design.export = { format: 'webp', scale: 1, quality: 0.92, destination: 'system', systemDir: '~/Downloads/qcover-qa', filename: '{name}-{platform}' };
await new Promise(r => setTimeout(r, 250));
await view.openExport();
await new Promise(r => setTimeout(r, 700));

const box = el => {
  if (!el) return null;
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    scrollW: el.scrollWidth, scrollH: el.scrollHeight,
    clientW: el.clientWidth, clientH: el.clientHeight,
    overX: el.scrollWidth > el.clientWidth + 1, overY: el.scrollHeight > el.clientHeight + 1,
    overflow: `${cs.overflowX}/${cs.overflowY}`, pos: cs.position,
  };
};

const measure = () => {
  const container = [...document.querySelectorAll('.modal-container')].pop();
  const modal = container?.querySelector('.modal');
  const content = container?.querySelector('.modal-content');
  const exp = container?.querySelector('.qc-export');
  const prev = container?.querySelector('.qc-export-preview');
  const form = container?.querySelector('.qc-export-form');
  const feed = container?.querySelector('.qc-feed');
  const footer = container?.querySelector('.qc-modal-footer');
  let barX = 0, barY = 0;
  if (exp) { barX = exp.offsetWidth - exp.clientWidth; barY = exp.offsetHeight - exp.clientHeight; }
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    container: box(container), modal: box(modal), content: box(content),
    exportGrid: box(exp), previewCol: box(prev), formCol: box(form), feed: box(feed), footer: box(footer),
    exportScrollbars: { x: barX, y: barY },
    contentScrollbars: content ? { x: content.offsetWidth - content.clientWidth, y: content.offsetHeight - content.clientHeight } : null,
    gridColumns: exp ? getComputedStyle(exp).gridTemplateColumns : null,
    sections: [...(form?.querySelectorAll('.qc-export-section') ?? [])].map(s => `${s.querySelector('.qc-export-label')?.textContent}:${Math.round(s.getBoundingClientRect().height)}`),
  };
};

const sizes = [[1400, 900], [1100, 760], [980, 700]];
const out = [];
for (const [w, h] of sizes) {
  win.setSize(w, h);
  await new Promise(r => setTimeout(r, 450));
  out.push(measure());
}
win.setSize(before[0], before[1]);
await new Promise(r => setTimeout(r, 300));

const container = [...document.querySelectorAll('.modal-container')].pop();
const close = container?.querySelector('.modal-close-button'); close?.click();
await new Promise(r => setTimeout(r, 200));
await app.vault.delete(file);

return { windowBefore: before, sizes: out };