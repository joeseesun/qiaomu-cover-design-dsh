import { App, FuzzySuggestModal, Modal, Notice, Platform, setIcon, TFile, TFolder } from '../harness-ui';
import type CoverPlugin from '../native-controller';
import type { CoverView } from './view';
import { Destination, ExportFormat, ExportPrefs, renderFilename, safeName, validSize } from './model';
import { GROUPS, PLATFORMS, platformById, platformFor } from './platforms';
import { templatesFor } from './templates';
import { bytes, numberBox, onEnter, segmented, slider, textButton } from './ui';
import { templateThumb } from './panels';
import { FONT_LIBRARY, FONT_MOODS, FONT_PACKS, FontMood } from './fontlib';
import { installPack, packMissing } from './fontpack';

export class PickFile extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private pick: (file: TFile) => void, label: string) { super(app); this.setPlaceholder(label); }
  getItems(): TFile[] { return this.files; }
  getItemText(file: TFile): string { return file.path; }
  onChooseItem(file: TFile): void { this.pick(file); }
}
export class PickFolder extends FuzzySuggestModal<TFolder> {
  constructor(app: App, private pick: (path: string) => void, label: string, private includeRoot = true) { super(app); this.setPlaceholder(label); }
  getItems(): TFolder[] { return this.app.vault.getAllFolders(this.includeRoot); }
  getItemText(f: TFolder): string { return f.isRoot() ? '/' : f.path; }
  onChooseItem(f: TFolder): void { this.pick(f.isRoot() ? '' : f.path); }
}

/* ---------- new cover ---------- */
export class NewCoverModal extends Modal {
  constructor(private plugin: CoverPlugin, private note?: TFile, private titleText = '', private noteSelection?: string) { super(plugin.app); }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); const zh = this.plugin.isZh();
    this.titleEl.setText(t('create')); this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal');
    let name = this.titleText || t('untitled'); let template = 'minimal'; let platform = this.plugin.settings.defaultPlatform; let brief = '';
    const form = this.contentEl.createDiv('qc-new');
    const nameRow = form.createDiv('qc-new-field'); nameRow.createEl('label', { text: this.note ? t('coverTitle') : t('name') });
    const input = nameRow.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '2', spellcheck: 'false' } }); input.value = name;
    input.addEventListener('input', () => { name = input.value; });
    if (this.note) nameRow.createDiv({ text: t('fromNoteHint', { note: this.note.basename }), cls: 'qc-hint' });

    const briefRow = form.createDiv('qc-new-field qc-new-brief'); briefRow.createEl('label', { text: t(this.note ? 'noteDesignBrief' : 'newBrief') });
    const briefInput = briefRow.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '3', spellcheck: 'false', placeholder: t('newBriefPlaceholder') } });
    briefInput.addEventListener('input', () => { brief = briefInput.value; }); briefRow.createDiv({ text: t(this.note ? 'newBriefNoteHint' : 'newBriefHint'), cls: 'qc-hint' });

    form.createEl('label', { text: t('platform') });
    const plats = form.createDiv('qc-plat-grid qc-plat-grid-wide');
    form.createEl('label', { text: t('template') });
    const grid = form.createDiv('qc-template-grid qc-template-grid-modal');
    const draw = (): void => {
      grid.empty(); const p = platformById(platform) ?? PLATFORMS[0]!;
      const subtitle = t('subtext'); const title = (name.split('\n')[0] || t('untitled')).slice(0, 40);
      for (const tpl of templatesFor(platform)) {
        const card = grid.createEl('button', { cls: 'qc-template', attr: { type: 'button' } }); card.classList.toggle('is-active', template === tpl.id);
        const thumb = card.createDiv('qc-template-thumb'); thumb.style.aspectRatio = `${p.width} / ${p.height}`;
        card.createSpan({ text: zh ? tpl.zh : tpl.en, cls: 'qc-template-name' });
        card.addEventListener('click', () => { template = tpl.id; for (const c of Array.from(grid.children)) c.classList.toggle('is-active', c === card); });
        void templateThumb(this.contentEl.ownerDocument, zh, p.width, p.height, tpl, title, subtitle).then(url => { if (card.isConnected) thumb.createEl('img', { attr: { src: url, alt: '' } }); }).catch(() => undefined);
      }
    };
    const drawPlatforms = (): void => {
      plats.empty();
      for (const grp of GROUPS) for (const p of PLATFORMS.filter(x => x.group === grp.id)) {
        const b = plats.createEl('button', { cls: 'qc-plat', attr: { type: 'button' } }); setIcon(b.createSpan({ cls: 'qc-plat-icon' }), p.icon);
        const text = b.createDiv('qc-plat-text'); text.createSpan({ text: zh ? p.zh : p.en, cls: 'qc-plat-name' }); text.createSpan({ text: `${p.width} × ${p.height}`, cls: 'qc-plat-size' });
        b.classList.toggle('is-active', platform === p.id);
        b.addEventListener('click', () => { platform = p.id; drawPlatforms(); draw(); });
      }
    };
    drawPlatforms(); draw();
    const footer = this.contentEl.createDiv('qc-modal-footer');
    textButton(footer, t('cancel'), () => this.close());
    const make = (withBrief: boolean): void => {
      if (withBrief && !this.plugin.ai.ready()) { new Notice(t('aiNotReady')); this.plugin.openSettings('assistant'); return; }
      create.disabled = true; aiCreate.disabled = true;
      const title = (name.split('\n')[0] || (withBrief ? brief.split('\n')[0]?.slice(0, 24) : '') || t('untitled')).slice(0, 60);
      void this.plugin.createDesign(title, template, this.note, name.trim() || undefined, platform, withBrief ? brief.trim() || t('noteDesignRequest') : undefined, this.noteSelection).then(() => this.close()).catch(e => { this.plugin.report(e); create.disabled = false; aiCreate.disabled = false; });
    };
    const aiCreate = textButton(footer, t(this.note ? 'createManually' : 'createWithAi'), () => {
      if (this.note) { make(false); return; }
      if (!brief.trim()) { briefInput.focus(); return; } make(true);
    }, '', this.note ? undefined : 'sparkles');
    const create = textButton(footer, t('createAction'), () => make(!!this.note), 'qc-primary');
    onEnter(input, e => { e.preventDefault(); create.click(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 30);
  }
  onClose(): void { this.contentEl.empty(); }
}

/* ---------- custom size ---------- */
export class SizeModal extends Modal {
  constructor(private view: CoverView) { super(view.app); }
  onOpen(): void {
    const t = this.view.t.bind(this.view); const d = this.view.design!; let w = d.width, h = d.height; let fit = true;
    this.titleEl.setText(t('customSize')); this.contentEl.addClass('qc-modal');
    const row = this.contentEl.createDiv('qc-row qc-row-tight');
    numberBox(row, t('width'), w, v => { w = Math.round(v); }, { min: 200, max: 4096, unit: 'px' }); numberBox(row, t('height'), h, v => { h = Math.round(v); }, { min: 200, max: 4096, unit: 'px' });
    const label = this.contentEl.createEl('label', { cls: 'qc-check' }); const cb = label.createEl('input', { type: 'checkbox' }); cb.checked = true; cb.addEventListener('change', () => { fit = cb.checked; }); label.createSpan({ text: t('fitContent') });
    this.contentEl.createDiv({ text: t('sizeRange'), cls: 'qc-hint' });
    const footer = this.contentEl.createDiv('qc-modal-footer');
    textButton(footer, t('cancel'), () => this.close());
    textButton(footer, t('resize'), () => { if (!validSize(w, h)) { new Notice(t('sizeRange')); return; } this.view.resizeTo(w, h, fit); this.close(); }, 'qc-primary');
  }
  onClose(): void { this.contentEl.empty(); }
}

/* ---------- export ---------- */
export class ExportModal extends Modal {
  private prefs: ExportPrefs; private timer?: number; private run = 0; private busy = false;
  private shot!: HTMLImageElement; private mini!: HTMLImageElement;
  private numDims!: HTMLElement; private numFmt!: HTMLElement; private numWeight!: HTMLElement;
  private verdict!: HTMLElement; private summary!: HTMLElement; private systemInput?: HTMLInputElement;
  constructor(private view: CoverView) { super(view.app); this.prefs = view.exportPrefs(); }
  onOpen(): void {
    const view = this.view; const t = view.t.bind(view); const d = view.design!; const note = d.source ? view.app.vault.getAbstractFileByPath(d.source) : null; const hasNote = note instanceof TFile;
    const platform = platformFor(d.width, d.height, d.platform);
    this.titleEl.setText(t('export')); this.modalEl.addClass('qc-modal-wide', 'qc-export-modal'); this.contentEl.addClass('qc-modal');
    if (!hasNote && this.prefs.destination === 'note') this.prefs.destination = 'folder';
    const wrap = this.contentEl.createDiv('qc-export');
    const update = (): void => this.schedule();

    /* Stage 1 — the result. Numbers first, because "what am I getting" is the decision this dialog exists for. */
    const result = wrap.createDiv('qc-export-result');
    const shotBox = result.createDiv('qc-export-shot');
    this.shot = shotBox.createEl('img', { attr: { alt: '' } });
    const side = result.createDiv('qc-export-side');
    const nums = side.createDiv('qc-export-nums');
    const figure = (label: string): HTMLElement => {
      const box = nums.createDiv('qc-export-num'); const value = box.createSpan({ cls: 'qc-export-num-v' });
      box.createSpan({ text: label, cls: 'qc-export-num-k' }); return value;
    };
    this.numDims = figure(t('dimsLabel')); this.numFmt = figure(t('formatQuality')); this.numWeight = figure(t('estSize'));
    const under = side.createDiv('qc-export-under');
    this.mini = under.createEl('img', { cls: 'qc-feed-img', attr: { alt: '' } });
    this.verdict = under.createDiv('qc-feed-notes');
    const issues = view.thumbIssues();
    if (issues.length) for (const x of issues) this.verdict.createDiv({ text: x, cls: 'qc-feed-warn' });
    else this.verdict.createDiv({ text: t('thumbOk'), cls: 'qc-feed-ok' });
    if (platform?.maxBytes) {
      const lim = side.createEl('label', { cls: 'qc-check qc-export-limit' });
      const cb = lim.createEl('input', { type: 'checkbox' }); cb.checked = this.prefs.fitLimit;
      cb.addEventListener('change', () => { this.prefs.fitLimit = cb.checked; update(); });
      lim.createSpan({ text: t('fitLimit', { size: bytes(platform.maxBytes) }) });
    }
    this.shot.addEventListener('load', () => { this.mini.src = this.shot.src; });

    /* Stage 2 — where it goes and what happens next. */
    const form = wrap.createDiv('qc-export-form');
    form.createDiv({ text: t('saveGroup'), cls: 'qc-divide' });
    const cols = form.createDiv('qc-export-cols');

    const fFormat = cols.createDiv('qc-export-field');
    fFormat.createSpan({ text: t('format'), cls: 'qc-label' });
    segmented<ExportFormat>(fFormat, [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }, { value: 'webp', label: 'WebP' }], this.prefs.format, v => { this.prefs.format = v; syncQuality(); update(); });

    const fScale = cols.createDiv('qc-export-field');
    fScale.createSpan({ text: t('exportSize'), cls: 'qc-label' });
    const showDims = (): void => { this.numDims.setText(`${d.width * this.prefs.scale} × ${d.height * this.prefs.scale}`); };
    segmented<string>(fScale, [{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '3', label: '3×' }], String(this.prefs.scale), v => { this.prefs.scale = Number(v); showDims(); update(); });

    // Quality keeps its slot for PNG: disabling it with a reason beats collapsing the field and moving everything below it.
    const fQuality = cols.createDiv('qc-export-field');
    slider(fQuality, t('quality'), Math.round(this.prefs.quality * 100), 40, 100, 1, v => { this.prefs.quality = v / 100; update(); }, v => `${v}%`);
    const syncQuality = (): void => {
      const on = this.prefs.format !== 'png'; const input = fQuality.querySelector('input'); const value = fQuality.querySelector('.qc-value');
      if (input) input.disabled = !on; fQuality.classList.toggle('is-off', !on);
      value?.setText(on ? `${Math.round(this.prefs.quality * 100)}%` : t('lossless'));
    };

    const fName = cols.createDiv('qc-export-field');
    fName.createSpan({ text: t('filename'), cls: 'qc-label' });
    const nameInput = fName.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false' } }); nameInput.value = this.prefs.filename;
    const resolved = fName.createDiv({ cls: 'qc-hint qc-mono qc-export-resolved' });
    const showName = (): void => { const ext = this.prefs.format === 'jpeg' ? 'jpg' : this.prefs.format; resolved.setText(`${renderFilename(this.prefs.filename, { name: view.file?.basename ?? 'Cover', platform: platform?.id ?? 'custom', size: `${d.width}x${d.height}`, date: '20260101', time: '120000' })}.${ext}`); };
    nameInput.addEventListener('input', () => { this.prefs.filename = nameInput.value; showName(); });
    fName.createDiv({ text: t('filenameHint'), cls: 'qc-hint' });
    form.addEventListener('click', showName);

    const row2 = form.createDiv('qc-export-row2');
    const where = row2.createDiv('qc-export-field qc-export-where');
    where.createSpan({ text: t('destination'), cls: 'qc-label' });
    // Every destination is always listed; the one that cannot work is disabled in place instead of disappearing.
    segmented<Destination>(where, [
      { value: 'folder', label: t('destFolder') },
      { value: 'note', label: t('destNote'), disabled: !hasNote },
      { value: 'system', label: t('destSystem') },
    ], this.prefs.destination, v => { this.prefs.destination = v; pathErr.addClass('qc-hidden'); drawDest(); update(); });
    const detail = where.createDiv('qc-dest-detail');
    const pathErr = where.createDiv({ cls: 'qc-export-error qc-hidden' });
    const drawDest = (): void => {
      detail.empty();
      if (this.prefs.destination === 'folder') {
        const row = detail.createDiv('qc-row qc-row-tight'); const input = row.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false' } }); input.value = this.prefs.folder || view.plugin.settings.exportFolder;
        input.addEventListener('input', () => { this.prefs.folder = input.value.trim(); update(); });
        textButton(row, t('choose'), () => new PickFolder(view.app, p => { this.prefs.folder = p; input.value = p; update(); }, t('folderPick')).open(), 'qc-btn-sm', 'folder-open');
        detail.createDiv({ text: t('destFolderHint'), cls: 'qc-hint' });
      } else if (this.prefs.destination === 'note') {
        detail.createDiv({ text: t('destNoteHint', { folder: (note as TFile).parent?.path || '/' }), cls: 'qc-hint' });
      } else {
        const row = detail.createDiv('qc-row qc-row-tight'); const input = row.createEl('input', { type: 'text', cls: 'qc-input', attr: { spellcheck: 'false', placeholder: '~/Downloads' } }); input.value = this.prefs.systemDir;
        this.systemInput = input;
        input.addEventListener('input', () => { this.prefs.systemDir = input.value.trim(); input.removeClass('qc-invalid'); pathErr.addClass('qc-hidden'); update(); });
        textButton(row, t('choose'), () => void view.plugin.chooseSystemFolder(view.doc).then(p => { if (p) { this.prefs.systemDir = p; input.value = p; input.removeClass('qc-invalid'); pathErr.addClass('qc-hidden'); update(); } }), 'qc-btn-sm', 'folder-open');
        detail.createDiv({ text: t('destSystemHint'), cls: 'qc-hint' });
      }
    };
    drawDest();

    const after = row2.createDiv('qc-export-field qc-export-after');
    after.createSpan({ text: t('afterExport'), cls: 'qc-label' });
    const checks = after.createDiv('qc-export-checks');
    const check = (label: string, key: 'insert' | 'cover' | 'copy', disabled = false): void => {
      const l = checks.createEl('label', { cls: 'qc-check' }); const cb = l.createEl('input', { type: 'checkbox' }); cb.checked = this.prefs[key] && !disabled; cb.disabled = disabled;
      cb.addEventListener('change', () => { this.prefs[key] = cb.checked; }); l.createSpan({ text: label });
    };
    check(t('afterInsert'), 'insert', !hasNote); check(t('afterCover'), 'cover', !hasNote); check(t('afterCopy'), 'copy');
    if (!hasNote) after.createDiv({ text: t('noSourceHint'), cls: 'qc-hint' });

    const footer = this.contentEl.createDiv('qc-modal-footer');
    this.summary = footer.createDiv({ cls: 'qc-export-summary' });
    textButton(footer, t('cancel'), () => this.close());
    const go = textButton(footer, t('export'), () => {
      if (this.busy) return;
      if (this.prefs.destination === 'system' && !this.prefs.systemDir.trim()) { this.failPath(t('destSystemMissing'), pathErr); return; }
      this.busy = true; go.disabled = true;
      void view.exportWith({ ...this.prefs, insert: this.prefs.insert && hasNote, cover: this.prefs.cover && hasNote }).then(() => this.close()).catch(e => {
        const message = e instanceof Error ? e.message : String(e);
        if (this.prefs.destination === 'system' && (message === t('destSystemMissing') || message === t('destSystemDesktop'))) this.failPath(message, pathErr);
        else view.plugin.report(e);
        this.busy = false; go.disabled = false;
      });
    }, 'qc-primary', 'download');
    this.scope.register(['Mod'], 'Enter', () => { go.click(); return false; });
    syncQuality(); showDims(); showName(); update();
  }
  /** Report a bad path on the field itself, where the fix is, instead of only in a notice. */
  private failPath(message: string, box: HTMLElement): void {
    box.setText(message); box.removeClass('qc-hidden');
    this.systemInput?.addClass('qc-invalid'); this.systemInput?.focus();
  }
  private destLabel(): string {
    const view = this.view; const d = view.design;
    if (this.prefs.destination === 'system') return this.prefs.systemDir || '—';
    if (this.prefs.destination === 'note') { const note = d?.source ? view.app.vault.getAbstractFileByPath(d.source) : null; return note instanceof TFile ? (note.parent?.path || '/') : '/'; }
    return this.prefs.folder || view.plugin.settings.exportFolder || '/';
  }
  private schedule(): void {
    const w = this.view.win; if (this.timer !== undefined) w.clearTimeout(this.timer);
    const token = ++this.run;
    this.timer = w.setTimeout(() => void this.refresh(token), 280);
  }
  private async refresh(token: number): Promise<void> { const view = this.view; const t = view.t.bind(view);
    try {
      const platform = view.platform(); const out = await view.encode({ ...this.prefs }, platform?.maxBytes);
      if (token !== this.run || !this.contentEl.isConnected) return;
      const url = URL.createObjectURL(out.blob); const old = this.shot.src;
      this.shot.onload = () => { if (old.startsWith('blob:')) URL.revokeObjectURL(old); };
      this.shot.src = url;
      const over = Boolean(platform?.maxBytes && out.blob.size > platform.maxBytes);
      const size = bytes(out.blob.size);
      this.numDims.setText(`${out.width} × ${out.height}`);
      this.numFmt.setText(`${out.format.toUpperCase()} · ${out.format === 'png' ? t('lossless') : `${Math.round(out.quality * 100)}%`}`);
      this.numWeight.setText(size); this.numWeight.classList.toggle('is-warn', over);
      this.summary.empty();
      this.summary.createDiv({ text: t('summaryWill', { what: `${out.format.toUpperCase()} · ${out.width} × ${out.height} · ${size}`, where: this.destLabel() }), cls: 'qc-export-summary-line' });
      if (over) this.summary.createDiv({ text: t('overLimit', { size: bytes(platform!.maxBytes!) }), cls: 'is-warn' });
      if (out.format !== this.prefs.format) this.summary.createDiv({ text: t('exportConverted', { format: out.format.toUpperCase() }), cls: 'qc-hint' });
    } catch (e) { if (token === this.run && this.contentEl.isConnected) this.summary.setText(e instanceof Error ? e.message : String(e)); }
  }
  onClose(): void {
    if (this.timer !== undefined) this.view.win.clearTimeout(this.timer); ++this.run;
    const src = this.shot?.src; if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    this.shot = undefined as unknown as HTMLImageElement; this.systemInput = undefined;
    this.contentEl.empty();
  }
}

/* ---------- shortcuts ---------- */
export class ShortcutsModal extends Modal {
  constructor(private plugin: CoverPlugin) { super(plugin.app); }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); this.titleEl.setText(t('shortcuts')); this.contentEl.addClass('qc-modal');
    const mod = Platform.isMacOS ? '⌘' : 'Ctrl';
    const rows: [string, string][] = [
      ['T', t('text')], ['R', t('rectangle')], ['O', t('circle')], ['L', t('line')], [`${mod} Z / ⇧${mod} Z`, `${t('undo')} / ${t('redo')}`], [`${mod} C / V / D`, `${t('copyObj')} / ${t('paste')} / ${t('duplicate')}`],
      [`${mod} A`, t('selectAll')], ['Delete', t('remove')], [`${mod} ] / [`, `${t('forward')} / ${t('backward')}`], [`⇧${mod} ] / [`, `${t('front')} / ${t('back')}`], [`${mod} L`, t('locked')],
      ['← ↑ → ↓', t('nudge')], [`${mod} + / − / 0 / 1`, t('zoomKeys')], [`${mod} E`, t('exportAs')], [`⇧${mod} E`, t('quickExport')], [`⇧${mod} C`, this.plugin.isZh() ? '复制图片到剪贴板' : 'Copy image to clipboard'], [`${mod} S`, t('save')], ['Esc', t('deselect')], ['?', t('shortcuts')],
    ];
    const table = this.contentEl.createEl('table', { cls: 'qc-shortcuts' });
    for (const [k, v] of rows) { const tr = table.createEl('tr'); tr.createEl('td').createEl('kbd', { text: k }); tr.createEl('td', { text: v }); }
  }
  onClose(): void { this.contentEl.empty(); }
}

/** Small replacement for the file title the hidden view header used to offer. */
export class RenameModal extends Modal {
  constructor(private plugin: CoverPlugin, private file: TFile) { super(plugin.app); }
  onOpen(): void {
    const t = this.plugin.t.bind(this.plugin); this.titleEl.setText(t('renameDesign')); this.contentEl.addClass('qc-modal');
    const input = this.contentEl.createEl('input', { type: 'text', cls: 'qc-input' }); input.value = this.file.basename;
    const footer = this.contentEl.createDiv('qc-modal-footer'); textButton(footer, t('cancel'), () => this.close());
    const ok = textButton(footer, t('save'), () => {
      const name = safeName(input.value.trim()); if (!name) return;
      const dir = this.file.parent && !this.file.parent.isRoot() ? `${this.file.parent.path}/` : '';
      void this.app.fileManager.renameFile(this.file, `${dir}${name}.${this.file.extension}`).then(() => this.close()).catch(e => this.plugin.report(e));
    }, 'qc-primary');
    onEnter(input, e => { e.preventDefault(); ok.click(); });
    window.setTimeout(() => { input.focus(); input.select(); }, 30);
  }
}

/* ---------- open-source font library ---------- */
export class FontLibraryModal extends Modal {
  private mood: FontMood | 'all' = 'all'; private busy = new Set<string>();
  constructor(private plugin: CoverPlugin, private doc: Document, private onInstalled?: (family: string) => void) { super(plugin.app); }
  onOpen(): void {
    this.titleEl.setText(this.plugin.t('fontLibTitle')); this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal'); this.draw();
  }
  private draw(): void {
    const t = this.plugin.t.bind(this.plugin); const zh = this.plugin.isZh(); const el = this.contentEl; el.empty();
    el.createDiv({ text: t('fontLibDesc'), cls: 'qc-hint' });
    const packs = el.createDiv('qc-packs');
    for (const pk of FONT_PACKS) {
      const left = packMissing(this.plugin, pk.id); const row = packs.createDiv('qc-pack'); const info = row.createDiv('qc-pack-info');
      info.createEl('strong', { text: zh ? pk.zh : pk.en }); info.createSpan({ text: pk.desc });
      if (!left) { const ok = row.createSpan({ cls: 'qc-lib-ok' }); setIcon(ok, 'check'); ok.createSpan({ text: t('fontLibInstalled') }); }
      else {
        const b = textButton(row, this.packBusy === pk.id ? t('fontLibDownloading') : (zh ? `一键安装（${left} 款）` : `Install all (${left})`), () => {
          if (this.packBusy) return; this.packBusy = pk.id; b.disabled = true;
          void installPack(this.plugin, this.doc, pk.id, (done, total, fam) => b.setText(fam ? `${done + 1}/${total} ${fam}…` : '…')).then(r => { this.packBusy = ''; if (r.installed.length) { this.onInstalled?.(r.installed[0]!); } if (this.contentEl.isConnected) this.draw(); });
        }, 'qc-primary qc-btn-sm', 'download');
      }
    }
    const tabs = el.createDiv('qc-starter-tabs');
    for (const m of [{ id: 'all' as const, zh: '全部', en: 'All' }, ...FONT_MOODS]) {
      const b = tabs.createEl('button', { cls: 'qc-starter-tab', text: zh ? m.zh : m.en, attr: { type: 'button' } }); b.classList.toggle('is-active', this.mood === m.id);
      b.addEventListener('click', () => { this.mood = m.id; this.draw(); });
    }
    const list = el.createDiv('qc-lib');
    for (const f of FONT_LIBRARY.filter(x => this.mood === 'all' || x.mood === this.mood)) {
      const row = list.createDiv('qc-lib-row'); const done = this.plugin.fonts.hasFont(f.family);
      const sample = row.createDiv('qc-lib-sample'); sample.setText(zh ? '封面设计' : 'Cover'); if (done) sample.style.fontFamily = `"${f.family}", sans-serif`; else sample.addClass('is-off');
      const info = row.createDiv('qc-lib-info'); info.createDiv({ text: zh ? f.family : f.en, cls: 'qc-lib-name' });
      info.createDiv({ text: f.zh, cls: 'qc-lib-desc' });
      const meta = info.createDiv('qc-hint'); meta.setText(`${f.hint} · ${f.mb < 1 ? `${Math.round(f.mb * 1000)} KB` : `${f.mb} MB`} · ${f.license}${f.note ? ` · ${f.note}` : ''}`);
      const act = row.createDiv('qc-lib-act');
      if (done) { const ok = act.createSpan({ cls: 'qc-lib-ok' }); setIcon(ok, 'check'); ok.createSpan({ text: t('fontLibInstalled') }); }
      else if (this.busy.has(f.id)) { const w = act.createSpan({ cls: 'qc-lib-ok' }); setIcon(w, 'loader-circle'); w.createSpan({ text: t('fontLibDownloading') }); }
      else textButton(act, t('fontLibInstall'), () => void this.install(f.id), 'qc-primary qc-btn-sm', 'download');
      const link = act.createEl('a', { text: t('fontLibSource'), href: f.home, cls: 'qc-hint' }); link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener');
    }
    el.createDiv({ text: t('fontLibNote'), cls: 'qc-hint' });
  }
  private packBusy = '';
  private async install(id: string): Promise<void> {
    const f = FONT_LIBRARY.find(x => x.id === id); if (!f || this.busy.has(id)) return;
    this.busy.add(id); this.draw();
    try { await this.plugin.fonts.installLib(f, this.doc); new Notice(this.plugin.t('fontLibDone', { name: f.family })); this.onInstalled?.(f.family); }
    catch (e) { new Notice(this.plugin.t('fontLibFail', { name: f.family, message: e instanceof Error ? e.message : String(e) })); }
    finally { this.busy.delete(id); if (this.contentEl.isConnected) this.draw(); }
  }
  onClose(): void { this.contentEl.empty(); }
}
