import { signInAccount, readAccount, signOutAccount } from './model-access/services/provider-auth';
import { discoverModels } from './model-access/client';
import { detectMagpie, magpieAddress } from './model-access/services/magpie';
import { permitsEmptyKey } from './model-access/services/api-providers';
/** Service → connection → model selection. Drafts stay local until Save succeeds. */
import { Modal, Platform, requestUrl, setIcon } from '../harness-ui';
import { jimengModels } from './jimeng';
import type CoverPlugin from '../native-controller';
import { ChatSnap, ImageSnap, saveChat, saveImage, syncProfiles, imageConnection, sameChatModel, sameImageModel, switchChat, switchImage } from './aiparse';
import { CHAT_SOURCES, ChatSource, GROUPS, IMAGE_SOURCES, ImageSource, chatSnapFrom, chatSourceOf, imageSnapFrom, imageSourceOf, PopularModel } from './catalog';
import { codexAccount, codexModels, startCodexLogin } from './codex';
import { LoginHandle } from './authflow';
import { textButton } from './ui';

type Source = ChatSource | ImageSource;
export type Kind = 'chat' | 'image';
export interface Editing { id: string; snap: ChatSnap | ImageSnap }
interface Draft { key: string; base: string; bin: string; models: Set<string>; all: PopularModel[]; loaded: boolean; note: string; alias: string; account?: string; effort?: string }

export class ModelDialog extends Modal {
  private source?: Source; private step: 'connection' | 'models' = 'connection';
  private drafts = new Map<string, Draft>(); private generation = 0; private alive = false; private saving = false;
  private login?: LoginHandle<unknown>; private accountLogin?: AbortController; private requests = new AbortController();
  constructor(private plugin: CoverPlugin, private kind: Kind, private done: () => void, private editing?: Editing) { super(plugin.app); }
  private get z(): boolean { return this.plugin.isZh(); }
  private sources(): Source[] { return (this.kind === 'chat' ? CHAT_SOURCES : IMAGE_SOURCES).filter(s => Platform.isDesktopApp || s.id !== 'chatgpt'); }
  onOpen(): void {
    this.plugin.modelAccessDialogs.add(this); this.alive = true; this.modalEl.addClass('qc-modal-wide'); this.contentEl.addClass('qc-modal', 'qc-model-dialog');
    if (this.editing) this.source = this.kind === 'chat' ? chatSourceOf(this.editing.snap as ChatSnap) : imageSourceOf(imageConnection(this.plugin.settings.ai, this.editing.snap as ImageSnap));
    this.draw();
  }
  onClose(): void { this.plugin.modelAccessDialogs.delete(this); this.requests.abort(); this.accountLogin?.abort(); this.alive = false; this.generation++; this.login?.cancel(); this.login = undefined; this.drafts.clear(); this.contentEl.empty(); }
  private current(generation: number): boolean { return this.alive && this.generation === generation; }
  private draw(): void {
    this.accountLogin?.abort(); this.requests.abort(); this.requests = new AbortController(); this.generation++; this.contentEl.empty();
    this.titleEl.setText(this.editing ? (this.z ? '编辑模型' : 'Edit model') : this.kind === 'chat' ? (this.z ? '添加排版模型' : 'Add layout models') : (this.z ? '添加生图模型' : 'Add image models'));
    const steps = this.contentEl.createDiv('qc-md-steps');
    const index = !this.source ? 0 : this.step === 'connection' ? 1 : 2;
    this.contentEl.toggleClass('qc-md-model-step', index === 2);
    (this.z ? ['选择服务', '连接账号', '选择模型'] : ['Service', 'Connect', 'Models']).forEach((text, i) => steps.createSpan({ text: `${i + 1}  ${text}`, cls: i === index ? 'is-current' : '' }));
    if (!this.source) this.gallery(); else if (this.step === 'connection') this.connection(this.source); else this.models(this.source);
  }
  private draft(s: Source): Draft {
    let d = this.drafts.get(s.id); if (d) return d;
    let snap = this.editing?.snap;
    const ai = this.plugin.settings.ai;
    // Reuse an already configured connection only for its exact service and endpoint.
    if (!snap) snap = this.kind === 'chat'
      ? ai.chats.find(p => p.snap.preset === s.id && p.snap.baseUrl === s.baseUrl)?.snap
      : ai.images.find(p => imageSourceOf(p.snap).id === s.id && p.snap.imageBaseUrl === s.baseUrl)?.snap;
    let key = ''; let base = s.baseUrl; let model = ''; let bin = ai.codexBin;
    if (snap) {
      if ('protocol' in snap) { key = snap.apiKey; base = snap.baseUrl || s.baseUrl; model = snap.protocol === 'codex' ? snap.codexModel : snap.model; bin = snap.codexBin; }
      else { const resolved = imageConnection(ai, snap); key = resolved.imageKey; base = resolved.imageBaseUrl || s.baseUrl; model = snap.imageModel; }
    }
    // Layout and image services can share a connection, while keeping their models independent.
    if (!key && !this.editing && s.id !== 'custom' && s.id !== 'chatgpt') {
      const match = ai.chats.find(p => p.snap.baseUrl === s.baseUrl && p.snap.apiKey);
      const image = ai.images.find(p => p.snap.imageBaseUrl === s.baseUrl && p.snap.imageKey);
      key = match?.snap.apiKey ?? image?.snap.imageKey ?? '';
    }
    d = { effort: snap && 'protocol' in snap ? snap.chatEffort : undefined, key, base, bin, models: new Set(this.editing ? [model] : []), all: snap && 'protocol' in snap && model ? [...s.models, { id: model, efforts: snap.chatEfforts }] : [...s.models], loaded: false, note: '', alias: this.editing ? ('protocol' in this.editing.snap ? this.editing.snap.chatAlias : this.editing.snap.imageAlias) ?? '' : '' };
    if (s.id === 'chatgpt') { d.key ||= `qiaomu-cover-design-chatgpt-${crypto.randomUUID()}`; d.account = this.app.secretStorage.getSecret(d.key) ?? ''; }
    this.drafts.set(s.id, d); return d;
  }
  private brand(parent: HTMLElement, s: Source): void {
    const icon = parent.createSpan({ cls: 'qc-md-service-icon', attr: { 'aria-hidden': 'true' } });
    setIcon(icon, s.id === 'codex' ? 'terminal' : s.id === 'custom' ? 'plus' : s.group === 'local' ? 'server' : s.login ? 'log-in' : 'key-round');
    const text = parent.createDiv('qc-md-card-text'); text.createDiv({ text: s.name, cls: 'qc-md-card-name' });
    text.createDiv({ text: s.login ? (this.z ? '支持账号登录' : 'Account sign-in') : s.keyless ? (this.z ? '无需密钥' : 'No key required') : s.baseUrl ? new URL(s.baseUrl).host : (this.z ? 'OpenAI 兼容服务' : 'OpenAI-compatible service'), cls: 'qc-md-card-sub' });
  }
  private gallery(): void {
    const el = this.contentEl; el.createDiv({ text: this.z ? '选择你已有账号的服务。支持登录的服务无需手动复制密钥。' : 'Choose a service you use. Supported sign-ins connect without copying a key.', cls: 'qc-hint' });
    const search = el.createEl('input', { type: 'search', cls: 'qc-md-search', attr: { placeholder: this.z ? '搜索服务…' : 'Search services…', 'aria-label': this.z ? '搜索服务' : 'Search services' } });
    const grid = el.createDiv('qc-md-gallery');
    const render = (): void => {
      grid.empty(); const q = search.value.trim().toLowerCase(); let count = 0;
      for (const group of GROUPS) {
        const sources = this.sources().filter(s => s.group === group.id && `${s.name} ${s.sub} ${s.id}`.toLowerCase().includes(q)); if (!sources.length) continue; count += sources.length;
        grid.createDiv({ text: this.z ? group.zh : group.en, cls: 'qc-md-group' }); const cards = grid.createDiv('qc-md-cards');
        for (const s of sources) {
          const card = cards.createEl('button', { cls: 'qc-md-card', attr: { type: 'button' } }); this.brand(card, s);
          card.addEventListener('click', () => { this.source = s; this.step = 'connection'; this.draw(); });
        }
      }
      if (!count) grid.createDiv({ text: this.z ? '没有匹配的服务。清空搜索后可选择“自定义”。' : 'No match. Clear search to choose Custom.', cls: 'qc-md-empty' });
    };
    search.addEventListener('input', render); render();
    textButton(el.createDiv('qc-md-actions'), this.z ? '取消' : 'Cancel', () => this.close());
  }
  private field(parent: HTMLElement, label: string, value: string, change: (v: string) => void, password = false): HTMLInputElement {
    const row = parent.createDiv('qc-md-field'); const id = `qc-model-${this.kind}-${this.generation}-${parent.querySelectorAll('input').length}-${Math.random().toString(36).slice(2)}`;
    row.createEl('label', { text: label, attr: { for: id } });
    const wrap = row.createDiv('qc-md-wrap'); const input = wrap.createEl('input', { type: password ? 'password' : 'text', attr: { id, autocomplete: 'off', spellcheck: 'false' } }); input.value = value;
    input.addEventListener('input', () => change(input.value));
    if (password) textButton(wrap, this.z ? '显示' : 'Show', () => { input.type = input.type === 'password' ? 'text' : 'password'; reveal.setText(input.type === 'password' ? (this.z ? '显示' : 'Show') : (this.z ? '隐藏' : 'Hide')); }, 'qc-md-reveal');
    const reveal = wrap.querySelector('button')!;
    return input;
  }
  private connection(s: Source): void {
    const el = this.contentEl; const z = this.z; const d = this.draft(s); const generation = this.generation; const codex = s.id === 'codex';
    this.brand(el.createDiv('qc-md-head'), s);
    const note = codex ? (z ? '使用 ChatGPT 账号里的 Codex，排版与生图都可使用。需要本机安装 Codex CLI；登录和续期由 Codex 管理。' : 'Use Codex through your ChatGPT account for layouts and images. Install Codex CLI locally; it manages sign-in and renewal.') : s.login ? (z ? '在浏览器中登录并授权，完成后自动回到这里。也可以填写已有 API Key。账号登录不代表免费，费用由服务商收取。' : 'Sign in and authorize in your browser, or enter an API key. Your provider’s usage charges still apply.') : (z ? '填写这个服务的 API Key，然后选择模型。' : 'Enter your service API key, then choose models.');
    el.createDiv({ text: s.id === 'chatgpt' ? (z ? '使用 ChatGPT 授权的文字模型；生图继续使用单独的生图配置。' : 'Use authorized ChatGPT text models. Image models remain separate.') : s.id === 'magpie' ? (z ? '在 Magpie 中登录 Claude 等订阅并启用模型，然后在这里获取列表。' : 'Sign in to subscriptions such as Claude in Magpie, enable models, then load them here.') : note, cls: 'qc-md-note' });
    const status = el.createDiv({ cls: 'qc-md-status', attr: { role: 'status', 'aria-live': 'polite' } });
    let keyInput: HTMLInputElement | undefined;
    let authButton: HTMLButtonElement | undefined; let cancelButton: HTMLButtonElement | undefined;
    if (s.login) {
      const row = el.createDiv('qc-md-login-actions');
      authButton = textButton(row, codex ? (z ? '登录 ChatGPT / Codex' : 'Sign in to ChatGPT / Codex') : `${z ? '登录' : 'Sign in to'} ${s.name}`, () => void login(), 'qc-primary', 'log-in');
      cancelButton = textButton(row, z ? '取消登录' : 'Cancel sign-in', () => { this.accountLogin?.abort(); this.login?.cancel(); this.login = undefined; }, 'qc-ghost'); cancelButton.hidden = true;
    }
    if (codex) {
      const a = el.createEl('a', { text: z ? '安装 Codex CLI' : 'Install Codex CLI', href: 'https://developers.openai.com/codex/cli', cls: 'qc-md-link', attr: { target: '_blank', rel: 'noopener noreferrer' } }); a.addClass('qc-md-install');
      status.setText(z ? '正在检查本机登录…' : 'Checking local sign-in…');
      void codexAccount(d.bin).then(account => { if (this.current(generation)) status.setText(account.signedIn ? `${z ? '已登录' : 'Signed in'} · ${account.label}` : (z ? '尚未登录，点击上方按钮连接。' : 'Not signed in. Use the button above.')); }).catch(() => { if (this.current(generation)) status.setText(z ? '没有检测到可用的 Codex CLI。请安装后重试，或在高级设置中指定路径。' : 'Codex CLI unavailable. Install it or specify its path under Advanced.'); });
    } else if (s.id === 'chatgpt') {
      status.setText(readAccount(d.account ?? '')?.access ? (z ? '账号已连接' : 'Account connected') : (z ? '请先登录' : 'Sign in first'));
      if (d.account) textButton(el, z ? '退出账号' : 'Sign out', () => { void signOutAccount(d.key, this.app.secretStorage).then(ok => { d.account = ''; d.loaded = false; if (this.current(generation)) status.setText(ok ? (z ? '已退出账号' : 'Signed out') : (z ? '已退出本机账号，请在 ChatGPT 设置中断开应用。' : 'Signed out locally. Disconnect the app in ChatGPT settings.')); }).catch(() => { if (this.current(generation)) status.setText(z ? '退出失败，请重试。' : 'Sign out failed. Retry.'); }); });
    } else if (!s.keyless || s.id === 'magpie') {
      keyInput = this.field(el, s.login ? (z ? '或填写 API Key' : 'Or enter an API key') : 'API Key', d.key, value => { d.key = value.trim(); d.loaded = false; }, true);
      if (d.key) status.setText(z ? '已填入此服务的已有密钥，可直接下一步。' : 'Existing connection filled in. Continue to models.');
      if (s.keyUrl) el.createEl('a', { text: z ? '获取 API Key' : 'Get an API key', href: s.keyUrl, cls: 'qc-md-link', attr: { target: '_blank', rel: 'noopener noreferrer' } });
    }
    const adv = el.createEl('details', { cls: 'qc-md-adv' }); adv.createEl('summary', { text: z ? '高级设置' : 'Advanced' }); if (s.id === 'chatgpt') adv.hidden = true;
    if (s.id === 'custom' || s.group === 'local') adv.open = true;
    let baseInput: HTMLInputElement | undefined;
    if (codex) this.field(adv, z ? 'Codex 可执行文件路径（可选）' : 'Codex executable path (optional)', d.bin, v => { d.bin = v.trim(); d.loaded = false; }).placeholder = '~/.local/bin/codex';
    else if (s.id !== 'chatgpt') {
      baseInput = this.field(adv, z ? '接口地址' : 'Base URL', d.base, v => { d.base = v.trim(); d.loaded = false; }); baseInput.placeholder = 'https://…/v1';
      adv.createDiv({ text: z ? '官方服务保持默认地址；自建代理填自己的地址。' : 'Keep the default for official services; change only for your own relay.', cls: 'qc-hint' });
    }
    if (s.id === 'magpie') {
      el.createEl('a', { text: z ? 'Magpie 安装与登录指南' : 'Magpie setup guide', href: 'https://usemagpie.ai/docs/start', attr: { target: '_blank', rel: 'noopener noreferrer' } });
      textButton(el, z ? '检测 Magpie' : 'Detect Magpie', () => { void (async () => {
        try { if (d.base === s.baseUrl) { d.base = await magpieAddress(); if (baseInput) baseInput.value = d.base; }
          const version = await detectMagpie(d.base, d.key, this.requests.signal); if (this.current(generation)) status.setText(`${z ? '已检测到 Magpie' : 'Magpie detected'} ${version}`);
        } catch (e) { if (this.current(generation)) status.setText(e instanceof Error ? e.message : String(e)); }
      })(); });
    }
    const actions = el.createDiv('qc-md-actions');
    if (!this.editing) textButton(actions, z ? '返回' : 'Back', () => { this.login?.cancel(); this.login = undefined; this.source = undefined; this.draw(); }, 'qc-ghost');
    textButton(actions, z ? '取消' : 'Cancel', () => this.close());
    const next = textButton(actions, z ? '下一步：选择模型' : 'Next: choose models', () => void proceed(), 'qc-primary');
    const login = async (): Promise<void> => {
      if (!s.login || !authButton) return;
      if (!Platform.isDesktopApp) { status.setText(z ? '账号登录需要桌面版。' : 'Sign-in requires desktop.'); return; }
      if (s.login !== 'codex') {
        const controller = new AbortController(); this.accountLogin = controller; authButton.disabled = true; next.disabled = true; if (cancelButton) cancelButton.hidden = false;
        try { const result = await signInAccount(s.login, this.app.secretStorage, url => { window.open(url); }, controller.signal, s.id === 'chatgpt' ? readAccount(d.account ?? '') ?? undefined : undefined);
          if (!this.current(generation) || controller.signal.aborted) return; if (s.id === 'chatgpt') d.account = result.secret; else { d.key = result.secret; d.base = s.baseUrl; if (keyInput) keyInput.value = d.key; if (baseInput) baseInput.value = d.base; } d.loaded = false; status.setText(z ? '已登录，现在可以选择模型。' : 'Signed in. Choose models next.');
        } catch (e) { if (this.current(generation)) status.setText(controller.signal.aborted ? (z ? '已取消登录' : 'Sign-in cancelled') : e instanceof Error ? e.message : String(e)); }
        finally { if (this.current(generation)) { this.accountLogin = undefined; authButton.disabled = false; next.disabled = false; if (cancelButton) cancelButton.hidden = true; } }
        return;
      }
      authButton.disabled = true; next.disabled = true; status.removeClass('is-error'); status.setText(z ? '正在准备登录…' : 'Preparing sign-in…');
      try {
        const handle = await startCodexLogin(d.bin);
        if (!this.current(generation)) { handle.cancel(); return; }
        this.login = handle; if (cancelButton) cancelButton.hidden = false;
        status.setText(z ? '请在浏览器完成登录和授权，完成后返回此窗口。' : 'Complete sign-in and authorization in your browser, then return here.');
        window.open(handle.url, '_blank', 'noopener,noreferrer');
        await handle.result;
        if (!this.current(generation)) return;
        status.setText(z ? '已登录，现在可以选择模型。' : 'Signed in. You can now choose models.');
      } catch (error) {
        this.login?.cancel();
        if (this.current(generation)) { const code = error instanceof Error ? error.message : ''; status.setText(code === 'login-cancelled' ? (z ? '已取消登录，可重新登录或填写密钥。' : 'Sign-in cancelled. Try again or enter a key.') : code === 'login-timeout' ? (z ? '登录超时，请重试。' : 'Sign-in timed out. Please retry.') : (z ? '登录未完成，请重试。Codex 用户请确认已安装 CLI；其他服务也可填写 API Key。' : 'Sign-in did not complete. Retry; for Codex check CLI installation, or use an API key for other services.')); status.addClass('is-error'); }
      } finally { if (this.current(generation)) { this.login = undefined; authButton.disabled = false; next.disabled = false; if (cancelButton) cancelButton.hidden = true; } }
    };
    const proceed = async (): Promise<void> => {
      if (this.login || this.accountLogin) return;
      if (s.id === 'chatgpt' && !readAccount(d.account ?? '')?.access) { status.setText(z ? '请先登录' : 'Sign in first'); return; }
      if (s.id === 'magpie' && !d.key && !permitsEmptyKey({ provider: 'magpie', baseUrl: d.base, model: '', secretId: '' })) { status.setText(z ? '远程 Magpie 需要网关密钥。' : 'Remote Magpie requires a gateway key.'); return; }
      if (!codex && !this.validBase(d.base)) { status.setText(z ? '请填写 HTTPS 接口地址；本机服务可用 HTTP。' : 'Use an HTTPS base URL, or HTTP for localhost.'); status.addClass('is-error'); adv.open = true; return; }
      if (!codex && !s.keyless && !d.key) { status.setText(z ? '请先登录或填写 API Key。' : 'Sign in or enter an API key first.'); status.addClass('is-error'); keyInput?.focus(); return; }
      next.disabled = true;
      if (codex) {
        try { const account = await codexAccount(d.bin); if (!account.signedIn) throw new Error('not-signed-in'); }
        catch { if (this.current(generation)) { status.setText(z ? '请先安装并登录 Codex，再选择模型。' : 'Install and sign in to Codex before selecting models.'); status.addClass('is-error'); next.disabled = false; } return; }
      }
      if (!this.current(generation)) return;
      this.step = 'models'; this.draw();
    };
  }
  private validBase(base: string): boolean {
    try { const u = new URL(base); return !u.username && !u.password && !u.search && !u.hash && (u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))); } catch { return false; }
  }
  private models(s: Source): void {
    const el = this.contentEl.createDiv('qc-md-selection-body'); const d = this.draft(s); const z = this.z; const generation = this.generation;
    const t = this.plugin.t.bind(this.plugin);
    const chatSnap = (model: string): ChatSnap => ({ ...chatSnapFrom(s as ChatSource, { key: d.key, baseUrl: s.id === 'codex' ? '' : d.base, model, codexBin: d.bin }), chatEfforts: d.all.find(m => m.id === model)?.efforts, chatEffort: d.all.find(m => m.id === model)?.efforts?.includes(d.effort ?? '') ? d.effort : undefined });
    const imageSnap = (model: string): ImageSnap => imageSnapFrom(s as ImageSource, { key: d.key, baseUrl: s.id === 'codex' ? '' : d.base, model });
    const added = (model: string): boolean => {
      if (this.editing) return false;
      const ai = this.plugin.settings.ai;
      return this.kind === 'chat' ? ai.chats.some(p => sameChatModel(p.snap, chatSnap(model))) : ai.images.some(p => sameImageModel(ai, p.snap, imageSnap(model)));
    };
    const remaining = (): number => 100 - (this.kind === 'chat' ? this.plugin.settings.ai.chats.length : this.plugin.settings.ai.images.length);
    this.brand(el.createDiv('qc-md-head'), s);
    el.createDiv({ text: this.editing ? (z ? '选择一个模型，保存后替换当前配置。' : 'Choose one model to replace this configuration.') : t('modelMultiHint'), cls: 'qc-hint' });
    const tools = el.createDiv('qc-md-model-tools');
    const search = tools.createEl('input', { type: 'search', attr: { placeholder: z ? '搜索模型名称或 ID' : 'Search model name or ID', 'aria-label': z ? '搜索模型' : 'Search models' } });
    const refresh = textButton(tools, z ? '刷新列表' : 'Refresh', () => void load(), 'qc-btn-sm', 'refresh-cw');
    const status = el.createDiv({ cls: 'qc-md-status', attr: { role: 'status', 'aria-live': 'polite' } });
    let selectAll: HTMLInputElement | undefined;
    if (!this.editing) {
      const bulk = el.createDiv('qc-md-bulk');
      const label = bulk.createEl('label', { cls: 'qc-md-select-all' }); selectAll = label.createEl('input', { type: 'checkbox' });
      label.createSpan({ text: t('modelSelectResults') });
      selectAll.addEventListener('change', () => {
        const ids = matching().filter(m => !added(m.id)).map(m => m.id);
        const next = new Set(d.models); for (const id of ids) { if (selectAll!.checked) next.add(id); else next.delete(id); }
        if (next.size > remaining()) error.setText(t('modelSelectionLimit', { count: Math.max(0, remaining()) }));
        else { d.models = next; error.empty(); }
        updateSelection();
      });
    }
    const list = el.createDiv('qc-md-models qc-md-select-models');
    let visibleLimit = 150; let loading = false;
    const more = textButton(el, '', () => { visibleLimit += 150; const top = list.scrollTop; render(); list.scrollTop = top; }, 'qc-md-more qc-ghost');
    const manual = el.createEl('details', { cls: 'qc-md-adv' }); manual.createEl('summary', { text: z ? '手动填写模型 ID' : 'Enter a model ID manually' });
    const manualInput = this.field(manual, z ? '模型 ID' : 'Model ID', '', () => undefined);
    textButton(manual, z ? '加入选择' : 'Select model', () => {
      const id = manualInput.value.trim(); if (!id) return;
      if (added(id)) { error.setText(t('modelAlreadyAdded')); return; }
      if (!this.editing && !d.models.has(id) && d.models.size >= remaining()) { error.setText(t('modelSelectionLimit', { count: Math.max(0, remaining()) })); return; }
      if (!d.all.some(m => m.id === id)) d.all.push({ id }); if (this.editing) d.models.clear();
      d.models.add(id); manualInput.value = ''; error.empty(); render();
    }, 'qc-btn-sm');
    if (this.editing) this.field(el, z ? '显示名称（可选）' : 'Display name (optional)', d.alias, v => { d.alias = v.trim().slice(0, 80); });
    const error = this.contentEl.createDiv({ cls: 'qc-md-status is-error', attr: { role: 'alert' } });
    const actions = this.contentEl.createDiv('qc-md-actions qc-md-selection-footer');
    const summary = !this.editing ? actions.createDiv({ cls: 'qc-md-selection-summary', attr: { role: 'status', 'aria-live': 'polite' } }) : undefined;
    const count = summary?.createDiv(); const hidden = summary?.createDiv('qc-hint');
    const clear = !this.editing ? textButton(actions, t('modelClearSelection'), () => { d.models.clear(); error.empty(); updateSelection(); }, 'qc-ghost') : undefined;
    const back = textButton(actions, z ? '返回' : 'Back', () => { this.step = 'connection'; this.draw(); }, 'qc-ghost');
    const cancel = textButton(actions, z ? '取消' : 'Cancel', () => this.close());
    const save = textButton(actions, z ? '添加模型' : 'Add models', () => void persist(), 'qc-primary');
    const effortLabel = el.createEl('label', { text: z ? '思考深度' : 'Reasoning effort' }); const effortSelect = effortLabel.createEl('select'); effortSelect.addEventListener('change', () => { d.effort = effortSelect.value || undefined; });
    let controls: { id: string; check: HTMLInputElement; exists: boolean }[] = [];
    const matching = (): PopularModel[] => {
      const all = new Map(d.all.map(m => [m.id, m]));
      if (s.id === 'codex') all.set('', { id: '', name: z ? '使用 Codex 默认模型' : 'Use Codex default' });
      for (const id of d.models) if (!all.has(id)) all.set(id, { id });
      const q = search.value.trim().toLowerCase(); return [...all.values()].filter(m => `${m.name ?? ''} ${m.id}`.toLowerCase().includes(q));
    };
    const updateSelection = (): void => {
      for (const item of controls) { item.check.checked = item.exists || d.models.has(item.id); item.check.disabled = item.exists || this.saving; }
      search.disabled = this.saving; more.disabled = this.saving; refresh.disabled = loading || this.saving;
      manual.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(control => { control.disabled = this.saving; });
      const levels = d.models.size === 1 ? d.all.find(m => m.id === [...d.models][0])?.efforts ?? [] : [];
      effortLabel.hidden = !levels.length; effortSelect.disabled = this.saving; effortSelect.empty(); effortSelect.createEl('option', { text: z ? '模型默认值' : 'Model default', value: '' }); for (const level of levels) effortSelect.createEl('option', { text: level, value: level }); effortSelect.value = d.effort ?? '';
      const matches = matching(), eligible = matches.filter(m => !added(m.id));
      if (selectAll) {
        const selected = eligible.filter(m => d.models.has(m.id)).length;
        selectAll.checked = eligible.length > 0 && selected === eligible.length;
        selectAll.indeterminate = selected > 0 && selected < eligible.length;
        selectAll.disabled = !eligible.length || this.saving;
      }
      count?.setText(t('modelSelectedCount', { count: d.models.size }));
      const hiddenCount = [...d.models].filter(id => !matches.some(m => m.id === id)).length;
      hidden?.setText(hiddenCount ? t('modelHiddenSelection', { count: hiddenCount }) : '');
      if (clear) clear.disabled = !d.models.size || this.saving;
      save.disabled = !d.models.size || this.saving;
      save.setText(this.editing ? (z ? '保存' : 'Save') : t('modelAddCount', { count: d.models.size }));
    };
    const render = (): void => {
      list.empty(); controls = [];
      for (const id of d.models) if (added(id)) d.models.delete(id);
      const matches = matching(), visible = matches.slice(0, visibleLimit);
      for (const m of visible) {
        const exists = added(m.id);
        const row = list.createEl('label', { cls: `qc-md-model-option${exists ? ' is-added' : ''}` }); const check = row.createEl('input', { type: this.editing ? 'radio' : 'checkbox' });
        check.name = `qc-model-selection-${generation}`; check.disabled = exists;
        const text = row.createDiv(); text.createDiv({ text: m.name || m.id }); if (m.name && m.id) text.createDiv({ text: m.id, cls: 'qc-hint' });
        if (exists) row.createSpan({ text: t('modelAdded'), cls: 'qc-md-added' });
        controls.push({ id: m.id, check, exists });
        check.addEventListener('change', () => {
          if (!this.editing && check.checked && d.models.size >= remaining()) error.setText(t('modelSelectionLimit', { count: Math.max(0, remaining()) }));
          else { if (this.editing) d.models.clear(); if (check.checked) d.models.add(m.id); else d.models.delete(m.id); error.empty(); }
          updateSelection();
        });
      }
      if (!visible.length) list.createDiv({ text: z ? '没有匹配项，可以手动填写模型 ID。' : 'No match. You can enter a model ID manually.', cls: 'qc-md-empty' });
      more.hidden = matches.length <= visibleLimit; more.setText(t('modelShowMore', { shown: visible.length, total: matches.length }));
      updateSelection();
    };
    search.addEventListener('input', () => { visibleLimit = 150; render(); }); render(); status.setText(d.note);
    const load = async (): Promise<void> => {
      loading = true; refresh.disabled = true; status.setText(z ? '正在获取可用模型…' : 'Loading available models…');
      try { const found = s.id === 'codex' ? await codexModels(d.bin) : await this.fetchModels(s, d.base.replace(/\/+$/, ''), d.key); if (!this.current(generation)) return;
        d.loaded = true; d.all = found.length ? found : [...s.models]; d.note = found.length ? (z ? `已获取 ${found.length} 个模型；能否调用取决于账号权限与额度。` : `${found.length} models found; access depends on your account.`) : (z ? '服务未返回列表，以下为常用模型，尚未验证可调用。也可手动填写。' : 'No list returned. These suggestions are unverified; you can enter a model ID.');
      } catch { if (!this.current(generation)) return; d.note = z ? '获取失败。请检查账号或返回修改连接；以下常用模型尚未验证，也可手动填写。' : 'Could not load models. Retry or go back to check your connection. Suggestions are unverified.'; }
      finally { if (this.current(generation)) { loading = false; status.setText(d.note); render(); } }
    };
    if (!d.loaded) void load();
    const persist = async (): Promise<void> => {
      if (this.saving || !d.models.size) return;
      const old = this.plugin.settings.ai; const previous = structuredClone(old); const next = structuredClone(old); const ids: string[] = []; syncProfiles(next);
      const selected = [...d.models].filter(model => !added(model));
      if (!selected.length) { error.setText(t('modelAlreadyAdded')); render(); return; }
      if ((this.kind === 'chat' ? next.chats.length : next.images.length) + (this.editing ? 0 : selected.length) > 100) { error.setText(t('modelSelectionLimit', { count: Math.max(0, remaining()) })); return; }
      const defaultId = this.kind === 'chat' ? next.chatId : next.imageId;
      const hasDefault = this.kind === 'chat' ? next.chats.some(p => p.id === defaultId) : next.images.some(p => p.id === defaultId);
      for (const model of selected) {
        if (this.kind === 'chat') {
          const snap = chatSnap(model); snap.chatAlias = d.alias || undefined;
          ids.push(saveChat(next, snap, this.editing?.id, false));
        } else {
          const snap = imageSnap(model); snap.imageAlias = d.alias || undefined;
          if (this.editing) { const previous = this.editing.snap as ImageSnap; snap.imageSize = previous.imageSize; snap.imageOn = previous.imageOn; if (model === previous.imageModel) snap.imageFamily = previous.imageFamily; }
          ids.push(saveImage(next, snap, this.editing?.id, false));
          if (s.id === 'codex') next.codexBin = d.bin;
        }
      }
      if (!this.editing && !hasDefault) { if (this.kind === 'chat') switchChat(next, ids[0]!); else switchImage(next, ids[0]!); }
      next.enabled = true; this.saving = true; updateSelection(); back.disabled = true; cancel.disabled = true;
      Object.assign(old, next);
      const previousSecret = s.id === 'chatgpt' ? this.app.secretStorage.getSecret(d.key) : null;
      try { if (s.id === 'chatgpt') await this.app.secretStorage.setSecret(d.key, d.account ?? ''); await this.plugin.saveSettings(); this.close(); this.done(); }
      catch { if (s.id === 'chatgpt') await this.app.secretStorage.setSecret(d.key, previousSecret ?? ''); if (this.plugin.settings.ai === old) Object.assign(old, previous); if (this.current(generation)) { error.setText(z ? '保存失败，输入已保留，请重试。' : 'Could not save. Your input is preserved; please retry.'); back.disabled = false; cancel.disabled = false; } }
      finally { this.saving = false; if (this.current(generation)) updateSelection(); }
    };
  }
  private async fetchModels(s: Source, base: string, key: string): Promise<PopularModel[]> {
    const imageOnly = this.kind === 'image';
    if (s.id === 'chatgpt' || s.id === 'magpie') {
      const d = this.draft(s), store = this.app.secretStorage;
      return discoverModels({ provider: s.id, baseUrl: base, model: '', secretId: d.key, protocol: s.id === 'chatgpt' ? 'openai-responses' : 'openai-chat' }, key,
        { getSecret: id => id === d.key && s.id === 'chatgpt' ? d.account ?? '' : store.getSecret(id), setSecret: (id, value) => { if (id === d.key && s.id === 'chatgpt') d.account = value; else store.setSecret(id, value); } }, this.requests.signal);
    }
    if (s.id === 'gemini' && imageOnly) {
      const res = await requestUrl({ url: `${base}/models?pageSize=200`, headers: { 'x-goog-api-key': key }, throw: false }); if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      return ((res.json as { models?: { name: string; displayName?: string }[] }).models ?? []).filter(m => /image/i.test(m.name)).map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName }));
    }
    if (imageOnly && s.id === 'ark') return [];
    const anthropic = s.id === 'anthropic';
    const url = `${base}${anthropic ? '/v1' : ''}/models${s.id === 'openrouter' && imageOnly ? '?output_modalities=image' : ''}`;
    const res = await requestUrl({ url, headers: anthropic ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' } : key ? { Authorization: `Bearer ${key}` } : {}, throw: false });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    const payload = res.json as { code?: number }; if (payload.code !== undefined && payload.code !== 0) throw new Error('models-request-failed');
    const list = ((res.json as { data?: { id: string; name?: string; display_name?: string; architecture?: { output_modalities?: string[] } }[] }).data ?? []);
    const filtered = s.id === 'openrouter' && imageOnly ? list.filter(m => m.architecture?.output_modalities?.includes('image')) : list;
    const models = filtered.map(m => ({ id: m.id, name: m.name ?? m.display_name }));
    return imageOnly && s.id !== 'openrouter' ? jimengModels(base, models) : models;
  }
}
