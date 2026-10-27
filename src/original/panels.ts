import { usePairing, type Resolved } from './typeset';
import { Menu, Modal } from '../harness-ui';
import { ModelDialog } from './modeldialog';
import { chatLabel, imageLabel, switchChat, switchImage } from './aiparse';
import { installPack, packMissing } from './fontpack';
import { Notice, setIcon } from '../harness-ui';
import { ActiveSelection, Circle, FabricImage, FabricObject, Group, Line, Polygon, Rect, StaticCanvas, Textbox, Triangle } from 'fabric';
import type { ChatMessage, CoverView, QObject } from './view';
import { SHADOWS } from './view';
import { DrawerTab } from './config';
import { decorById } from './decor';
import type { Key } from './i18n';
import { GROUPS, PLATFORMS, platformFor } from './platforms';
import { Palette, Template, gradient, templateById, templatesFor } from './templates';
import { colorControl, quietName, emptyState, field, group, iconButton, numberBox, onEnter, segmented, slider, textButton } from './ui';
import { openFontPopover } from './fontbrowser';
import { startersFor } from './prompts';
import { playbookFor } from './playbook';
import { MESH_PRESETS, meshCss } from './mesh';
import { Background } from './model';
import { bytes } from './ui';
import { assetThumb, loadAssets, type AssetCat } from './assets';

/* ---------- left rail and drawers ---------- */
const TABS: { id: DrawerTab; icon: string; key: 'tabTemplates' | 'tabAdd' | 'tabFonts' | 'tabAssistant' }[] = [
  { id: 'assistant', icon: 'sparkles', key: 'tabAssistant' }, { id: 'templates', icon: 'layout-template', key: 'tabTemplates' },
];
export function renderDrawer(view: CoverView, el: HTMLElement): void {
  el.empty(); const tab = ['fonts', 'add'].includes(view.plugin.settings.drawer) ? 'assistant' : view.plugin.settings.drawer; el.toggleClass('is-open', !!tab); // fonts are picked while editing text, not in a tab
  if (!tab) return;
  // Tabs live at the top of the panel, where the eye already is, instead of a separate icon rail that costs a column and hides its labels.
  const head = el.createDiv('qc-drawer-head'); const tabs = head.createDiv('qc-drawer-tabs'); tabs.setAttribute('role', 'tablist');
  for (const x of TABS) {
    const b = tabs.createEl('button', { cls: 'qc-drawer-tab', attr: { type: 'button', role: 'tab', 'aria-selected': String(tab === x.id) } });
    setIcon(b.createSpan({ cls: 'qc-drawer-tab-icon' }), x.icon); b.createSpan({ text: view.t(x.key) }); b.classList.toggle('is-active', tab === x.id);
    b.addEventListener('click', () => { view.plugin.settings.drawer = x.id; void view.plugin.saveSettings(); view.refreshDrawer(); view.applyZoom(); });
  }
  iconButton(head, 'panel-left-close', view.t('close'), () => view.toggleDrawer());
  const body = el.createDiv('qc-drawer-body');
  if (tab === 'templates') drawerTemplates(view, body);
  else drawerAssistant(view, body);
  view.win.requestAnimationFrame(() => view.applyZoom());
}

const previewCache = new Map<string, string>();
/** Thumbnails render one at a time with a breath between them, so opening the Templates tab never freezes the editor. */
let thumbQueue: Promise<unknown> = Promise.resolve();
const breathe = (): Promise<void> => new Promise(r => window.setTimeout(r, 12));
/** Renders a small PNG of a template at the given canvas size. */
export function templateThumb(doc: Document, zh: boolean, width: number, height: number, t: Template, title: string, subtitle: string, extra: { badge?: string; points?: string[]; pair?: Resolved; palette?: Partial<Palette> } = {}): Promise<string> {
  const job = thumbQueue.then(() => breathe()).then(() => renderThumb(doc, zh, width, height, t, title, subtitle, extra));
  thumbQueue = job.catch(() => undefined); return job;
}
async function renderThumb(doc: Document, zh: boolean, width: number, height: number, t: Template, title: string, subtitle: string, extra: { badge?: string; points?: string[]; pair?: Resolved; palette?: Partial<Palette> }): Promise<string> {
  const key = `${t.id}|${width}x${height}|${title}|${subtitle}|${extra.badge ?? ''}|${JSON.stringify(extra.points ?? [])}|${extra.pair?.title ?? ''}|${extra.pair?.body ?? ''}|${zh}|${JSON.stringify(extra.palette ?? {})}`;
  const hit = previewCache.get(key); if (hit) return hit;
  const el = doc.createElement('canvas'); const sc = new StaticCanvas(el, { width, height, renderOnAddRemove: false, enableRetinaScaling: false });
  // Same input and same fonts as the real thing, so the thumbnail is what you get when you click.
  usePairing(extra.pair);
  let r: ReturnType<typeof t.build>; try { r = t.build({ width, height, title, subtitle, zh, points: extra.points, ...(extra.badge ? { badge: extra.badge } : {}), ...(extra.palette ? { palette: extra.palette } : {}) }); } finally { usePairing(undefined); }
  sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(width, height, r.background.from, r.background.to, r.background.angle);
  for (const o of r.objects) sc.add(o);
  sc.renderAll();
  const url = sc.toDataURL({ format: 'png', multiplier: 260 / Math.max(width, height), enableRetinaScaling: false });
  await sc.dispose(); if (previewCache.size > 120) previewCache.clear(); previewCache.set(key, url); return url;
}
function drawerTemplates(view: CoverView, body: HTMLElement): void {
  drawerSeries(view, body);
  body.createDiv({ text: view.t('templatesHint'), cls: 'qc-hint' });
  const grid = body.createDiv('qc-template-grid'); const copy = view.copyText();
  const platformId = view.platform()?.id;
  for (const t of templatesFor(platformId)) {
    const card = grid.createEl('button', { cls: 'qc-template', attr: { type: 'button', 'aria-pressed': String(view.design?.template === t.id) } });
    const thumb = card.createDiv('qc-template-thumb'); thumb.style.aspectRatio = `${view.design!.width} / ${view.design!.height}`;
    const label = card.createSpan({ text: view.zh ? t.zh : t.en, cls: 'qc-template-name' });
    if (t.fit.includes(platformId ?? '')) label.createSpan({ text: ` · ${view.t('recommended')}`, cls: 'qc-template-rec' });
    card.addEventListener('click', () => void view.action(() => { view.applyTemplate(t.id, {}, true); }));
    void templateThumb(view.doc, view.zh, view.design!.width, view.design!.height, t, copy.title, copy.subtitle, { ...(copy.badge ? { badge: copy.badge } : {}), pair: view.pairing(t.id) }).then(url => { if (card.isConnected) thumb.createEl('img', { attr: { src: url, alt: '' } }); }).catch(() => undefined);
  }
}
/** Saved looks on top of the template list: save the current one, apply one, remove one. The first is the assistant's default. */
function drawerSeries(view: CoverView, body: HTMLElement): void {
  const box = body.createDiv('qc-series'); const head = box.createDiv('qc-series-head');
  head.createSpan({ text: view.t('seriesTitle'), cls: 'qc-series-title' });
  textButton(head, view.t('seriesSave'), () => { const s = view.saveSeries(); if (s) { new Notice(view.t('seriesSaved', { name: s.name })); view.refreshDrawer(); } }, 'qc-btn-sm', 'bookmark-plus');
  const list = view.plugin.settings.series;
  if (!list.length) { box.createDiv({ text: view.t('seriesHint'), cls: 'qc-hint' }); return; }
  const grid = box.createDiv('qc-template-grid'); const copy = view.copyText(); const d = view.design!;
  list.forEach((s, k) => {
    const t = templateById(s.template); if (!t) return;
    const card = grid.createDiv({ cls: 'qc-template qc-series-card', attr: { role: 'button', tabindex: '0' } });
    const thumb = card.createDiv('qc-template-thumb'); thumb.style.aspectRatio = `${d.width} / ${d.height}`;
    const label = card.createSpan({ text: s.name, cls: 'qc-template-name' }); if (k === 0) label.createSpan({ text: ` · ${view.t('seriesDefault')}`, cls: 'qc-template-rec' });
    const del = card.createEl('button', { cls: 'qc-series-del clickable-icon', attr: { type: 'button', 'aria-label': view.t('seriesRemove') } }); setIcon(del, 'x');
    del.addEventListener('click', e => { e.stopPropagation(); view.removeSeries(s.id); view.refreshDrawer(); });
    const go = (): void => void view.action(() => view.applySeries(s.id));
    card.addEventListener('click', go); card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    void templateThumb(view.doc, view.zh, d.width, d.height, t, copy.title, copy.subtitle, { ...(copy.badge ? { badge: copy.badge } : {}), pair: view.pairing(t.id), palette: s.palette }).then(url => { if (card.isConnected) thumb.createEl('img', { attr: { src: url, alt: '' } }); }).catch(() => undefined);
  });
}
/* ---------- assistant ---------- */
/** Selects the first 【…】 placeholder so the user can type their own topic straight over it. */
function selectPlaceholder(input: HTMLTextAreaElement): void {
  const open = input.value.indexOf('【'); const close = open < 0 ? -1 : input.value.indexOf('】', open);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus(); if (open >= 0 && close > open) input.setSelectionRange(open + 1, close);
}
type TrayTab = 'template' | 'prompt';
let trayTab: TrayTab | undefined = 'template'; let trayScroll = 0;
interface TrayCtx { input: HTMLTextAreaElement; templates: Template[]; groups: ReturnType<typeof startersFor>; chips: Record<TrayTab, HTMLElement> }
/**
 * What you can pick from opens inside the composer card, above the text box, and is driven by the chips under it. Templates are visual
 * (a strip of thumbnails that stays open so you can try several); prompts are text rows.
 * A prompt closes the tray after you pick it, because the next thing you do is write.
 */
function buildTray(view: CoverView, host: HTMLElement, ctx: TrayCtx): { toggle: (tab: TrayTab) => void } {
  const zh = view.zh; const plugin = view.plugin;
  const render = (): void => {
    host.empty(); host.toggleClass('qc-hidden', !trayTab);
    for (const [id, chip] of Object.entries(ctx.chips)) chip.classList.toggle('is-active', trayTab === id);
    if (!trayTab) return;
    if (trayTab === 'template') {
      // The same templates, thumbnails and keep-your-words behaviour as the Templates tab, just one click closer to the composer.
      const strip = host.createDiv('qc-tray-strip'); strip.addEventListener('scroll', () => { trayScroll = strip.scrollLeft; });
      strip.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const cards = Array.from(strip.querySelectorAll<HTMLButtonElement>('.qc-tray-card, .qc-tray-more'));
        const index = cards.indexOf(view.doc.activeElement as HTMLButtonElement);
        const next = cards[index + (e.key === 'ArrowRight' ? 1 : -1)];
        if (index >= 0 && next) { e.preventDefault(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      });
      const copy = view.copyText();
      for (const t of ctx.templates) {
        const c = strip.createEl('button', { cls: 'qc-tray-card', attr: { type: 'button', 'aria-pressed': String(view.design?.template === t.id) } }); c.classList.toggle('is-active', view.design?.template === t.id);
        const thumb = c.createDiv('qc-tray-thumb is-loading'); templateThumb(view.doc, view.zh, view.design!.width, view.design!.height, t, copy.title, copy.subtitle, { ...(copy.badge ? { badge: copy.badge } : {}), pair: view.pairing(t.id) }).then(url => { thumb.removeClass('is-loading'); const img = thumb.createEl('img', { attr: { src: url, alt: '' } }); img.addEventListener('load', () => { const r = Math.min(2.6, Math.max(0.7, img.naturalWidth / Math.max(1, img.naturalHeight))); thumb.style.aspectRatio = String(r); c.style.flexBasis = `${Math.round(Math.min(176, Math.max(76, r * 76)))}px`; }); }, () => thumb.removeClass('is-loading'));
        c.createSpan({ text: zh ? t.zh : t.en, cls: 'qc-tray-name' });
        c.addEventListener('click', () => { void view.action(() => { view.applyTemplate(t.id, {}, true); }); strip.querySelectorAll('.qc-tray-card').forEach(x => { x.classList.toggle('is-active', x === c); x.setAttribute('aria-pressed', String(x === c)); }); });
      }
      const more = strip.createEl('button', { cls: 'qc-tray-more', attr: { type: 'button' } }); setIcon(more.createSpan(), 'layout-template'); more.createSpan({ text: view.t('browseTemplates') });
      more.addEventListener('click', () => { plugin.settings.drawer = 'templates'; void plugin.saveSettings(); view.refreshDrawer(); });
      strip.scrollLeft = trayScroll;
    } else if (trayTab === 'prompt') {
      const list = host.createDiv('qc-tray-list'); const seen = new Set<string>();
      for (const g of ctx.groups) for (const spx of g.prompts) {
        if (seen.has(spx.id)) continue; seen.add(spx.id); const text = zh ? spx.zhPrompt : spx.enPrompt;
        const row = list.createEl('button', { cls: 'qc-tray-row', attr: { type: 'button' } }); row.createSpan({ text: zh ? spx.zh : spx.en, cls: 'qc-tray-row-name' }); row.createSpan({ text: text.replace(/\s+/g, ' '), cls: 'qc-tray-row-text' });
        row.addEventListener('click', () => { ctx.input.value = text; trayTab = undefined; render(); selectPlaceholder(ctx.input); });
      }

    }
  };
  render();
  return { toggle: tab => { trayTab = trayTab === tab ? undefined : tab; trayScroll = 0; render(); } };
}

/** Offers the starter font pack once: the single biggest jump in how good the covers look, and nobody finds it on their own. */
function fontNudge(view: CoverView, body: HTMLElement): void {
  const plugin = view.plugin; const missing = packMissing(plugin, 'designer');
  if (plugin.settings.fontNudgeOff || !missing) return;
  const card = body.createDiv('qc-ai-banner'); setIcon(card.createSpan({ cls: 'qc-ai-banner-icon' }), 'type');
  const text = card.createDiv('qc-ai-banner-text'); text.createEl('strong', { text: view.t('fontNudgeTitle') }); const desc = text.createSpan({ text: view.t('fontNudgeDesc') });
  const act = card.createDiv('qc-ai-banner-act');
  const go = textButton(act, view.t('fontNudgeGo'), () => {
    go.disabled = true; later.addClass('qc-hidden');
    void installPack(plugin, view.doc, 'designer', (done, total, family) => { go.setText(family ? `${done + 1}/${total} ${family}…` : view.t('fontNudgeDone')); }).then(r => {
      if (r.installed.length) { view.repairFonts(); card.remove(); } else { go.disabled = false; go.setText(view.t('fontNudgeGo')); later.removeClass('qc-hidden'); desc.setText(view.t('fontNudgeFail')); }
    });
  }, 'qc-primary qc-btn-sm', 'download');
  const later = textButton(act, view.t('fontNudgeLater'), () => { plugin.settings.fontNudgeOff = true; void plugin.saveSettings(); card.remove(); }, 'qc-btn-sm');
}
function drawerAssistant(view: CoverView, body: HTMLElement): void {
  const plugin = view.plugin; const providers = plugin.assistantList(); const ai = plugin.ai;
  const conversations = body.createDiv('qc-conversation-bar');
  // Title on the left, two icon actions on the right (history, new chat): the same header every chat app uses, one slim row.
  const title = conversations.createSpan('qc-conversation-name');
  const historyButton = iconButton(conversations, 'history', view.t('chatHistory'), () => {
    if (view.busy) return; const menu = new Menu().setUseNativeMenu(false).setParentElement(body);
    for (const session of view.conversations) menu.addItem(i => i.setTitle(session.title || view.t('chatUntitled')).setChecked(session.id === view.activeConversation?.id).onClick(() => void view.action(() => view.switchConversation(session.id))));
    menu.addSeparator(); menu.addItem(i => i.setTitle(view.t('chatRename')).setIcon('pencil').onClick(() => conversationDialog(view, false)));
    menu.addItem(i => i.setTitle(view.t('chatDelete')).setIcon('trash-2').onClick(() => conversationDialog(view, true)));
    menu.addSeparator(); menu.addItem(i => i.setTitle(view.t('chatCopyDirection')).setIcon('copy-plus').onClick(() => void view.action(() => view.branchConversation())));
    menu.addItem(i => i.setTitle(view.t('chatBlank')).setIcon('file-plus-2').onClick(() => void view.action(() => view.blankConversation())));
    const r = historyButton.getBoundingClientRect(); menu.showAtPosition({ x: r.right, y: r.bottom + 4, left: true }, view.doc);
  }, 'qc-conversation-history');
  historyButton.setAttribute('aria-haspopup', 'menu');
  const newButton = iconButton(conversations, 'square-pen', view.t('chatNew'), () => void view.action(() => view.newChat()), 'qc-conversation-new');
  for (const b of [historyButton, newButton]) { const label = b.getAttribute('aria-label')!; b.removeAttribute('aria-label'); quietName(b, label); }
  const head = body.createDiv('qc-chat-head');
  const sel = head.createEl('select', { cls: 'qc-select' });
  for (const p of providers) sel.createEl('option', { text: p.name, value: p.id });
  sel.value = providers.some(p => p.id === plugin.settings.assistant) ? plugin.settings.assistant : providers[0]!.id;
  sel.addEventListener('change', () => { plugin.settings.assistant = sel.value; void plugin.saveSettings(); body.empty(); drawerAssistant(view, body); });
  // The built-in AI and offline modes are one choice made in settings, so the picker only appears when another plugin adds assistants.
  const extras = providers.some(p => p.id !== 'ai' && p.id !== 'offline');
  if (!extras) { sel.addClass('qc-hidden'); sel.value = 'ai'; }
  if (!extras) head.addClass('qc-hidden');
  fontNudge(view, body);
  if (sel.value === 'ai' && !ai.ready()) {
    const card = body.createDiv('qc-ai-banner'); setIcon(card.createSpan({ cls: 'qc-ai-banner-icon' }), 'plug-zap');
    const text = card.createDiv('qc-ai-banner-text'); text.createEl('strong', { text: view.t('aiConnectTitle') }); text.createSpan({ text: view.t('aiConnectDesc') });
    textButton(card, view.t('aiConnect'), () => plugin.openSettings('assistant'), 'qc-primary qc-btn-sm');
  }
  const cfg = plugin.settings.ai;
  const messages = body.createDiv({ cls: 'qc-chat-messages', attr: { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' } });
  quietName(messages, view.t('tabAssistant'), head);
  // Next steps after a reply sit right above the box, one quiet row, instead of a labelled block inside every message.
  const followups = body.createDiv({ cls: 'qc-followups qc-hidden', attr: { role: 'group' } }); quietName(followups, view.t('tweaksTitle'));
  const compose = body.createDiv('qc-chat-compose'); const trayEl = compose.createDiv('qc-tray qc-hidden');
  const book = playbookFor(view.platform()?.id); const current = templateById(view.design?.template ?? '');
  // The current canvas pick shows above the box, so "make it bigger / change its colour" has a visible referent.
  const selChip = compose.createDiv({ cls: 'qc-sel-chip qc-chat-scope' });
  const updateSelChip = (): void => {
    const label = view.selectionLabel();
    selChip.empty(); selChip.classList.toggle('is-selection', !!label);
    setIcon(selChip.createSpan({ cls: 'qc-sel-chip-icon' }), label ? 'mouse-pointer-2' : 'panel-top'); selChip.createSpan({ text: label ? view.t('selChip', { what: label }) : view.t('chatCanvasScope'), cls: 'qc-chat-scope-name' });
    if (label) { const clear = iconButton(selChip, 'x', view.t('chatClearSelection'), () => { if (view.busy) return; view.canvas?.discardActiveObject(); view.canvas?.requestRenderAll(); view.refreshInspector(true); updateSelChip(); }, 'qc-chat-scope-clear'); clear.removeAttribute('aria-label'); quietName(clear, view.t('chatClearSelection')); clear.disabled = view.busy; }
  };
  view.onSelection = updateSelChip; updateSelChip();
  const source = compose.createEl('details', { cls: 'qc-note-context' });
  const sourceLabel = source.createEl('summary'); const sourceContent = source.createDiv('qc-note-context-content');
  const updateSource = (): void => {
    const context = view.noteContext;
    source.classList.toggle('qc-hidden', !view.design?.source);
    const scope = view.t(view.noteState === 'reading' ? 'noteReading' : view.noteState === 'error' ? 'noteReadFailed' : context?.kind === 'summary' ? context.selection ? 'noteSelectionSummary' : 'noteSummary' : view.design?.noteSelection ? 'noteSelection' : context ? 'noteFull' : 'notePending');
    sourceLabel.empty(); setIcon(sourceLabel.createSpan({ cls: 'qc-note-context-icon' }), 'file-text');
    sourceLabel.createSpan({ text: view.t('noteSourceLabel', { name: context?.title ?? view.sourceNote()?.basename ?? view.design?.source?.replace(/^.*\//, '').replace(/\.md$/, '') ?? '', scope }), cls: 'qc-note-context-label' });
    sourceContent.empty();
    if (context) { sourceContent.createDiv({ text: view.t('notePreviewHint', { scope: view.t(context.kind === 'summary' ? context.selection ? 'noteSelectionSummary' : 'noteSummary' : context.kind === 'selection' ? 'noteSelection' : 'noteFull'), count: context.characters }), cls: 'qc-hint' }); sourceContent.createEl('pre', { text: context.text }); }
    else sourceContent.createDiv({ text: view.t(view.noteState === 'error' ? 'noteReadError' : 'notePreviewPending'), cls: 'qc-hint' });
  };
  view.onNoteContext = updateSource; updateSource();
  const input = compose.createEl('textarea', { cls: 'qc-chat-input', attr: { rows: '2', placeholder: current ? view.t('chatPlaceholderPattern', { name: view.zh ? current.zh : current.en }) : view.t(sel.value === 'ai' ? 'chatPlaceholderAi' : 'chatPlaceholder') } });
  input.value = view.chatDraft;
  const bar = compose.createDiv('qc-compose-bar');
  const templateBtn = bar.createEl('button', { cls: 'qc-chip-btn', attr: { type: 'button' } }); setIcon(templateBtn.createSpan({ cls: 'qc-chip-icon' }), 'layout-template'); templateBtn.createSpan({ text: current ? (view.zh ? current.zh : current.en) : view.t('templateChip'), cls: 'qc-chip-label' });
  const promptBtn = bar.createEl('button', { cls: 'qc-chip-btn', attr: { type: 'button' } }); setIcon(promptBtn.createSpan({ cls: 'qc-chip-icon' }), 'message-square-text'); promptBtn.createSpan({ text: view.zh ? '提示词' : 'Prompts', cls: 'qc-sr-only' }); promptBtn.addClass('is-icon');
  bar.createDiv({ cls: 'qc-compose-spacer' });
  // Models are set once and rarely changed, so they live behind one small button instead of taking a row of their own.
  if (sel.value === 'ai') {
    const modelBtn = iconButton(bar, 'settings', view.t('aiSettings'), e => {
      const m = new Menu(); m.addItem(i => i.setTitle(view.zh ? '排版模型' : 'Layout model').setIsLabel(true));
      for (const x of cfg.chats) m.addItem(i => i.setTitle(chatLabel(x.id === cfg.chatId ? { chatAlias: cfg.chatAlias, preset: cfg.preset, protocol: cfg.protocol, baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, codexBin: cfg.codexBin, codexModel: cfg.codexModel } : x.snap)).setChecked(x.id === cfg.chatId).onClick(() => { switchChat(cfg, x.id); void plugin.saveSettings(); view.refreshDrawer(); }));
      m.addItem(i => i.setTitle(view.zh ? '添加排版模型…' : 'Add layout model…').setIcon('plus').onClick(() => new ModelDialog(plugin, 'chat', () => view.refreshDrawer()).open()));
      m.addSeparator(); m.addItem(i => i.setTitle(view.zh ? '生图模型' : 'Picture model').setIsLabel(true));
      for (const x of cfg.images) m.addItem(i => i.setTitle(imageLabel(x.id === cfg.imageId ? { imageAlias: cfg.imageAlias, imageOn: cfg.imageOn, imageEngine: cfg.imageEngine, imageBaseUrl: cfg.imageBaseUrl, imageKey: cfg.imageKey, imageModel: cfg.imageModel, imageSize: cfg.imageSize } : x.snap)).setChecked(x.id === cfg.imageId && cfg.imageOn).onClick(() => { switchImage(cfg, x.id); void plugin.saveSettings(); view.refreshDrawer(); }));
      m.addItem(i => i.setTitle(view.zh ? '这次不生图' : 'No pictures').setChecked(!cfg.imageOn).onClick(() => { cfg.imageOn = false; void plugin.saveSettings(); view.refreshDrawer(); }));
      m.addItem(i => i.setTitle(view.zh ? '添加生图模型…' : 'Add picture model…').setIcon('plus').onClick(() => new ModelDialog(plugin, 'image', () => view.refreshDrawer()).open()));
      m.addSeparator(); m.addItem(i => i.setTitle(view.zh ? '管理模型…' : 'Manage…').setIcon('settings').onClick(() => plugin.openSettings('assistant'))); m.showAtMouseEvent(e);
    }, 'qc-model-btn');
    void modelBtn;
  }
  const send = iconButton(bar, 'arrow-up', view.t('send'), () => void submit(), 'qc-primary qc-send');

  const syncInput = (): void => {
    if (!input.isConnected) return;
    title.setText(view.activeConversation?.title || view.t('chatUntitled')); historyButton.disabled = view.busy; newButton.disabled = view.busy; updateSelChip();
    view.chatDraft = input.value;
    input.style.removeProperty('height');
    input.style.height = `${Math.min(180, input.scrollHeight)}px`;
    send.disabled = view.busy || view.restoring || !input.value.trim();
  };
  input.addEventListener('input', syncInput);
  view.win.requestAnimationFrame(syncInput);

  // The chips under the input are the tabs of a tray that opens inside the same card, so choosing and writing feel like one gesture.
  const tray = buildTray(view, trayEl, { input, templates: templatesFor(view.platform()?.id), groups: startersFor(view.platform()?.id), chips: { template: templateBtn, prompt: promptBtn } });
  templateBtn.addEventListener('click', () => tray.toggle('template')); promptBtn.addEventListener('click', () => tray.toggle('prompt'));

  const starters = (): void => {
    const empty = messages.createDiv('qc-chat-empty');
    if (view.conversations.length > 1) { empty.createEl('h3', { text: view.t('chatFreshTitle') }); empty.createEl('p', { text: view.t('chatFreshHint'), cls: 'qc-hint' }); input.placeholder = view.t('chatFreshPlaceholder'); return; }
    if (sel.value !== 'ai') {
      setIcon(empty.createDiv('qc-empty-icon'), 'sparkles'); empty.createEl('h3', { text: view.t('chatTitle') }); empty.createEl('p', { text: view.t('chatIntro') });
      for (const prompt of [view.t('chatEx1'), view.t('chatEx2'), view.t('chatEx3'), view.t('chatEx4')]) {
        const chip = empty.createEl('button', { text: prompt, cls: 'qc-chip', attr: { type: 'button' } }); chip.addEventListener('click', () => { input.value = prompt; selectPlaceholder(input); });
      }
      return;
    }
    // A clear first step: three lines on how it works, then the best styles for this platform, one click each.
    empty.createEl('h3', { text: view.t('guideTitle') });
    const steps = empty.createEl('ol', { cls: 'qc-guide' });
    for (const k of ['guide1', 'guide2', 'guide3'] as const) steps.createEl('li', { text: view.t(k) });
    const note = view.sourceNote();
    if (note && ai.ready()) { const hero = empty.createEl('button', { cls: 'qc-note-hero', attr: { type: 'button' } }); setIcon(hero.createSpan({ cls: 'qc-note-hero-icon' }), 'file-text'); const txt = hero.createDiv('qc-note-hero-text'); txt.createSpan({ text: view.t('noteHero'), cls: 'qc-note-hero-title' }); txt.createSpan({ text: note.basename, cls: 'qc-hint' }); hero.addEventListener('click', () => void view.coverFromSourceNote()); }
    const guide = empty.createEl('details', { cls: 'qc-more qc-playbook' }); guide.createEl('summary', { text: view.t('playbookTitle') });
    guide.createEl('p', { text: book.essence, cls: 'qc-hint' }); const rules = guide.createEl('ul'); for (const r of book.rules) rules.createEl('li', { text: r });
    guide.createDiv({ text: view.t('playbookFormulas'), cls: 'qc-msg-sub' }); const fl = guide.createEl('ul'); for (const x of book.formulas) { const li = fl.createEl('li'); li.createEl('strong', { text: `${x.zh}：` }); li.createSpan({ text: `${x.pattern} — ${x.example}` }); }
    guide.createDiv({ text: `${view.t('playbookAvoid')}：${book.avoid.join('；')}`, cls: 'qc-hint' });
  };
  let previousCount = 0; let followNext = false;
  const draw = (): void => {
    if (!body.isConnected) { view.onChat = undefined; view.onSelection = undefined; return; }
    const oldTop = messages.scrollTop;
    const nearEnd = messages.scrollHeight - messages.clientHeight - oldTop < 40;
    const anchor = Array.from(messages.children).findIndex(el => (el as HTMLElement).offsetTop + (el as HTMLElement).offsetHeight > messages.offsetTop + oldTop);
    const anchorOffset = anchor >= 0 ? (messages.children[anchor] as HTMLElement).offsetTop - messages.offsetTop - oldTop : 0;
    messages.empty();
    messages.setAttribute('aria-busy', String(view.busy)); syncInput();
    if (!view.chat.length && !view.busy) { starters(); drawFollowups(); previousCount = 0; return; }
    view.chat.forEach((m, index) => {
      const bubble = messages.createDiv({ cls: `qc-msg qc-msg-${m.role}` });
      bubble.createDiv({ text: m.text, cls: 'qc-msg-text' });
      let changes = bubble;
      if ((m.applied?.length ?? 0) > 2) { const details = bubble.createEl('details', { cls: 'qc-msg-details' }); details.createEl('summary', { text: view.t('chatChanges', { n: m.applied!.length }) }); changes = details.createDiv(); }
      for (const a of m.applied ?? []) { const li = changes.createDiv('qc-msg-applied'); setIcon(li.createSpan(), 'check'); li.createSpan({ text: a }); }
      for (const w of m.warn ?? []) { const li = bubble.createDiv('qc-msg-applied qc-msg-warn'); setIcon(li.createSpan(), 'alert-triangle'); li.createSpan({ text: w }); }
      // Variant strips stay visible (and clickable) on older messages, so going back to an earlier
      // candidate is always possible; tweaks and retry act on the current state, so they stay on the last message.
      if (m.variants?.length) {
        if (!m.variants.some(v => v.spec)) bubble.createDiv({ text: view.t('variantsTitle'), cls: 'qc-msg-sub' }); const strip = bubble.createDiv('qc-variants');
        quietName(strip, view.t('variantsTitle'));
        strip.addEventListener('scroll', () => { m.variantScroll = strip.scrollLeft; });
        strip.addEventListener('keydown', e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const cards = Array.from(strip.querySelectorAll<HTMLButtonElement>('.qc-variant'));
          const index = cards.indexOf(view.doc.activeElement as HTMLButtonElement);
          const next = cards[index + (e.key === 'ArrowRight' ? 1 : -1)];
          if (next) { e.preventDefault(); next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        });
        let startX = 0, startY = 0, initialScroll = 0, pointer: number | undefined, dragged = false;
        strip.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; pointer = e.pointerId; startX = e.clientX; startY = e.clientY; initialScroll = strip.scrollLeft; dragged = false; });
        strip.addEventListener('pointermove', e => {
          if (e.pointerId !== pointer || !e.buttons) return;
          const dx = e.clientX - startX;
          if (!dragged && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - startY)) { dragged = true; strip.setPointerCapture(e.pointerId); }
          if (dragged) { e.preventDefault(); strip.scrollLeft = initialScroll - dx; }
        });
        const release = (): void => { pointer = undefined; };
        strip.addEventListener('pointerup', release); strip.addEventListener('pointercancel', release);
        strip.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
        view.win.requestAnimationFrame(() => { strip.scrollLeft = m.variantScroll ?? 0; });
        for (const v of m.variants) {
          const card = strip.createEl('button', { cls: 'qc-variant', attr: { type: 'button' } }); const image = card.createEl('img', { attr: { src: v.url, alt: v.label, draggable: 'false' } });
          image.addEventListener('load', () => { card.toggleClass('qc-variant-landscape', image.naturalWidth > image.naturalHeight); }); card.createSpan({ text: v.label });
          card.classList.toggle('is-active', !!v.selected); card.setAttribute('aria-pressed', String(!!v.selected)); card.disabled = view.busy;
          card.addEventListener('click', () => void view.chooseVariant(m, v));
        }
      }
      // Icons a turn picked from the library keep their runners-up (like layout variants): one tap swaps the icon in place.
      for (const pick of m.picks ?? []) {
        bubble.createDiv({ text: view.t('picksTitle'), cls: 'qc-msg-sub' }); const strip = bubble.createDiv('qc-picks');
        void loadAssets(view.app, plugin.manifest.dir ?? '').then(data => {
          for (const it of [pick.chosen, ...pick.items.map(x => `${x.cat}:${x.id}`)]) {
            const [cat, id] = it.split(':') as [AssetCat, string]; const item = (cat === 'line' ? data.lines : data.stickers).find(a => a.id === id); if (!item) continue;
            const b = strip.createEl('button', { cls: 'qc-pick', attr: { type: 'button', 'aria-label': cat === 'sticker' ? item.zh : item.id, 'aria-pressed': String(it === pick.chosen) } });
            b.createEl('img', { attr: { src: assetThumb(item), alt: item.zh, draggable: 'false' } }); b.classList.toggle('is-active', it === pick.chosen);
            b.disabled = view.busy; b.addEventListener('click', () => { if (it === pick.chosen || view.busy) return; void view.action(async () => { await view.swapAsset(pick.target, cat, id); pick.chosen = it; view.persistChat(); draw(); }); });
          }
        });
      }
      if (index === view.chat.length - 1 && !view.busy) {
        // The model would rather ask than guess: its clarifying question comes with tappable answers.
        if (m.options?.length) {
          const chips = bubble.createDiv('qc-tweaks');
          for (const opt of m.options) { const b = chips.createEl('button', { text: opt, cls: 'qc-tweak', attr: { type: 'button' } }); b.addEventListener('click', () => void view.ask(opt)); }
        }
        // Problems the checks found (feed size, a faint colour) become one-tap fixes right under the warning they answer.
        if (m.suggestions?.length) {
          const chips = bubble.createDiv('qc-tweaks qc-fixes');
          for (const s of m.suggestions) { const b = chips.createEl('button', { cls: 'qc-tweak qc-fix', attr: { type: 'button' } }); setIcon(b.createSpan('qc-tweak-icon'), 'wand-sparkles'); b.createSpan({ text: s.label }); b.addEventListener('click', () => void view.runThumbSuggestion(s.id)); }
        }
      }
      messageActions(m, index, bubble);
    });
    drawFollowups();
    if (view.busy) { const b = messages.createDiv({ cls: 'qc-msg qc-msg-assistant qc-thinking', attr: { role: 'status' } }); setIcon(b.createSpan(), 'loader-circle'); b.createSpan({ text: view.progress || view.t('thinking') }); }
    if ((nearEnd || followNext) && view.chat.length > previousCount) {
      const newest = messages.children[view.chat.length - 1] as HTMLElement;
      messages.scrollTop = newest.offsetHeight > messages.clientHeight ? newest.offsetTop - messages.offsetTop - 8 : messages.scrollHeight;
    } else if (anchor >= 0 && messages.children[anchor]) {
      messages.scrollTop = (messages.children[anchor] as HTMLElement).offsetTop - messages.offsetTop - anchorOffset;
    } else messages.scrollTop = oldTop;
    previousCount = view.chat.length; followNext = false;

  };
  /**
   * Icon actions under each message, the set every chat app converged on: copy, edit (yours), restore / branch / another take
   * (the designer's), delete the turn. Older messages show them on hover or focus; the newest and touch screens always do.
   */
  const messageActions = (m: ChatMessage, index: number, bubble: HTMLElement): void => {
    const latest = index === view.chat.length - 1;
    const row = bubble.createDiv({ cls: `qc-msg-controls${latest ? ' is-latest' : ''}`, attr: { role: 'group' } });
    const act = (icon: string, key: Key, fn: () => void, cls = ''): void => { const b = iconButton(row, icon, view.t(key), fn, cls); b.removeAttribute('aria-label'); quietName(b, view.t(key)); b.disabled = view.busy; };
    if (m.role === 'assistant') {
      // Every applied turn keeps a canvas snapshot, so the chat doubles as a visual version history.
      if (m.snapshot) act('history', 'msgRestore', () => void view.action(() => view.restoreSnapshot(m.snapshot!)), 'qc-msg-restore');
      if (m.snapshot) act('git-branch', 'chatBranch', () => void view.action(() => view.branchConversation(index)), 'qc-msg-branch');
      if (latest && m.retry) act('refresh-cw', 'retry', () => void view.retry(), 'qc-msg-retry');
      const prompt = view.chat[index - 1]?.role === 'user' ? view.chat[index - 1]!.text : '';
      if (latest && m.failed && prompt) act('rotate-ccw', 'msgRetryFailed', () => { if (input.value.trim() === prompt.trim()) { input.value = ''; syncInput(); } void view.action(() => view.retryTurn(index)); }, 'qc-msg-retry');
      if (latest && m.retry && m.snapshot) act('download', 'exportShort', () => void view.action(() => view.openExport()));
    } else act('pencil', 'msgEdit', () => { input.value = m.text; syncInput(); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 'qc-msg-edit');
    act('copy', 'msgCopy', () => { void view.win.navigator.clipboard.writeText(m.text).then(() => new Notice(view.t('msgCopied'))); });
    act('trash-2', 'msgDeleteTurn', () => void view.action(() => view.deleteTurn(index)), 'qc-msg-delete');
  };
  const drawFollowups = (): void => {
    followups.empty(); const last = view.chat.at(-1);
    const show = !view.busy && last?.role === 'assistant' && !!last.tweaks; followups.toggleClass('qc-hidden', !show); if (!show) return;
    const list: [Key, Key, string][] = [['tweakBold', 'tweakBoldP', 'zap'], ['tweakColor', 'tweakColorP', 'palette'], ['tweakCalm', 'tweakCalmP', 'eraser'], ['tweakShort', 'tweakShortP', 'scissors'], ['tweakDeco', 'tweakDecoP', 'shapes']];
    if (ai.imageReady()) list.splice(3, 0, ['tweakSubject', 'tweakSubjectP', 'image-plus']);
    for (const [label, prompt, icon] of list) {
      const b = followups.createEl('button', { cls: 'qc-followup', attr: { type: 'button' } }); setIcon(b.createSpan('qc-followup-icon'), icon); b.createSpan({ text: view.t(label) });
      b.addEventListener('click', () => { if (label === 'tweakSubject') { view.pictureRequested = true; if (plugin.settings.imageStyle === 'none') plugin.settings.imageStyle = 'auto'; } followNext = true; void view.ask(view.t(prompt), view.t(label)); });
    }
  };
  view.onChat = draw;
  const submit = (): void => {
    const prompt = input.value.trim(); if (!prompt || view.busy || view.restoring) return;
    // A starter's 【placeholder】 left untouched would be designed literally, so ask for the real topic first.
    if (/【[^】]*(你的|粘贴|主题|摘要|内容)[^】]*】|【your |【paste /i.test(prompt)) { new Notice(view.t('fillPlaceholder')); selectPlaceholder(input); return; }
    input.value = ''; syncInput(); followNext = true;
    void view.ask(prompt).then(() => {
      // Preserve failed prompts without overwriting text typed while waiting.
      if (view.chat.at(-1)?.failed && !input.value) input.value = prompt;
      syncInput();
      if (input.isConnected && (!view.doc.activeElement || view.doc.activeElement === view.doc.body || compose.contains(view.doc.activeElement))) input.focus({ preventScroll: true });
    });
  };
  onEnter(input, e => { e.preventDefault(); submit(); });
  input.addEventListener('input', () => view.persistChat());
  draw();
}

function conversationDialog(view: CoverView, deleting: boolean): void {
  const modal = new Modal(view.app); modal.onOpen = () => {
    modal.titleEl.setText(view.t(deleting ? 'chatDelete' : 'chatRename')); modal.contentEl.addClass('qc-modal');
    const input = deleting ? undefined : modal.contentEl.createEl('input', { type: 'text', cls: 'qc-input', attr: { maxlength: '80' } });
    if (input) { input.value = view.activeConversation?.title || ''; quietName(input, view.t('chatRename')); }
    else modal.contentEl.createEl('p', { text: view.t('chatDeleteHint'), cls: 'qc-hint' });
    const footer = modal.contentEl.createDiv('qc-modal-footer'); textButton(footer, view.t('cancel'), () => modal.close());
    const confirm = textButton(footer, view.t(deleting ? 'remove' : 'save'), () => { if (!deleting && !input?.value.trim()) return; confirm.disabled = true; void (deleting ? view.deleteConversation() : view.renameConversation(input!.value)).then(() => modal.close()).catch(e => { confirm.disabled = false; view.plugin.report(e); }); }, 'qc-primary');
    if (input) { onEnter(input, event => { event.preventDefault(); confirm.click(); }); view.win.requestAnimationFrame(() => { input.focus(); input.select(); }); }
  }; modal.open();
}

/* ---------- inspector ---------- */
const ALIGN_ICONS: [import('./ops').Align, string, 'alignLeft' | 'alignCenterH' | 'alignRight' | 'alignTop' | 'alignMiddle' | 'alignBottom'][] = [
  ['left', 'align-start-vertical', 'alignLeft'], ['center', 'align-center-vertical', 'alignCenterH'], ['right', 'align-end-vertical', 'alignRight'],
  ['top', 'align-start-horizontal', 'alignTop'], ['middle', 'align-center-horizontal', 'alignMiddle'], ['bottom', 'align-end-horizontal', 'alignBottom'],
];
export function renderInspector(view: CoverView, el: HTMLElement): void {
  const top = el.scrollTop; el.empty();
  const sel = view.selection();
  if (view.rightTab === 'canvas' || !sel.length) renderCanvasPanel(view, el); else renderObjectPanel(view, el, sel);
  el.scrollTop = top;
}

function renderObjectPanel(view: CoverView, el: HTMLElement, sel: QObject[]): void {
  const first = sel[0]!; const texts = view.texts(); const allText = texts.length === sel.length; const single = sel.length === 1;
  const t = view.t.bind(view); const recent = view.plugin.settings.recentColors;
  const commit = (c: string): void => view.plugin.rememberColor(c);
  const header = el.createDiv('qc-obj-head');
  header.createSpan({ text: single ? layerName(view, first) : t('selected', { n: sel.length }), cls: 'qc-obj-title' });
  const actions = header.createDiv('qc-obj-actions');
  iconButton(actions, first.lockMovementX ? 'lock-keyhole' : 'lock-keyhole-open', t('locked'), () => view.toggleLock(), first.lockMovementX ? 'is-active' : '');
  iconButton(actions, 'copy-plus', t('duplicate'), () => void view.action(() => view.cloneSelection()));
  iconButton(actions, 'trash-2', t('remove'), () => view.removeSelection());
  const create = el.createDiv('qc-selection-create'); textButton(create, t('imageCreateSelection'), () => void view.action(() => view.openSelectionImageGenerator()), 'qc-btn-sm', 'image-pen');

  if (single && ((first.qcRole === 'subject' || first.qcRole === 'image') && first.qcPrompt !== undefined || first.qcRole === 'subject')) {
    const g = group(el, t('aiRedraw')); g.createDiv({ text: t('aiRedrawHint'), cls: 'qc-hint' });
    const ta = g.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '4', spellcheck: 'false', placeholder: t('aiPrompt') } }); ta.value = first.qcPrompt ?? '';
    ta.addEventListener('input', () => { first.qcPrompt = ta.value; });
    const run = textButton(g, t('aiRedraw'), () => void view.regenerate(first, ta.value), 'qc-primary', 'sparkles'); run.disabled = !view.plugin.ai.imageReady() || view.busy;
  }
  if (allText) {
    const g = group(el, t('text'));
    if (single) {
      const box = first as Textbox; const ta = g.createEl('textarea', { cls: 'qc-textarea', attr: { rows: '3', spellcheck: 'false' } }); ta.value = box.text;
      let composing = false;
      ta.addEventListener('compositionstart', () => { composing = true; });
      ta.addEventListener('compositionend', () => { composing = false; view.update({ text: ta.value }, o => o === box); });
      ta.addEventListener('input', () => { if (!composing) view.update({ text: ta.value }, o => o === box); });
    }
    const fontRow = field(g, t('font'), 'qc-field-wide'); const fontBtn = fontRow.body.createEl('button', { cls: 'qc-font-btn', attr: { type: 'button' } });
    const family = (first as Textbox).fontFamily; const avail = view.plugin.fonts.available(view.doc, family);
    const nameSpan = fontBtn.createSpan({ text: view.plugin.fonts.find(family)?.zh && view.zh ? view.plugin.fonts.find(family)!.zh! : family, cls: 'qc-font-btn-name' }); nameSpan.style.fontFamily = `"${family.replace(/"/g, '')}", sans-serif`;
    if (!avail) fontBtn.createSpan({ text: t('fontMissing'), cls: 'qc-badge is-warn' });
    setIcon(fontBtn.createSpan({ cls: 'qc-chevron' }), 'chevron-down');
    fontBtn.addEventListener('click', () => openFontPopover(view, fontBtn, family, f => view.setFont(f), /[\u3400-\u9fff]/.test((first as Textbox).text) ? 'zh' : 'en'));

    const sizeRow = g.createDiv('qc-row qc-row-tight');
    numberBox(sizeRow, t('size'), (first as Textbox).fontSize * (first.scaleY || 1), v => view.update({ fontSize: v, scaleX: 1, scaleY: 1 }, o => o instanceof Textbox), { min: 8, max: 600, unit: 'px' });
    const styles = sizeRow.createDiv('qc-seg qc-seg-icons');
    const flag = (icon: string, label: string, on: boolean, props: (next: boolean) => Record<string, unknown>): void => {
      const b = styles.createEl('button', { cls: 'qc-seg-btn', attr: { type: 'button' } }); setIcon(b, icon); b.createSpan({ text: label, cls: 'qc-sr-only' }); b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => { const next = !b.classList.contains('is-active'); b.classList.toggle('is-active', next); b.setAttribute('aria-pressed', String(next)); view.update(props(next), o => o instanceof Textbox); });
    };
    const f = first as Textbox;
    flag('bold', t('bold'), f.fontWeight === 'bold' || Number(f.fontWeight) >= 600, n => ({ fontWeight: n ? 'bold' : 'normal' }));
    flag('italic', t('italic'), f.fontStyle === 'italic', n => ({ fontStyle: n ? 'italic' : 'normal' }));
    flag('underline', t('underline'), !!f.underline, n => ({ underline: n }));
    flag('strikethrough', t('strike'), !!f.linethrough, n => ({ linethrough: n }));
    segmented<'left' | 'center' | 'right'>(g, [{ value: 'left', icon: 'align-left', label: t('left') }, { value: 'center', icon: 'align-center', label: t('center') }, { value: 'right', icon: 'align-right', label: t('right') }], (f.textAlign as 'left') ?? 'left', v => view.update({ textAlign: v }, o => o instanceof Textbox), 'qc-seg-icons');
    slider(g, t('lineHeight'), Math.round(f.lineHeight * 100) / 100, 0.8, 2.4, 0.05, v => view.update({ lineHeight: v }, o => o instanceof Textbox), v => v.toFixed(2));
    slider(g, t('letterSpacing'), f.charSpacing, -100, 800, 10, v => view.update({ charSpacing: v }, o => o instanceof Textbox), v => `${Math.round(v / 10) / 100}em`);
    colorControl(g, t('color'), typeof f.fill === 'string' ? f.fill : '#171717', c => view.update({ fill: c }, o => o instanceof Textbox), { recent, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: commit });

    const fx = group(el, t('effects'), { open: !!(f.textBackgroundColor || (f.stroke && f.strokeWidth) || f.shadow) });
    colorControl(fx, t('highlight'), f.textBackgroundColor || '', c => view.update({ textBackgroundColor: c }, o => o instanceof Textbox), { recent, none: true, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: commit });
    colorControl(fx, t('stroke'), (f.strokeWidth && typeof f.stroke === 'string' ? f.stroke : '') || '', c => view.update({ stroke: c || null, strokeWidth: c ? Math.max(f.strokeWidth || 0, 4) : 0, paintFirst: 'stroke' }, o => o instanceof Textbox), { recent, none: true, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: commit });
    if (f.stroke) slider(fx, t('strokeWidth'), f.strokeWidth || 0, 0, 40, 1, v => view.update({ strokeWidth: v, paintFirst: 'stroke' }, o => o instanceof Textbox));
    shadowControl(view, fx, first);
  } else if (sel.every(o => o instanceof FabricImage)) {
    const g = group(el, t('image'));
    const img = first as FabricImage;
    const row = g.createDiv('qc-col');
    if (single) textButton(row, t('imageReplace'), () => pickReplacement(view, img), '', 'refresh-cw');
    const fitRow = g.createDiv('qc-row');
    textButton(fitRow, t('imageCover'), () => view.fitImage(img, 'cover'), 'qc-btn-sm', 'maximize'); textButton(fitRow, t('imageContain'), () => view.fitImage(img, 'contain'), 'qc-btn-sm', 'minimize');
    const flipRow = g.createDiv('qc-row');
    textButton(flipRow, t('flipH'), () => view.update({ flipX: !img.flipX }), 'qc-btn-sm', 'flip-horizontal'); textButton(flipRow, t('flipV'), () => view.update({ flipY: !img.flipY }), 'qc-btn-sm', 'flip-vertical');
    const radius = img.clipPath instanceof Rect ? (img.clipPath.rx || 0) * img.scaleX : 0;
    slider(g, t('cornerRadius'), Math.round(radius), 0, Math.round(Math.min(img.getScaledWidth(), img.getScaledHeight()) / 2), 1, v => view.setCorner(img, v));
    const fx = group(el, t('effects'), { open: !!img.shadow }); shadowControl(view, fx, first);
  } else if (sel.every(o => o instanceof Group)) {
    const fx = group(el, t('effects'), { open: !!first.shadow }); shadowControl(view, fx, first);
  } else if (sel.every(o => !(o instanceof Textbox) && !(o instanceof FabricImage))) {
    const g = group(el, t('shape'));
    const isLine = first instanceof Line;
    if (!isLine) colorControl(g, t('fill'), typeof first.fill === 'string' && first.fill !== 'rgba(0,0,0,0)' ? first.fill : '', c => view.update({ fill: c || 'rgba(0,0,0,0)' }), { recent, none: true, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: commit });
    colorControl(g, t('stroke'), (first.strokeWidth && typeof first.stroke === 'string' ? first.stroke : '') || '', c => view.update({ stroke: c || null, strokeWidth: c ? Math.max(first.strokeWidth || 0, 6) : 0 }), { recent, none: true, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: commit });
    if (first.stroke) slider(g, t('strokeWidth'), first.strokeWidth || 0, 0, 80, 1, v => view.update({ strokeWidth: v }));
    if (first instanceof Rect) slider(g, t('cornerRadius'), Math.round(first.rx || 0), 0, Math.round(Math.min(first.width, first.height) / 2), 1, v => view.update({ rx: v, ry: v }, o => o instanceof Rect));
    const fx = group(el, t('effects'), { open: !!first.shadow }); shadowControl(view, fx, first);
  }

  arrangeBlock(view, el, sel);
}

/** Figma-style top block: align, stack order, then position, size, rotation and opacity in one compact grid. */
function arrangeBlock(view: CoverView, el: HTMLElement, sel: QObject[]): void {
  const first = sel[0]!; const single = sel.length === 1; const t = view.t.bind(view);
  const g = group(el, t('transform'));
  const tools = g.createDiv('qc-tool-row');
  for (const [to, icon, key] of ALIGN_ICONS) iconButton(tools, icon, t(key), () => view.align(to));
  tools.createSpan({ cls: 'qc-tool-sep' });
  iconButton(tools, 'bring-to-front', t('front'), () => view.order('front')); iconButton(tools, 'arrow-up', t('forward'), () => view.order('forward'));
  iconButton(tools, 'arrow-down', t('backward'), () => view.order('backward')); iconButton(tools, 'send-to-back', t('back'), () => view.order('back'));
  const b = first.getBoundingRect(); const grid = g.createDiv('qc-grid2');
  numberBox(grid, 'X', b.left, v => moveTo(view, 'x', v), { unit: 'px' }); numberBox(grid, 'Y', b.top, v => moveTo(view, 'y', v), { unit: 'px' });
  if (single && !(first instanceof Textbox)) {
    numberBox(grid, 'W', first.getScaledWidth(), v => { first.scaleToWidth(v); first.setCoords(); view.canvas?.requestRenderAll(); view.changed(); }, { min: 1, unit: 'px' });
    numberBox(grid, 'H', first.getScaledHeight(), v => { first.scaleToHeight(v); first.setCoords(); view.canvas?.requestRenderAll(); view.changed(); }, { min: 1, unit: 'px' });
  } else if (single && first instanceof Textbox) {
    numberBox(grid, 'W', first.getScaledWidth(), v => { view.update({ width: v / (first.scaleX || 1) }, o => o === first); }, { min: 20, unit: 'px' });
  }
  numberBox(grid, t('rotation'), first.angle, v => view.update({ angle: v }), { min: -360, max: 360, unit: '°' });
  slider(g, t('opacity'), Math.round(first.opacity * 100), 0, 100, 1, v => view.update({ opacity: v / 100 }), v => `${v}%`);
}

function moveTo(view: CoverView, axis: 'x' | 'y', value: number): void {
  const target = view.canvas?.getActiveObject(); if (!target) return;
  const b = target.getBoundingRect();
  if (axis === 'x') target.set({ left: target.left + (value - b.left) }); else target.set({ top: target.top + (value - b.top) });
  target.setCoords(); view.canvas?.requestRenderAll(); view.changed();
}
function shadowControl(view: CoverView, parent: HTMLElement, first: QObject): void {
  const current = first.qcShadow ?? (first.shadow ? 'soft' : 'none');
  const f = field(parent, view.t('shadow'), 'qc-field-wide');
  segmented(f.body, (['none', 'soft', 'hard', 'glow'] as const).map(v => ({ value: v, label: view.t(`shadow_${v}` as 'shadow_none') })), (current in SHADOWS ? current : 'none') as 'none', v => view.setShadow(v), 'qc-seg-small');
}
function pickReplacement(view: CoverView, img: FabricImage): void {
  const input = view.doc.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
  input.addEventListener('change', () => { const f = input.files?.[0]; if (f) void view.action(() => view.replaceImage(img, f)); }, { once: true }); input.click();
}
export function layerName(view: CoverView, o: FabricObject): string {
  const named = (o as QObject).qcName; if (named) return named;
  const role = (o as QObject).qcRole;
  if (role === 'subject') return view.t('layerSubject');
  if (role === 'decor') { const k = decorById((o as QObject).qcKind ?? ''); return k ? `${view.t('layerDecor')} · ${k.zh}` : view.t('layerDecor'); }
  if (o instanceof Textbox) return o.text.replace(/\s+/g, ' ').slice(0, 30) || view.t('text');
  if (o instanceof FabricImage) return (o as QObject & { qcCredit?: string }).qcCredit ?? view.t('image');
  if (o instanceof Circle) return view.t('circle'); if (o instanceof Triangle) return view.t('triangle'); if (o instanceof Line) return view.t('line'); if (o instanceof Polygon) return view.t('star');
  if (o instanceof Group) return (o as QObject).qcLayerGroup ? view.t('layerGroup') : view.zh ? '素材' : 'Asset';
  return view.t('rectangle');
}
function layerIcon(o: FabricObject): string {
  if ((o as QObject).qcLayerGroup) return 'folder';
  if (o instanceof Textbox) return 'type'; if (o instanceof FabricImage) return 'image'; if (o instanceof Circle) return 'circle'; if (o instanceof Triangle) return 'triangle';
  if (o instanceof Line) return 'minus'; if (o instanceof Polygon) return 'star'; return 'square';
}

/* ---------- canvas panel (nothing selected) ---------- */
const GRADIENTS: [string, string][] = [['#0f172a', '#1e3a8a'], ['#1a1033', '#4c1d95'], ['#fdf2e9', '#fcd9c4'], ['#e8f0ff', '#d4e1ff'], ['#fff1f2', '#ffd6e0'], ['#ecfdf5', '#c9f2dd'], ['#111827', '#374151'], ['#ffedd5', '#fed7aa']];
function renderCanvasPanel(view: CoverView, el: HTMLElement): void {
  const d = view.design!; const t = view.t.bind(view); const recent = view.plugin.settings.recentColors;
  const current = platformFor(d.width, d.height, d.platform);
  const pg = group(el, t('platform'));
  for (const grp of GROUPS) {
    pg.createDiv({ text: view.zh ? grp.zh : grp.en, cls: 'qc-subhead' });
    const grid = pg.createDiv('qc-plat-grid');
    for (const p of PLATFORMS.filter(x => x.group === grp.id)) {
      const b = grid.createEl('button', { cls: 'qc-plat', attr: { type: 'button' } }); setIcon(b.createSpan({ cls: 'qc-plat-icon' }), p.icon);
      const text = b.createDiv('qc-plat-text'); text.createSpan({ text: view.zh ? p.zh : p.en, cls: 'qc-plat-name' }); text.createSpan({ text: `${p.width} × ${p.height}`, cls: 'qc-plat-size' });
      b.classList.toggle('is-active', current?.id === p.id);
      b.addEventListener('click', () => view.setPlatform(p.id));
    }
  }
  if (current) {
    pg.createDiv({ text: view.zh ? current.zhHint : current.enHint, cls: 'qc-hint' });
    if (current.maxBytes) pg.createDiv({ text: t('limitNote', { size: bytes(current.maxBytes) }), cls: 'qc-hint' });
  }
  const custom = group(el, t('customSize'), { open: !current });
  const row = custom.createDiv('qc-row qc-row-tight'); let w = d.width, h = d.height; let fit = true;
  numberBox(row, t('width'), d.width, v => { w = Math.round(v); }, { min: 200, max: 4096, unit: 'px' }); numberBox(row, t('height'), d.height, v => { h = Math.round(v); }, { min: 200, max: 4096, unit: 'px' });
  const fitRow = custom.createEl('label', { cls: 'qc-check' }); const cb = fitRow.createEl('input', { type: 'checkbox' }); cb.checked = true; cb.addEventListener('change', () => { fit = cb.checked; }); fitRow.createSpan({ text: t('fitContent') });
  textButton(custom, t('resize'), () => { if (w < 200 || h < 200 || w > 4096 || h > 4096) { new Notice(t('sizeRange')); return; } view.resizeTo(w, h, fit); }, 'qc-btn-sm');

  const bg = group(el, t('background')); const spec: Background = d.bg ?? { kind: 'solid', color: '#ffffff' };
  const mode: 'solid' | 'linear' | 'mesh' = view.hasMesh() ? 'mesh' : spec.kind;
  segmented<'solid' | 'linear' | 'mesh'>(bg, [{ value: 'mesh', label: t('bgMesh') }, { value: 'solid', label: t('solid') }, { value: 'linear', label: t('gradientLabel') }], mode, v => {
    if (v === 'mesh') view.applyMesh(MESH_PRESETS.find(p => p.base === (spec.kind === 'solid' ? spec.color : '')) ?? MESH_PRESETS[0]!);
    else if (v === 'solid') view.applyBackground({ kind: 'solid', color: spec.kind === 'solid' ? spec.color : spec.from });
    else view.applyBackground(spec.kind === 'linear' ? spec : { kind: 'linear', from: spec.color, to: '#111111', angle: 135 });
    view.refreshInspector(true);
  });
  if (mode === 'mesh') {
    const grid = bg.createDiv('qc-mesh-grid');
    for (const m of MESH_PRESETS) {
      const b = grid.createEl('button', { cls: 'qc-mesh', attr: { type: 'button' } }); b.style.background = meshCss(m); b.createSpan({ text: view.zh ? m.zh : m.en, cls: m.dark ? 'qc-mesh-name is-dark' : 'qc-mesh-name' });
      b.addEventListener('click', () => view.applyMesh(m));
    }
  } else {
    if (spec.kind === 'solid') colorControl(bg, t('color'), spec.color, c => view.applyBackground({ kind: 'solid', color: c }), { recent, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: c => view.plugin.rememberColor(c) });
    else {
      colorControl(bg, t('gradientFrom'), spec.from, c => view.applyBackground({ ...spec, from: c }), { recent, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: c => view.plugin.rememberColor(c) });
      colorControl(bg, t('gradientTo'), spec.to, c => view.applyBackground({ ...spec, to: c }), { recent, zh: view.zh, onStart: () => view.beginColorEdit(), onEnd: () => view.endColorEdit(), onCommit: c => view.plugin.rememberColor(c) });
      slider(bg, t('angle'), spec.angle, 0, 360, 5, v => view.applyBackground({ ...spec, angle: v }), v => `${v}°`);
    }
    const presets = bg.createDiv('qc-gradient-grid');
    for (const [from, to] of GRADIENTS) {
      const b = presets.createEl('button', { cls: 'qc-gradient', attr: { type: 'button' } }); b.style.background = `linear-gradient(160deg, ${from}, ${to})`; b.createSpan({ text: `${from} → ${to}`, cls: 'qc-sr-only' });
      b.addEventListener('click', () => { view.applyBackground({ kind: 'linear', from, to, angle: 160 }); view.refreshInspector(true); });
    }
  }

  const used = view.fontsInUse();
  if (used.length) {
    const fg = group(el, t('fontsUsed'), { open: used.some(f => !view.plugin.fonts.available(view.doc, f)) });
    for (const family of used) {
      const ok = view.plugin.fonts.available(view.doc, family); const r = fg.createDiv('qc-used');
      setIcon(r.createSpan({ cls: ok ? 'qc-ok' : 'qc-warn' }), ok ? 'check' : 'triangle-alert');
      const n = r.createSpan({ text: family, cls: 'qc-used-name' }); n.style.fontFamily = `"${family.replace(/"/g, '')}", sans-serif`;
      if (!ok) r.createSpan({ text: t('fontMissing'), cls: 'qc-badge is-warn' });
    }
    if (used.some(f => !view.plugin.fonts.available(view.doc, f))) fg.createDiv({ text: t('fontMissingHint'), cls: 'qc-hint' });
  }
}

/* ---------- layers ---------- */
export function renameLayersDialog(view: CoverView, objects: FabricObject[]): void {
  if (!objects.length) return;
  const modal = new Modal(view.app); modal.titleEl.setText(view.t('renameLayers')); modal.contentEl.addClass('qc-modal'); const id = crypto.randomUUID();
  modal.contentEl.createEl('label', { text: view.t('layerName'), attr: { for: id } }); const input = modal.contentEl.createEl('input', { attr: { id, type: 'text', maxlength: '100' } }); input.value = objects.length === 1 ? layerName(view, objects[0]!) : '';
  if (objects.length > 1) modal.contentEl.createDiv({ text: view.t('layerBatchName'), cls: 'qc-hint' });
  const generation = view.imageGuard(), apply = (): void => { if (generation() && input.value.trim()) { view.renameLayers(objects, input.value); modal.close(); } };
  const footer = modal.contentEl.createDiv('qc-modal-footer'); textButton(footer, view.t('cancel'), () => modal.close()); textButton(footer, view.t('save'), apply, 'qc-primary'); input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) apply(); }); modal.open(); view.win.requestAnimationFrame(() => { input.focus(); input.select(); });
}
export function renderLayers(view: CoverView, el: HTMLElement): void {
  const top = el.scrollTop; el.empty(); const c = view.canvas; if (!c) return;
  const objects = c.getObjects(), active = c.getActiveObjects(), t = view.t.bind(view);
  const toolbar = el.createDiv('qc-layer-bar'); toolbar.createSpan({ text: active.length ? t('selected', { n: active.length }) : t('layers'), cls: 'qc-hint' });
  const groupButton = iconButton(toolbar, 'group', t('groupLayers'), () => view.groupLayers()); groupButton.disabled = active.length < 2 || active.some(o => o.group && !(o.group instanceof ActiveSelection) || o.lockMovementX || o.lockMovementY);
  const ungroup = iconButton(toolbar, 'ungroup', t('ungroupLayers'), () => view.ungroupLayers()); ungroup.disabled = active.length !== 1 || !(active[0] as QObject)?.qcLayerGroup;
  const rename = iconButton(toolbar, 'pencil', t('renameLayers'), () => renameLayersDialog(view, active)); rename.disabled = !active.length;
  const search = el.createEl('input', { cls: 'qc-layer-search', attr: { type: 'search', placeholder: t('layerSearch') } }); search.value = view.layerQuery;
  if (!objects.length) { emptyState(el, { icon: 'layers', title: view.zh ? '还没有元素' : 'Nothing here yet', hint: view.zh ? '点顶部“插入”添加元素。' : 'Use Insert to add elements.' }); return; }
  const list = el.createDiv('qc-layers'); let dragging: FabricObject | undefined;
  const matches = (o: FabricObject): boolean => !view.layerQuery || layerName(view, o).toLowerCase().includes(view.layerQuery.toLowerCase()) || ((o as QObject).qcLayerGroup && (o as Group).getObjects().some(matches)) === true;
  const draw = (): void => {
    list.empty(); const rows: { object: FabricObject; parent?: Group; depth: number }[] = [];
    const visit = (o: FabricObject, depth: number, parent?: Group): void => { if (!matches(o)) return; rows.push({ object: o, depth, parent }); if ((o as QObject).qcLayerGroup && (!view.layerFolded.has(o) || view.layerQuery)) for (const child of [...(o as Group).getObjects()].reverse()) visit(child, depth + 1, o as Group); };
    for (const o of [...c.getObjects()].reverse()) visit(o, 0);
    if (!rows.length) { list.createDiv({ text: t('layerNoMatch'), cls: 'qc-hint' }); return; }
    for (const { object: o, depth, parent } of rows) {
      const row = list.createDiv({ cls: 'qc-layer', attr: { draggable: 'true', role: 'option', 'aria-selected': String(c.getActiveObjects().includes(o)), tabindex: '0' } }); row.style.paddingLeft = `${8 + depth * 16}px`; row.classList.toggle('is-selected', c.getActiveObjects().includes(o)); row.classList.toggle('is-hidden', !o.visible);
      if ((o as QObject).qcLayerGroup) iconButton(row, view.layerFolded.has(o) ? 'chevron-right' : 'chevron-down', t('layerExpand'), e => { e.stopPropagation(); if (view.layerFolded.has(o)) view.layerFolded.delete(o); else view.layerFolded.add(o); draw(); }, 'qc-layer-fold');
      else row.createSpan({ cls: 'qc-layer-fold-spacer' });
      setIcon(row.createSpan({ cls: 'qc-layer-icon' }), layerIcon(o)); const name = row.createSpan({ text: layerName(view, o), cls: 'qc-layer-name' }); name.addEventListener('dblclick', e => { e.stopPropagation(); renameLayersDialog(view, [o]); });
      const tools = row.createDiv('qc-layer-tools');
      iconButton(tools, 'pencil', t('renameLayers'), e => { e.stopPropagation(); renameLayersDialog(view, [o]); });
      iconButton(tools, o.visible ? 'eye' : 'eye-off', t('visible'), e => { e.stopPropagation(); o.set({ visible: !o.visible }); if (!o.visible && c.getActiveObjects().includes(o)) c.discardActiveObject(); c.requestRenderAll(); view.changed(); draw(); });
      iconButton(tools, o.lockMovementX ? 'lock-keyhole' : 'lock-keyhole-open', t('locked'), e => { e.stopPropagation(); c.discardActiveObject(); c.setActiveObject(o); view.toggleLock(); }, o.lockMovementX ? 'is-active' : '');
      const pick = (event: MouseEvent | KeyboardEvent): void => {
        if (!o.visible) return;
        const siblings = rows.filter(r => r.parent === parent).map(r => r.object); let chosen: FabricObject[] = [o];
        if (event.shiftKey && view.layerAnchor && siblings.includes(view.layerAnchor)) { const a = siblings.indexOf(view.layerAnchor), b = siblings.indexOf(o); chosen = siblings.slice(Math.min(a, b), Math.max(a, b) + 1).filter(o => o.visible); }
        else if (event.metaKey || event.ctrlKey) { chosen = c.getActiveObjects().filter(x => siblings.includes(x)); if (chosen.includes(o)) chosen = chosen.filter(x => x !== o); else chosen.push(o); }
        else view.layerAnchor = o;
        c.discardActiveObject(); if (chosen.length === 1) c.setActiveObject(chosen[0]!); else if (chosen.length) c.setActiveObject(new ActiveSelection(chosen, { canvas: c })); c.requestRenderAll(); renderLayers(view, el);
      };
      row.addEventListener('click', pick); row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } if (e.key === 'F2') { e.preventDefault(); renameLayersDialog(view, [o]); } });
      row.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const menu = new Menu(); menu.addItem(i => i.setTitle(t('renameLayers')).setIcon('pencil').onClick(() => renameLayersDialog(view, [o]))); menu.showAtMouseEvent(e); });
      row.addEventListener('dragstart', e => { dragging = o; e.dataTransfer?.setData('text/plain', 'layer'); row.addClass('is-dragging'); }); row.addEventListener('dragend', () => { dragging = undefined; row.removeClass('is-dragging'); });
      row.addEventListener('dragover', e => { if (dragging && dragging.group === o.group) { e.preventDefault(); row.addClass('is-over'); } }); row.addEventListener('dragleave', () => row.removeClass('is-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.removeClass('is-over'); if (dragging && dragging !== o && dragging.group === o.group) { if (parent) parent.moveObjectTo(dragging, parent.getObjects().indexOf(o)); else c.moveObjectTo(dragging, c.getObjects().indexOf(o)); c.requestRenderAll(); view.changed(); draw(); } });
    }
  };
  search.addEventListener('input', () => { view.layerQuery = search.value; draw(); }); draw(); el.scrollTop = top;
}
