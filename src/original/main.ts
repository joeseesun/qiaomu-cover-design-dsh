import { UpdateNotes } from './update-notes';
import { UPDATE_ENTRIES } from './update-notes-release';
import { cancelAccountLogins } from './model-access/services/provider-auth';
import { cancelKeyLogins } from './authflow';
import { cancelCodexLogins } from './codex';
import { COVER_ICON, registerCoverIcon } from './cover-icon';
import { GalleryStore } from './gallery-store';
import { GalleryDialog, type GalleryTab } from './gallery';
import { ImageJobs } from './imagejobs';
import { VaultImageJobStore } from './imagejobstore';
import { ImageResultsDialog } from './imagejobdialog';
import { App, getLanguage, MarkdownView, Notice, Platform, Plugin, TFile, normalizePath, setIcon } from '../harness-ui';
import { Design, folderPath, safeName } from './model';
import { Key, translate } from './i18n';
import { homeProvider, HomeProvider, notifyHomeChanged } from './integrations/qiaomu-home';
import { DEFAULTS, mergeSettings, Settings } from './config';
import { FontService } from './fonts';
import { AssistantProvider, interpret } from './ops';
import { AiService } from './ai';
import { syncProfiles } from './aiparse';
import { shutdownCodex } from './codex';
import { NewCoverModal, PickFile } from './modals';
import { CoverSettings, SettingsTab } from './settings';
import { PROPS, CoverView, VIEW } from './view';
import { platformById, DEFAULT_PLATFORM } from './platforms';
import { builtPalette, templateById } from './templates';
import { SerialWriter } from './model';

export default class CoverPlugin extends Plugin {
  updateNotes!: UpdateNotes;
  qiaomuHome?: HomeProvider; imageJobs!: ImageJobs; gallery!: GalleryStore; private galleryDialog?: GalleryDialog;
  modelAccessDialogs = new Set<{ close(): void }>();
  settings: Settings = structuredClone(DEFAULTS); fonts!: FontService; ai = new AiService(() => this.settings.ai, this.app.secretStorage);
  /** Text a new cover should be designed from once its view has loaded, keyed by file path. */
  private briefs = new Map<string, string>();
  private writer = new SerialWriter(); private assistants = new Map<string, AssistantProvider>(); private settingsTab?: CoverSettings; private fontTimer?: number;
  private settingsWriter = new SerialWriter();

  t(key: Key, params?: Record<string, string | number>): string { return translate(this.lang(), key, params); }
  lang(): string { return this.settings.language === 'auto' ? getLanguage() : this.settings.language; }
  isZh(): boolean { return this.lang().toLowerCase().startsWith('zh'); }
  report(error: unknown): void { new Notice(this.t('error', { message: error instanceof Error ? error.message : String(error) })); }

  /** Other plugins (or a model integration) call this to take over natural-language design. Returns a disposer. */
  registerAssistant(provider: AssistantProvider): () => void {
    this.assistants.set(provider.id, provider);
    return () => { this.assistants.delete(provider.id); };
  }
  assistantList(): AssistantProvider[] {
    const offline: AssistantProvider = { id: 'offline', name: this.t('assistantOffline'), run: input => Promise.resolve(interpret(input)) };
    const model: AssistantProvider = { id: 'ai', name: this.t('assistantAi'), run: input => {
      if (this.ai.ready()) return this.ai.plan(input);
      const result = interpret(input); return Promise.resolve(result.ops.length ? result : { reply: this.t('aiNotReady'), ops: [] });
    } };
    return [model, offline, ...this.assistants.values()];
  }
  takeBrief(path: string): string | undefined { const brief = this.briefs.get(path); this.briefs.delete(path); return brief; }
  /** Designs a cover for a block of text without asking anything else. */
  async coverFromText(name: string, text: string, note?: TFile, selection = true): Promise<void> {
    if (!this.ai.ready()) { new Notice(this.t('aiNotReady')); this.openSettings('assistant'); return; }
    await this.createDesign(name, 'minimal', note, name, undefined, note ? this.t('noteDesignRequest') : text, note && selection ? text : undefined);
  }
  openGallery(tab:GalleryTab='images',view?:CoverView):void{this.galleryDialog?.close();this.galleryDialog=new GalleryDialog(this,tab,view);this.galleryDialog.open();}
  openImageTasks(): void { this.openGallery('tasks'); }
  /** Find the source's own editor, never whichever note happens to be active. */
  async readNote(note: TFile): Promise<string> {
    const view = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .find((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === note.path);
    return view?.editor ? view.editor.getValue() : this.app.vault.cachedRead(note);
  }
  activeCover(): CoverView | undefined { return this.app.workspace.getActiveViewOfType(CoverView) ?? undefined; }

  /** After fonts are installed: re-pair the fonts of every open cover. */
  /** Deferred tabs (not opened since launch) hold a placeholder view, so only real cover views are touched. */
  repairOpenCovers(): void { for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) if (leaf.view instanceof CoverView) leaf.view.repairFonts(); }
  async onload(): Promise<void> {
    registerCoverIcon();
    this.settings = mergeSettings(await this.loadData());
    this.gallery = new GalleryStore(this.app.vault.adapter, `${this.manifest.dir}/gallery`);
    this.imageJobs = new ImageJobs(new VaultImageJobStore(this.app.vault.adapter, `${this.manifest.dir}/image-jobs`), job => {
      const doc = activeDocument; const fragment = doc.createDocumentFragment();
      const row = doc.createElement('div'); row.className = 'qc-image-notice'; fragment.appendChild(row);
      const icon = row.createSpan('qc-image-notice-icon'); setIcon(icon, job.state === 'ready' ? 'circle-check' : 'circle-alert');
      const copy = row.createDiv('qc-image-notice-copy'); copy.createEl('strong', { text: this.t(job.state === 'ready' ? 'imageTaskComplete' : 'imageTaskFailed') });
      if (job.state === 'ready') copy.createSpan({ cls: 'qc-image-notice-hint', text: this.t('imageTaskReviewHint') });
      const button = row.createEl('button', { cls: 'qc-image-notice-action', text: this.t(job.state === 'ready' ? 'imageViewResults' : 'imageTasks'), attr: { type: 'button' } });
      const notice = new Notice(fragment, 12000); button.addEventListener('click', () => { notice.hide(); if (job.state === 'ready') new ImageResultsDialog(this, job).open(); else this.openImageTasks(); });
    });
    await this.imageJobs.refresh();
    this.addCommand({ id:'image-library',name:this.isZh()?'打开图库':'Open image library',callback:()=>this.openGallery() });
    this.addCommand({ id: 'image-tasks', name: this.t('imageTasks'), callback: () => this.openImageTasks() });
    this.fonts = new FontService(this.app, () => this.settings.fontFolder, () => this.manifest.dir ?? '');
    this.registerView(VIEW, leaf => new CoverView(leaf, this));
    this.registerExtensions(['qcover'], VIEW);
    // The default font library arrives silently on first run (store installs ship no font files); open covers re-pair as it lands.
    this.app.workspace.onLayoutReady(() => { void this.fonts.loadBundledIndex().then(() => this.fonts.syncLibrary(() => this.repairOpenCovers())); void this.fonts.loadVault(activeDocument); });
    const touchFonts = (file: unknown): void => {
      if (!(file instanceof TFile) || !file.path.startsWith(`${normalizePath(this.settings.fontFolder)}/`)) return;
      window.clearTimeout(this.fontTimer); this.fontTimer = window.setTimeout(() => void this.fonts.loadVault(activeDocument), 400);
    };
    this.registerEvent(this.app.vault.on('create', touchFonts)); this.registerEvent(this.app.vault.on('delete', touchFonts)); this.registerEvent(this.app.vault.on('modify', touchFonts));

    this.qiaomuHome = homeProvider({
      sections: () => [{ id: 'recent-covers', title: this.t('recent'), items: this.designs().slice(0, 6).map(file => ({ id: file.path, title: file.basename, icon: 'image', open: () => this.openDesign(file) })) }],
      actions: () => [{ id: 'new-cover', label: this.t('create'), icon: 'image-plus', run: () => this.openNew() }],
      search: (query, limit) => this.designs().filter(f => f.basename.toLowerCase().includes(query.toLowerCase())).slice(0, Math.max(0, limit)).map(file => ({ id: file.path, title: file.basename, icon: 'image', open: () => this.openDesign(file) })),
    });
    let notifyTimer: number | undefined; // saves fire every few hundred ms while editing; the home page only needs to hear about it once things settle
    const notify = (file: unknown): void => { if (file instanceof TFile && file.extension === 'qcover') { window.clearTimeout(notifyTimer); notifyTimer = window.setTimeout(() => notifyHomeChanged(this.app, this.manifest.id), 1500); } };
    this.registerEvent(this.app.vault.on('create', notify)); this.registerEvent(this.app.vault.on('modify', notify)); this.registerEvent(this.app.vault.on('delete', notify));

    this.addCommand({ id: 'new-cover', name: this.t('create'), callback: () => this.openNew() });
    this.addCommand({ id: 'open-designer', name: this.t('open'), callback: () => void this.startBlank().catch(e => this.report(e)) });
    this.addCommand({ id: 'open-existing', name: this.t('openExisting'), callback: () => this.chooseDesign() });
    this.addCommand({ id: 'cover-from-note', name: this.t('fromNote'), checkCallback: checking => {
      const note = this.app.workspace.getActiveFile(); const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const editor = view?.file?.path === note?.path ? view?.editor : undefined;
      if (!note || note.extension !== 'md') return false;
      if (!checking) new NewCoverModal(this, note, editor?.getSelection() || note.basename, editor?.getSelection() || undefined).open();
      return true;
    } });
    this.addCommand({ id: 'ai-cover-from-note', name: this.t('aiFromNote'), checkCallback: checking => {
      const note = this.app.workspace.getActiveFile(); const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const editor = view?.file?.path === note?.path ? view?.editor : undefined;
      if (!note || note.extension !== 'md') return false;
      if (!checking) void (async () => {
        const selection = editor?.getSelection();
        await this.coverFromText(note.basename, selection || '', note, !!selection);
      })().catch(e => this.report(e));
      return true;
    } });
    this.addCommand({ id: 'export-active', name: this.t('quickExport'), checkCallback: checking => {
      const view = this.activeCover(); if (!view?.canvas) return false;
      if (!checking) void view.action(() => view.quickExport());
      return true;
    } });
    this.addCommand({ id: 'ab-variants', name: this.t('abCommand'), checkCallback: checking => {
      const view = this.activeCover(); if (!view?.canvas) return false;
      if (!checking) void view.showVariants();
      return true;
    } });
    this.addCommand({ id: 'save-series', name: this.t('seriesSave'), checkCallback: checking => {
      const view = this.activeCover(); if (!view?.design?.template) return false;
      if (!checking) { const s = view.saveSeries(); if (s) new Notice(this.t('seriesSaved', { name: s.name })); view.refreshDrawer(); }
      return true;
    } });
    this.addRibbonIcon(COVER_ICON, this.t('open'), () => void this.startBlank().catch(e => this.report(e)));
    this.updateNotes = new UpdateNotes(this, UPDATE_ENTRIES, () => this.lang());
    this.settingsTab = new CoverSettings(this.app, this); this.addSettingTab(this.settingsTab);
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') menu.addItem(item => item.setTitle(this.t('fromNote')).setIcon('image').onClick(() => new NewCoverModal(this, file, file.basename).open()));
    }));
    this.registerEvent(this.app.vault.on('rename', (file, old) => {
      if (!(file instanceof TFile)) return;
      if (file.extension === 'qcover') {
        if (this.settings.conversations[old]) { this.settings.conversations[file.path] = this.settings.conversations[old]!; delete this.settings.conversations[old]; }
        if (this.settings.chats[old]) { this.settings.chats[file.path] = this.settings.chats[old]!; delete this.settings.chats[old]; }
        void this.saveSettings();
      }
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
        const view = leaf.view as CoverView;
        if (view.design?.source === old) { view.design.source = file.path; view.changed(); }
      }
    }));
    // Hide the host status bar only while a cover tab is in front.
    this.registerEvent(this.app.workspace.on('active-leaf-change', leaf => { document.body.toggleClass('qc-cover-active', leaf?.view.getViewType() === VIEW); }));
  }
  onunload(): void { cancelAccountLogins(); for (const modal of this.modelAccessDialogs) modal.close(); cancelKeyLogins(); cancelCodexLogins(); this.galleryDialog?.close(); this.imageJobs?.dispose(); shutdownCodex(); document.body.removeClass('qc-cover-active'); window.clearTimeout(this.fontTimer); }

  /** Covers opened with one click and not yet touched. They vanish again if closed untouched, so trying the designer leaves no clutter. */
  scratch = new Set<string>();
  /** Opens the designer on a fresh blank cover straight away (or brings an open one forward). Nothing to choose first. */
  async startBlank(): Promise<void> {
    const open = this.app.workspace.getLeavesOfType(VIEW); const recent = open.find(l => l === this.app.workspace.getMostRecentLeaf()) ?? open[0];
    if (recent) { await this.app.workspace.revealLeaf(recent); return; }
    const p = platformById(this.settings.defaultPlatform) ?? platformById(DEFAULT_PLATFORM)!;
    const design: Design = { format: 'qiaomu-cover-design', schema: 1, width: p.width, height: p.height, platform: p.id, bg: { kind: 'solid', color: '#ffffff' }, canvas: { version: '7.4.0', background: '#ffffff', objects: [] } };
    const file = await this.createFile(this.t('untitled'), design); this.scratch.add(file.path);
  }
  openNew(note?: TFile, title = ''): void { new NewCoverModal(this, note, title).open(); }
  openSettings(tab?: SettingsTab): void {
    const setting = (this.app as App & { setting?: { open(): void; openTabById(id: string): void } }).setting;
    if (tab && this.settingsTab) this.settingsTab.tab = tab;
    setting?.open(); setting?.openTabById(this.manifest.id);
  }
  chooseDesign(): void {
    const files = this.designs();
    if (!files.length) { this.openNew(); return; }
    new PickFile(this.app, files, file => { void this.openDesign(file).catch(e => this.report(e)); }, this.t('chooseDesign')).open();
  }
  designs(): TFile[] { return this.app.vault.getFiles().filter(f => f.extension === 'qcover').sort((a, b) => b.stat.mtime - a.stat.mtime); }
  async openDesign(file: TFile): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW).find(l => (l.view as CoverView).file?.path === file.path);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    await this.app.workspace.getLeaf('tab').openFile(file);
  }
  async ensureFolder(path: string): Promise<void> {
    const parts = folderPath(path).split('/'); let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); } catch (e) { if (!this.app.vault.getAbstractFileByPath(current)) throw e; }
      }
    }
  }
  unique(folder: string, name: string, extension: string): string {
    const base = normalizePath(folder ? `${folder}/${safeName(name)}` : safeName(name)); let path = `${base}.${extension}`; let i = 1;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${base} ${i++}.${extension}`;
    return path;
  }
  async createDesign(name: string, template: string, note?: TFile, title?: string, platformId?: string, brief?: string, selection?: string): Promise<TFile> {
    const design = this.initialDesign(template, title || name, this.t('subtext'), note?.path, platformId);
    if (selection?.trim()) design.noteSelection = selection;
    return this.createFile(name, design, brief);
  }
  private async createFile(name: string, design: Design, brief?: string): Promise<TFile> {
    let created: TFile | undefined;
    await this.writer.run(async () => {
      const folder = folderPath(this.settings.designFolder); await this.ensureFolder(folder);
      created = await this.app.vault.create(this.unique(folder, name, 'qcover'), JSON.stringify(design, null, 2));
    });
    if (brief?.trim()) this.briefs.set(created!.path, brief.trim());
    if (this.settings.drawer !== 'assistant') { this.settings.drawer = 'assistant'; await this.saveSettings(); } // a new cover always starts with the designer open
    await this.openDesign(created!); return created!;
  }
  async duplicateDesign(name: string, design: Design): Promise<TFile> { return this.createFile(name, structuredClone(design)); }
  initialDesign(template: string, title: string, subtitle: string, source?: string, platformId?: string): Design {
    const p = platformById(platformId) ?? platformById(this.settings.defaultPlatform) ?? platformById(DEFAULT_PLATFORM)!;
    const result = (templateById(template) ?? templateById('minimal')!).build({ width: p.width, height: p.height, title, subtitle, zh: this.isZh() });
    const bg = result.background;
    const palette = builtPalette();
    return { format: 'qiaomu-cover-design', schema: 1, width: p.width, height: p.height, source, platform: p.id, bg, ...(palette ? { palette } : {}), canvas: { version: '7.4.0', background: bg.kind === 'solid' ? bg.color : bg.from, objects: result.objects.map(o => o.toObject(PROPS)) } };
  }
  saveSettings(): Promise<void> { syncProfiles(this.settings.ai); const snapshot = structuredClone(this.settings); return this.settingsWriter.run(() => this.saveData(snapshot)); }
  rememberFont(family: string): void { this.settings.recentFonts = [family, ...this.settings.recentFonts.filter(f => f !== family)].slice(0, 12); void this.saveSettings(); }
  rememberColor(color: string): void {
    if (!/^#[\da-f]{6}$/i.test(color)) return;
    this.settings.recentColors = [color.toLowerCase(), ...this.settings.recentColors.filter(c => c !== color.toLowerCase())].slice(0, 8); void this.saveSettings();
  }

  /** Desktop only: writes outside the vault to a folder the user named. */
  async writeSystemFile(dir: string, filename: string, data: ArrayBuffer): Promise<string> {
    const req = (window as unknown as { require?: (id: string) => unknown }).require;
    if (!Platform.isDesktopApp || !req) throw new Error(this.t('destSystemDesktop'));
    const fs = req('fs') as typeof import('fs'); const path = req('path') as typeof import('path'); const os = req('os') as typeof import('os');
    let target = dir.trim(); if (!target) throw new Error(this.t('destSystemMissing'));
    if (target === '~' || target.startsWith('~/') || target.startsWith('~\\')) target = path.join(os.homedir(), target.slice(1));
    if (!path.isAbsolute(target)) throw new Error(this.t('destSystemMissing'));
    await fs.promises.mkdir(target, { recursive: true });
    const ext = path.extname(filename); const base = path.basename(filename, ext); let full = path.join(target, filename); let i = 1;
    while (fs.existsSync(full)) full = path.join(target, `${base} ${i++}${ext}`);
    await fs.promises.writeFile(full, Buffer.from(data));
    return full;
  }
  /** Explicit save dialog for a selected-element PNG; cancellation never writes a file. */
  async saveSystemPng(filename: string, data: ArrayBuffer): Promise<string | undefined> {
    const req = (window as unknown as { require?: (id: string) => unknown }).require;
    if (!Platform.isDesktopApp || !req) throw new Error(this.t('destSystemDesktop'));
    const remote = req('@electron/remote') as { dialog: { showSaveDialog(options: { defaultPath: string; filters: {name: string; extensions: string[]}[] }): Promise<{ canceled: boolean; filePath?: string }> } };
    const result = await remote.dialog.showSaveDialog({ defaultPath: filename, filters: [{ name: 'PNG image', extensions: ['png'] }] });
    if (result.canceled || !result.filePath) return undefined;
    const fs = req('fs') as typeof import('fs'); await fs.promises.writeFile(result.filePath, Buffer.from(data));
    return result.filePath;
  }
  /** Lets the user pick a system folder through the browser directory picker and recovers its absolute path. */
  chooseSystemFolder(doc: Document): Promise<string | undefined> {
    return new Promise(resolve => {
      const input = doc.createElement('input'); input.type = 'file'; input.setAttribute('webkitdirectory', '');
      input.addEventListener('change', () => {
        const file = input.files?.[0]; if (!file) { resolve(undefined); return; }
        const req = (window as unknown as { require?: (id: string) => { webUtils?: { getPathForFile(f: File): string } } }).require;
        let full = ''; try { full = req?.('electron').webUtils?.getPathForFile(file) ?? ''; } catch { /* older Electron */ }
        full ||= (file as File & { path?: string }).path ?? '';
        const rel = (file as File & { webkitRelativePath: string }).webkitRelativePath;
        if (!full || !rel) { new Notice(this.t('pickFailed')); resolve(undefined); return; }
        resolve(full.slice(0, full.length - rel.length) + rel.split('/')[0]);
      }, { once: true });
      input.addEventListener('cancel', () => resolve(undefined), { once: true });
      input.click();
    });
  }
}
