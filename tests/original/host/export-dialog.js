/* Run through host_eval.py in the isolated QA vault. Checks the real modal and exported bytes. */
const p = app.plugins.plugins['qiaomu-cover-design'];
const remote = require('electron').remote || require('@electron/remote');
const win = remote.getCurrentWindow();
const fs = require('fs');
const beforeSize = win.getSize();
const beforeLanguage = p.settings.language;
const beforeExport = { ...p.settings.export };
const dark = document.body.classList.contains('theme-dark');
const files = [];
const close = () => [...document.querySelectorAll('.qc-export-modal')].at(-1)?.querySelector('.qc-modal-footer button')?.click();
const pause = ms => new Promise(r => setTimeout(r, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const measurements = [], exports = [];
try {
  while (document.querySelector('.qc-export')) { const container = document.querySelector('.qc-export').closest('.modal-container'); const button = container.querySelector('.qc-modal-footer button'); if (button) button.click(); else container.remove(); }
  p.settings.export = {}; p.settings.language = 'zh';
  const file = await p.createDesign('Export regression ' + Date.now(), 'editorial', undefined, '模板上新\n照着填就行', 'vertical');
  files.push(file);
  const view = app.workspace.getLeavesOfType('qiaomu-cover-design').find(l => l.view.file?.path === file.path).view;
  await pause(500);
  assert(view.canvas, 'fixture canvas not ready');
  assert(view.exportPrefs().format === 'jpeg', `new cover should default to JPG same=${p===view.plugin} prefs=${JSON.stringify(view.exportPrefs())} p-export=${JSON.stringify(p.settings.export)} d-export=${JSON.stringify(view.design.export)}`);
  view.design.export = { format: 'webp' };
  assert(view.exportPrefs().format === 'webp', 'saved cover format must be retained');
  delete view.design.export;
  await view.openExport(); await pause(800);
  for (const theme of ['theme-light', 'theme-dark']) {
    document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(theme);
    for (const [w, h] of [[1400, 900], [900, 640], [760, 700], [460, 740]]) {
      win.setSize(w, h); await pause(250);
      const e = document.querySelector('.qc-export'), form = e.querySelector('.qc-export-form'), shot = e.querySelector('.qc-export-shot'), img = shot.querySelector('img');
      const r = el => el.getBoundingClientRect();
      assert(img.complete && img.naturalWidth > 0, 'preview must load');
      assert(r(img).right <= r(shot).right + 1 && r(img).bottom <= r(shot).bottom + 1, 'preview escapes its box');
      assert(r(shot).right <= r(form).left + 1 || r(shot).bottom <= r(form).top + 1, 'preview overlaps form');
      assert(e.scrollWidth <= e.clientWidth + 1, `horizontal export overflow ${innerWidth}x${innerHeight} ${e.scrollWidth}/${e.clientWidth} offenders: ${[...e.querySelectorAll('*')].filter(n => n.scrollWidth > n.clientWidth + 1).map(n => `${n.className}:${n.scrollWidth}/${n.clientWidth}`).join(',')}`);
      const footer = document.querySelector('.qc-export-modal .qc-modal-footer');
      assert(r(footer).bottom <= innerHeight + 1, 'export actions below viewport');
      assert(form.scrollWidth <= form.clientWidth + 1, 'form controls overflow');
      measurements.push({ theme, viewport: `${innerWidth}x${innerHeight}`, imageWidth: Math.round(r(img).width), columns: getComputedStyle(e).gridTemplateColumns });
      if (w === 1400) fs.writeFileSync(`/tmp/qcover-export-${theme}.png`, (await win.webContents.capturePage()).toPNG());
    }
  }
  win.setSize(1400, 900); await pause(200);
  const formatButtons = [...document.querySelector('.qc-export-cols .qc-seg').querySelectorAll('button')];
  for (const label of ['PNG', 'JPG', 'WebP']) {
    const button = formatButtons.find(b => b.textContent === label);
    assert(button, `missing ${label} button: ${formatButtons.map(b => b.textContent)}`); button.click(); await pause(500);
    const range = document.querySelector('.qc-export-cols input[type=range]');
    assert(range.disabled === (label === 'PNG'), 'quality enabled state');
    assert(document.querySelector('.qc-export-resolved').textContent.endsWith(label === 'JPG' ? '.jpg' : '.' + label.toLowerCase()), 'filename extension drift');
  }
  close(); await pause(350);
  for (const format of ['jpeg', 'png', 'webp']) {
    const prefs = { ...view.exportPrefs(), format, scale: 1, fitLimit: false, destination: 'folder', folder: 'Cover designs/Exports', filename: `export-regression-${Date.now()}-${format}`, insert: false, cover: false, copy: false };
    const encoded = await view.encode(prefs);
    assert(encoded.blob.type === `image/${format}`, 'encoding MIME mismatch');
    const bitmap = await createImageBitmap(encoded.blob);
    assert(bitmap.width === view.design.width && bitmap.height === view.design.height, 'encoded dimensions mismatch'); bitmap.close();
    const output = await view.exportWith(prefs); files.push(output);
    const bytes = new Uint8Array(await app.vault.readBinary(output));
    assert(format === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 : format === 'png' ? bytes[0] === 137 && bytes[1] === 80 : String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP', 'written file signature mismatch');
    exports.push({ format, extension: output.extension, bytes: bytes.length, dimensions: `${encoded.width}x${encoded.height}` });
  }
  p.settings.language = 'en';
  await view.openExport(); await pause(600);
  assert(document.querySelector('.qc-export-form').textContent.includes('Destination'), `English modal not translated p=${p.lang()} view=${view.plugin.lang()} same=${p === view.plugin} modal=${document.querySelector('.qc-export-form').textContent}`);
  fs.writeFileSync('/tmp/qcover-export-en.png', (await win.webContents.capturePage()).toPNG());
  close();
  return { defaultFormat: 'jpeg', savedWebpRetained: true, measurements, exports, english: true };
} finally {
  close(); win.setSize(...beforeSize); document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(dark ? 'theme-dark' : 'theme-light');
  p.settings.language = beforeLanguage; p.settings.export = beforeExport; await p.saveSettings();
  for (const file of files.reverse()) { if (file?.path && app.vault.getAbstractFileByPath(file.path)) await app.vault.delete(file); }
}
