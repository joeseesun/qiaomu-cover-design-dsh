import { signOutAccount } from './model-access/services/provider-auth';
import { App, Notice, PluginSettingTab, SecretComponent, TextComponent, setIcon } from '../harness-ui';
import type CoverPlugin from '../native-controller';
import { folderPath } from './model';
import { GROUPS, PLATFORMS } from './platforms';
import { FONT_SITES } from './fontbrowser';
import { ModelDialog } from './modeldialog';
import { chatLabel, imageLabel, removeChat, removeImage, switchChat, switchImage, syncProfiles, imageConnection } from './aiparse';
import { FONT_PACKS } from './fontlib';
import { installPack, packMissing } from './fontpack';
import { FontLibraryModal, ShortcutsModal, PickFolder } from './modals';
import { bytes, textButton, iconButton } from './ui';
import { more, Row, section, statusBar } from './settingsui';

export type SettingsTab = 'general' | 'export' | 'fonts' | 'assistant' | 'about';
const TABS: { id: SettingsTab; icon: string }[] = [{ id: 'general', icon: 'sliders-horizontal' }, { id: 'export', icon: 'download' }, { id: 'fonts', icon: 'type' }, { id: 'assistant', icon: 'sparkles' }, { id: 'about', icon: 'info' }];
import { chatSourceOf, imageSourceOf } from './catalog';

export class CoverSettings extends PluginSettingTab {
  tab: SettingsTab = 'general'; private off?: () => void; private testLine?: { tone: 'ok' | 'warn'; text: string };
  constructor(app: App, private plugin: CoverPlugin) { super(app, plugin); }
  hide(): void { this.off?.(); this.off = undefined; }
  private get t(): CoverPlugin['t'] { return this.plugin.t.bind(this.plugin); }
  private save(): void { void this.plugin.saveSettings().catch(e => this.plugin.report(e)); }

  display(): void {
    const el = this.containerEl; el.empty(); el.addClass('qc-settings'); this.off?.();
    const head = el.createDiv('qc-settings-head'); const id = head.createDiv('qc-settings-identity');
    setIcon(id.createSpan(), 'image'); id.createSpan({ text: this.plugin.manifest.name, cls: 'qc-settings-name' }); id.createSpan({ text: `v${this.plugin.manifest.version}`, cls: 'qc-settings-version' });
    const tabs = head.createDiv('qc-settings-tabs'); tabs.setAttribute('role', 'tablist');
    for (const { id: tab, icon } of TABS) {
      const b = tabs.createEl('button', { cls: 'qc-settings-tab', attr: { type: 'button', role: 'tab', 'aria-selected': String(this.tab === tab) } });
      setIcon(b.createSpan({ cls: 'qc-settings-tab-icon' }), icon); b.createSpan({ text: this.t(`set_${tab}` as 'set_general') }); b.classList.toggle('is-active', this.tab === tab);
      b.addEventListener('click', () => { this.tab = tab; this.display(); });
    }
    const body = el.createDiv('qc-settings-body');
    ({ general: () => this.general(body), export: () => this.exportTab(body), fonts: () => this.fontsTab(body), assistant: () => this.assistantTab(body), about: () => this.about(body) })[this.tab]();
  }

  private folderRow(parent: HTMLElement, name: string, desc: string, get: () => string, set: (v: string) => void): void {
    let input: TextComponent;
    const row = new Row(parent, name, desc);
    row.el.addClass('qcs-folder-row');
    row.addText(text => {
      input = text; text.inputEl.setAttribute('aria-label', name);
      text.setValue(get()).onChange(value => {
        try { set(folderPath(value)); this.save(); text.inputEl.removeClass('qc-invalid'); }
        catch { text.inputEl.addClass('qc-invalid'); }
      });
    }).addButton(button => button.setButtonText(this.plugin.isZh() ? '浏览…' : 'Browse…').onClick(() => {
      new PickFolder(this.app, path => { set(folderPath(path)); input.setValue(path); input.inputEl.removeClass('qc-invalid'); this.save(); }, this.t('folderPick'), false).open();
    }));
  }

  /* ---------- general ---------- */
  private general(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const zh = this.plugin.isZh();
    const basics = section(body, t('s_basics'));
    new Row(basics, t('language'), t('restart')).addDropdown(d => d.addOptions({ auto: t('auto'), zh: '中文', en: 'English' }).setValue(s.language).onChange(v => { s.language = v; this.save(); }));
    new Row(basics, t('defaultPlatform'), t('defaultPlatformDesc')).addDropdown(d => {
      for (const g of GROUPS) for (const p of PLATFORMS.filter(x => x.group === g.id)) d.addOption(p.id, `${this.plugin.isZh() ? p.zh : p.en} · ${p.width}×${p.height}`);
      d.setValue(s.defaultPlatform).onChange(v => { s.defaultPlatform = v; this.save(); });
    });
    this.folderRow(basics, t('designFolder'), t('designFolderDesc'), () => s.designFolder, v => { s.designFolder = v; });
    const ui = section(body, zh ? '界面' : 'Interface');
    new Row(ui, zh ? '顶部插入工具' : 'Top insertion tools', zh ? '仅图标更简洁；悬停查看名称。图标和文字更适合初次使用。' : 'Icons keep the toolbar compact; hover for labels. Text labels help you learn the tools.').addDropdown(d => d.addOptions(zh ? { icons: '仅图标', labels: '图标和文字' } : { icons: 'Icons only', labels: 'Icons and text' }).setValue(s.toolbarLabels ? 'labels' : 'icons').onChange(value => { s.toolbarLabels = value === 'labels'; this.save(); for (const leaf of this.app.workspace.getLeavesOfType('qiaomu-cover-design')) (leaf.view as { refreshToolbar?: () => void }).refreshToolbar?.(); }));
    const photos = section(body, zh ? 'Unsplash 免费摄影图库' : 'Unsplash free photo library', zh ? '搜索风景、人物、建筑等高清照片，插入到设计中。Unsplash 免费照片可按其许可用于个人和商业创作；不是开源素材，也不包含 Unsplash+ 付费照片。' : 'Find high-resolution photos for your designs. Free Unsplash photos allow personal and commercial use under the Unsplash License; Unsplash+ paid photos are not included.');
    const links = photos.createDiv('qcs-photo-links');
    for (const [label, href] of [[zh ? '免费申请 Access Key' : 'Get a free Access Key', 'https://unsplash.com/oauth/applications'], [zh ? '查看图片许可' : 'Photo license', 'https://unsplash.com/license']]) links.createEl('a', { text: label, href, attr: { target: '_blank', rel: 'noopener noreferrer' } });
    const steps = photos.createEl('ol', { cls: 'qcs-key-steps' });
    for (const text of (zh ? ['登录 Unsplash，进入 Your applications，点击 New Application 创建应用。', '打开应用详情的 Keys 区域，复制 Access Key（AK）。', '点击下方“链接…”添加密钥，粘贴 Access Key。不要填 Application ID（App ID）或 Secret Key（SK）。'] : ['Sign in to Unsplash → Your applications → New Application.', 'Open your application → Keys → copy Access Key (AK).', 'Use “Link…” below to add it to secret storage. Do not use Application ID or Secret Key (SK).'])) steps.createEl('li', { text });
    const keyRow = new Row(photos, 'Unsplash Access Key', zh ? '连接后可在图库的 Unsplash 页签搜索照片。密钥保存在 系统密钥库中。' : 'Search photos in the gallery’s Unsplash tab after connecting. Your key is kept in system credential storage.');
    try { new SecretComponent(this.app, keyRow.control).setValue(s.unsplashSecret).onChange(v => { s.unsplashSecret = v; this.save(); }); } catch { keyRow.setDesc(zh ? '系统密钥库暂不可用。' : 'System credential storage is unavailable.'); }
    const proxy = more(photos, zh ? '高级：使用代理（可选）' : 'Advanced: proxy (optional)');
    new Row(proxy, zh ? 'Unsplash 代理地址' : 'Unsplash proxy', zh ? '通常留空即可。有团队管理员提供的代理地址时再填写；使用代理后无需在这里添加 Access Key，搜索词会发送给该代理。' : 'Leave empty for normal use. Use a proxy supplied by your team instead of an Access Key; searches are sent to that proxy.').addText(x => x.setPlaceholder('https://…workers.dev').setValue(s.unsplashProxy).onChange(v => { const u = v.trim(); if (!u || /^https:\/\//.test(u)) { s.unsplashProxy = u; this.save(); x.inputEl.removeClass('qc-invalid'); } else x.inputEl.addClass('qc-invalid'); }));
    const guides = section(body, t('guidesDefault'), t('s_guidesDesc'));
    new Row(guides, t('centerLines')).addToggle(x => x.setValue(s.guides.center).onChange(v => { s.guides.center = v; this.save(); }));
    new Row(guides, t('snap'), t('snapDesc')).addToggle(x => x.setValue(s.guides.snap).onChange(v => { s.guides.snap = v; this.save(); }));
    new Row(guides, t('safeZone'), t('safeZoneDesc')).addToggle(x => x.setValue(s.guides.safe).onChange(v => { s.guides.safe = v; this.save(); }));
  }

  /* ---------- export ---------- */
  private exportTab(body: HTMLElement): void {
    const s = this.plugin.settings; const t = this.t; const e = s.export;
    const where = section(body, t('s_exportWhere'), t('exportDefaultsDesc'));
    new Row(where, t('destination')).addDropdown(d => d.addOptions({ folder: t('destFolder'), note: t('destNote'), system: t('destSystem') }).setValue(e.destination ?? 'folder').onChange(v => { e.destination = v as 'folder'; this.save(); this.display(); }));
    if ((e.destination ?? 'folder') === 'system') {
      new Row(where, t('destSystem'), t('destSystemHint')).addText(x => x.setPlaceholder('~/Downloads').setValue(e.systemDir ?? '').onChange(v => { e.systemDir = v.trim(); this.save(); }))
        .addButton(b => b.setButtonText(t('choose')).onClick(() => void this.plugin.chooseSystemFolder(this.containerEl.ownerDocument).then(p => { if (p) { e.systemDir = p; this.save(); this.display(); } })));
    } else this.folderRow(where, t('exportFolder'), t('exportFolderDesc'), () => s.exportFolder, v => { s.exportFolder = v; });
    const file = section(body, t('s_exportFile'));
    new Row(file, t('format')).addDropdown(d => d.addOptions({ png: 'PNG', jpeg: 'JPEG', webp: 'WebP' }).setValue(e.format ?? 'png').onChange(v => { e.format = v as 'png'; this.save(); }));
    new Row(file, t('exportSize')).addDropdown(d => d.addOptions({ '1': '1×', '2': '2×', '3': '3×' }).setValue(String(e.scale ?? 1)).onChange(v => { e.scale = Number(v); this.save(); }));
    new Row(file, t('quality'), t('qualityDesc')).addSlider(x => x.setLimits(40, 100, 1).setValue(Math.round((e.quality ?? 0.92) * 100)).setDynamicTooltip().onChange(v => { e.quality = v / 100; this.save(); }));
    new Row(file, t('filename'), t('filenameHint')).addText(x => x.setValue(e.filename ?? '{name}-{platform}').onChange(v => { e.filename = v.trim() || '{name}-{platform}'; this.save(); }));
    new Row(file, t('fitLimitShort'), t('fitLimitDesc')).addToggle(x => x.setValue(e.fitLimit ?? true).onChange(v => { e.fitLimit = v; this.save(); }));
  }

  /* ---------- fonts ---------- */
  private fontsTab(body: HTMLElement): void {
    const s = this.plugin.settings, t = this.t, fonts = this.plugin.fonts, doc = this.containerEl.ownerDocument, zh = this.plugin.isZh();
    const state = fonts.libraryState(), bar = statusBar(body, state.ready === state.total ? 'ok' : 'warn', zh ? `内置字库 ${state.ready}/${state.total} 款已就绪` : `Built-in library: ${state.ready}/${state.total} ready`, zh ? '内置字体在画布的字体选择器里使用，无需逐个安装。' : 'Built-in fonts are available in the canvas font picker; no individual installation needed.');
    const browse = section(body, zh ? '选择与添加字体' : 'Choose and add fonts', zh ? '在字体库中预览和选择，或导入你自己的字体。' : 'Preview the font library or import your own fonts.');
    const actions = browse.createDiv('qcs-font-actions'); textButton(actions, t('fontLibOpen'), () => new FontLibraryModal(this.plugin, doc, () => this.display()).open(), 'qc-primary', 'type');
    const picker = doc.createElement('input'); picker.type = 'file'; picker.multiple = true; picker.accept = '.ttf,.otf,.woff,.woff2';
    picker.addEventListener('change', () => void fonts.importFiles(Array.from(picker.files ?? []), doc).then(added => { new Notice(added.length ? t('fontsImported', { names: added.join(', ') }) : t('fontsNone')); this.display(); }).catch(err => this.plugin.report(err)));
    textButton(actions, t('fontImportBtn'), () => picker.click(), '', 'upload');
    const repair = textButton(bar.action, zh ? '补齐字库' : 'Complete library', () => void fonts.syncLibrary(() => this.plugin.repairOpenCovers()).catch(e => this.plugin.report(e)), 'qc-btn-sm', 'refresh-cw'); repair.toggleClass('qc-hidden', state.ready === state.total);
    const mine = section(body, zh ? '我添加的字体' : 'My added fonts', zh ? '只显示额外导入或下载到库内的字体。' : 'Only additional imported or downloaded vault fonts.');
    const list = mine.createDiv('qc-font-files'), files = fonts.files().filter(f => !fonts.hasBundled(f.family));
    if (!files.length) list.createDiv({ text: zh ? '还没有额外字体，内置字库已足够开始设计。' : 'No additional fonts yet. The built-in library is enough to start.', cls: 'qc-empty-note' });
    for (const f of files) {
      const row = list.createDiv('qc-font-file'), sample = row.createSpan({ text: '封面 Aa', cls: 'qc-font-file-sample' }); sample.style.fontFamily = `"${f.family}", sans-serif`;
      row.createSpan({ text: f.family, cls: 'qc-font-file-name' }); row.createSpan({ text: `${f.ext.toUpperCase()} · ${bytes(f.size)}`, cls: 'qc-hint' });
      iconButton(row, 'trash-2', t('remove'), () => void fonts.remove(f.family, doc).then(() => this.display()).catch(e => this.plugin.report(e)));
    }
    const extraPacks = FONT_PACKS.filter(pk => packMissing(this.plugin, pk.id) > 0);
    if (extraPacks.length) {
      const extras = more(body, zh ? '更多可选字体包' : 'Additional font packs');
      for (const pk of extraPacks) { const left = packMissing(this.plugin, pk.id); new Row(extras, zh ? pk.zh : pk.en, zh ? `${left} 款尚未安装；已有字体不会重复下载。` : `${left} additional fonts; installed ones are skipped.`).addButton(b => b.setButtonText(zh ? '添加缺少的字体' : 'Add missing fonts').onClick(() => { b.setDisabled(true); void installPack(this.plugin, doc, pk.id).then(() => this.display()).catch(e => this.plugin.report(e)); })); }
    }
    const maintenance = more(body, zh ? '存储与系统字体' : 'Storage and system fonts');
    this.folderRow(maintenance, t('fontFolder'), t('fontFolderDesc'), () => s.fontFolder, value => { s.fontFolder = value; void fonts.loadVault(doc).then(() => this.display()); });
    new Row(maintenance, t('fontsSystemStatus'), fonts.state === 'ok' ? t('fontCount', { n: fonts.system.length, v: fonts.vault.length }) : fonts.state === 'idle' ? t('fontScanning') : t('fontLimited')).addButton(b => b.setButtonText(t('fontRefresh')).onClick(() => void fonts.scanSystem(doc, true).then(() => this.display())));
    const help = more(body, zh ? '字体来源与许可' : 'Font sources and licensing'); help.createDiv({ text: t('fontLicense'), cls: 'qcs-note' });
    const links = help.createDiv('qc-links'); for (const [name, url] of FONT_SITES) links.createEl('a', { text: name, href: url, attr: { target: '_blank', rel: 'noopener' } });
    this.off = fonts.onChange(() => { if (!bar.el.isConnected) return; const state = fonts.libraryState(); bar.el.querySelector('.qcs-status-main')!.setText(zh ? `内置字库 ${state.ready}/${state.total} 款已就绪` : `Built-in library: ${state.ready}/${state.total} ready`); repair.toggleClass('qc-hidden', state.ready === state.total); repair.disabled = state.running; });
  }

  /* ---------- AI designer ---------- */
  private assistantTab(body: HTMLElement): void {
    const t = this.t; const ai = this.plugin.settings.ai; const zh = this.plugin.isZh();
    syncProfiles(ai);
    const controls = section(body, zh ? 'AI 设计' : 'AI design');
    new Row(controls, zh ? '启用 AI' : 'Enable AI', zh ? '排版和生图分别选择默认模型；实际使用时才会发送内容。' : 'Choose separate defaults for layout and images. Content is sent only when you use AI.').addToggle(x => x.setValue(ai.enabled).onChange(v => { ai.enabled = v; this.save(); this.display(); }));
    const configured = this.plugin.ai.ready();
    const bar = statusBar(controls, ai.enabled ? 'warn' : 'off', !ai.enabled ? t('aiS_off') : configured ? (zh ? '排版模型已配置' : 'Layout model configured') : (zh ? '添加一个排版模型即可开始' : 'Add a layout model to get started'), zh ? '配置不代表已连通。可测试排版连接；生图额度由所选服务提供。' : 'Configuration does not verify connectivity. Test layout below; image availability depends on your service.');
    if (configured) textButton(bar.action, t('aiTest'), () => this.runTest(bar.el), 'qc-btn-sm', 'plug-zap');
    if (this.testLine) bar.el.createDiv({ text: this.testLine.text, cls: `qcs-status-test is-${this.testLine.tone}` });
    const changed = (): void => { this.testLine = undefined; if (this.containerEl.isConnected) this.display(); };
    const layouts = section(body, zh ? '排版模型' : 'Layout models', zh ? '用于文案、排版和画布编辑。先选择服务，再登录并选择模型。' : 'For copy, layout and canvas edits. Choose a service, connect, then pick models.');
    this.modelList(layouts, ai.chats.map(p => ({ id: p.id, label: chatLabel(p.snap), provider: chatSourceOf(p.snap).name, endpoint: p.snap.baseUrl })), ai.chatId,
      id => { switchChat(ai, id); this.save(); changed(); },
      () => new ModelDialog(this.plugin, 'chat', changed).open(),
      id => { void (async () => {
        const removed = ai.chats.find(p => p.id === id), previous = structuredClone(ai); removeChat(ai, id);
        try { await this.plugin.saveSettings(); }
        catch (e) { Object.assign(ai, previous); this.plugin.report(e); return; }
        changed();
        if (removed?.snap.preset === 'chatgpt' && !ai.chats.some(p => p.snap.apiKey === removed.snap.apiKey)) {
          try { const revoked = await signOutAccount(removed.snap.apiKey, this.app.secretStorage); if (!revoked) new Notice(zh ? '已退出本机账号，请在 ChatGPT 设置中断开应用。' : 'Signed out locally. Disconnect this app in ChatGPT settings.'); }
          catch (e) { this.plugin.report(e); }
        }
      })(); },
      id => { const p = ai.chats.find(p => p.id === id); if (p) new ModelDialog(this.plugin, 'chat', changed, p).open(); });
    const images = section(body, zh ? '生图模型' : 'Image models', zh ? '用于顶部“AI 生图”和图片修改。添加模型不会自动生成图片。' : 'For AI images and image edits. Adding a model does not generate an image.');
    this.modelList(images, ai.images.map(p => { const snap = imageConnection(ai, p.snap); return { id: p.id, label: imageLabel(snap), provider: imageSourceOf(snap).name, endpoint: snap.imageBaseUrl }; }), ai.imageId,
      id => { switchImage(ai, id); this.save(); changed(); },
      () => new ModelDialog(this.plugin, 'image', changed).open(),
      id => { removeImage(ai, id); this.save(); changed(); },
      id => { const p = ai.images.find(p => p.id === id); if (p) new ModelDialog(this.plugin, 'image', changed, p).open(); });
    const foot = body.createDiv('qcs-foot');
    const privacy = more(foot, t('aiS_privacyTitle'));
    privacy.createDiv({ text: zh ? 'API 密钥与模型配置保存在此库的插件设置中；同步或备份插件设置时也可能一并复制。ChatGPT 直接登录凭据存于 系统密钥库，插件设置只保存引用；Codex CLI 的登录由 Codex 管理。云服务按各自规则计费，账号登录不代表免费。' : 'API keys and model settings are stored in this vault’s plugin data and may be copied by sync or backups. Codex manages ChatGPT credentials. Account sign-in does not imply free usage.', cls: 'qcs-note' });
    const dev = more(foot, t('assistantApi'));
    dev.createDiv({ text: t('assistantApiDesc'), cls: 'qcs-note' });
    for (const p of this.plugin.assistantList()) new Row(dev, p.name, p.id === 'offline' ? t('assistantOfflineDesc') : p.id === 'ai' ? (zh ? '内置，使用上面的设置。' : 'Built in, uses the settings above.') : t('assistantExternalDesc'));
  }

  private modelList(parent: HTMLElement, items: { id: string; label: string; provider: string; endpoint: string }[], active: string, pick: (id: string) => void, add: () => void, remove: (id: string) => void, edit: (id: string) => void): void {
    const zh = this.plugin.isZh(); const toolbar = parent.createDiv('qcs-model-toolbar');
    const search = toolbar.createEl('input', { type: 'search', attr: { placeholder: zh ? '搜索服务或模型' : 'Search services or models', 'aria-label': zh ? '搜索模型' : 'Search models' } });
    search.hidden = items.length === 0;
    textButton(toolbar, zh ? '添加模型' : 'Add models', add, 'qc-btn-sm', 'plus');
    const list = parent.createDiv('qcs-model-list');
    const draw = (): void => {
      list.empty(); const q = search.value.trim().toLowerCase();
      const filtered = items.filter(p => `${p.provider} ${p.label}`.toLowerCase().includes(q));
      if (!filtered.length) { list.createDiv({ text: items.length ? (zh ? '没有匹配的模型，试试其他关键词。' : 'No match. Try another search.') : (zh ? '还没有模型，点击“添加模型”选择服务。' : 'No models yet. Choose a service with Add models.'), cls: 'qcs-model-empty' }); return; }
      for (const key of new Set(filtered.map(p => `${p.provider}|${p.endpoint}`))) {
        const group = filtered.filter(p => `${p.provider}|${p.endpoint}` === key); const first = group[0]!;
        const head = list.createDiv({ text: first.provider, cls: 'qcs-model-provider' });
        try { if (first.endpoint) head.createSpan({ text: new URL(first.endpoint).host, cls: 'qc-hint' }); } catch { /* Unconfigured legacy endpoint. */ }
        for (const p of group) {
          const row = list.createDiv('qcs-model-row');
          const choice = row.createEl('button', { cls: 'qcs-model-choice', attr: { type: 'button', 'aria-pressed': String(p.id === active) } });
          setIcon(choice.createSpan({ cls: 'qcs-model-mark', attr: { 'aria-hidden': 'true' } }), p.id === active ? 'circle-check' : 'circle');
          choice.createSpan({ text: p.label, cls: 'qcs-model-name' });
          if (p.id === active) choice.createSpan({ text: zh ? '默认' : 'Default', cls: 'qc-hint' });
          choice.addEventListener('click', () => pick(p.id));
          textButton(row, zh ? '编辑' : 'Edit', () => edit(p.id), 'qc-btn-sm qc-ghost');
          textButton(row, zh ? '移除' : 'Remove', () => remove(p.id), 'qc-btn-sm qc-ghost');
        }
      }
    };
    search.addEventListener('input', draw); draw();
  }

  private runTest(bar: HTMLElement): void {
    const t = this.t; this.testLine = { tone: 'warn', text: t('aiTesting') }; bar.querySelector('.qcs-status-test')?.remove();
    const line = bar.createDiv({ text: t('aiTesting'), cls: 'qcs-status-test is-warn' });
    void this.plugin.ai.ping().then(reply => { this.testLine = { tone: 'ok', text: t('aiTestOk', { reply }) }; if (this.plugin.settings.assistant !== 'ai') { this.plugin.settings.assistant = 'ai'; this.save(); } })
      .catch((e: unknown) => { this.testLine = { tone: 'warn', text: t('aiTestFail', { message: this.friendly(e) }) }; })
      .finally(() => { if (line.isConnected) { line.setText(this.testLine!.text); line.className = `qcs-status-test is-${this.testLine!.tone}`; } });
  }
  /** Turns the usual failures into a sentence that says what to do next. */
  private friendly(e: unknown): string {
    const m = e instanceof Error ? e.message : String(e); const t = this.t;
    if (/codex-missing/.test(m)) return t('aiE_codex');
    if (/401|403|invalid api key|unauthorized|incorrect api key/i.test(m)) return t('aiE_key');
    if (/404/.test(m)) return t('aiE_base');
    if (/429|rate|quota/i.test(m)) return t('aiE_quota');
    if (/ENOTFOUND|ECONN|network|failed to fetch|timed out/i.test(m)) return t('aiE_net');
    return m;
  }

  /* ---------- about ---------- */
  private about(body: HTMLElement): void {
    const t = this.t; const zh = this.plugin.isZh(); const repo = 'https://github.com/joeseesun/qiaomu-cover-design';
    const link = (parent: HTMLElement, label: string, href: string, icon?: string): HTMLAnchorElement => {
      const a = parent.createEl('a', { href, cls: icon ? 'qcs-about-action' : 'qcs-about-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
      if (icon) setIcon(a.createSpan({ attr: { 'aria-hidden': 'true' } }), icon); a.createSpan({ text: label }); return a;
    };
    const hero = body.createDiv('qcs-about-hero'); const rel = hero.createDiv('qcs-about-release');
    rel.createSpan({ text: zh ? '当前版本' : 'Version', cls: 'qcs-about-label' }); rel.createSpan({ text: `${this.plugin.manifest.name}  v${this.plugin.manifest.version}`, cls: 'qcs-about-version' });
    const actions = hero.createDiv('qcs-about-actions');
    this.plugin.updateNotes.addButton(actions); link(actions, zh ? '反馈问题' : 'Report a bug', `${repo}/issues/new`, 'bug'); link(actions, zh ? '使用说明' : 'Readme', `${repo}#readme`, 'book-open');
    const help = section(body, t('s_help'));
    new Row(help, t('shortcuts')).addButton(b => b.setButtonText(zh ? '查看' : 'View').onClick(() => new ShortcutsModal(this.plugin).open()));
    const support = body.createDiv('qcs-about-support');
    const qr = (icon: string, title: string, hint: string, src: string, alt: string): void => {
      const fig = support.createEl('figure', { cls: 'qcs-about-qr' }); const frame = fig.createDiv('qcs-about-qr-image');
      const img = frame.createEl('img', { attr: { src, alt, loading: 'lazy', width: '148', height: '148' } }); img.addEventListener('error', () => { frame.empty(); frame.createDiv({ text: zh ? '二维码暂时加载不出来，可访问 qiaomu.ai' : 'QR unavailable offline. Visit qiaomu.ai', cls: 'qcs-about-qr-fallback' }); });
      const cap = fig.createEl('figcaption'); const ttl = cap.createDiv('qcs-about-qr-title'); setIcon(ttl.createSpan({ attr: { 'aria-hidden': 'true' } }), icon); ttl.createSpan({ text: title }); cap.createDiv({ text: hint, cls: 'qcs-about-qr-hint' });
    };
    qr('newspaper', zh ? '关注公众号' : 'Follow on WeChat', zh ? '微信搜索「向阳乔木推荐看」' : 'Search 「向阳乔木推荐看」 in WeChat', 'https://radio.qiaomu.ai/assets/qiaomu_wechat_public_account_qr.jpg', zh ? '向阳乔木推荐看公众号二维码' : 'WeChat official account QR');
    qr('coffee', zh ? '请我喝杯咖啡' : 'Buy me a coffee', zh ? '微信扫码，支持持续更新' : 'Scan with WeChat to support updates', 'https://radio.qiaomu.ai/assets/qiaomu_reward_qr.png', zh ? '向阳乔木打赏二维码' : 'Reward QR');
    const foot = body.createDiv('qcs-about-footer'); const links = foot.createDiv('qcs-about-links');
    for (const [name, href] of [['qiaomu.ai', 'https://qiaomu.ai/'], [zh ? '博客' : 'Blog', 'https://blog.qiaomu.ai/'], ['X', 'https://x.com/vista8'], ['GitHub', 'https://github.com/joeseesun'], [zh ? '邮箱' : 'Email', 'mailto:vista8@gmail.com']] as const) link(links, name, href);
    foot.createEl('p', { text: t('privacyDesc'), cls: 'qcs-note' });
  }
}
