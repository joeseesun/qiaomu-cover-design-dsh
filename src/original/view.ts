import { mountedCanvasSize } from "../canvas-layout";
import { COVER_ICON } from './cover-icon';
import { conversationContext, conversationTitle, newConversation, savedMessages, type ConversationBook, type DesignerConversation } from './conversations';
import { bindDrawing, type DrawingInput } from './drawing';
import { snapAxis, type SnapHit } from './snapping';
import { bindMarquee } from './marquee';
import { imageHash, type ImageSelection } from './imagejobs';
import type { GeneratedPicture, ImageReference } from './seedream';
import { prepareNote, wantsWholeNote, type NoteContext } from './notecontext';
import { enhance, FileView, MarkdownView, Menu, Notice, setIcon, TFile, WorkspaceLeaf } from '../harness-ui';
import { ActiveSelection, Point, Canvas, StaticCanvas, Circle, FabricImage, FabricObject, Gradient, Group, Line, Path, Polygon, Rect, Shadow, Textbox, Triangle, getEnv, loadSVGFromString, setEnv, util } from 'fabric';
import { cutout, opaqueBounds } from './cutout';
import { DESIGN_PREVIEW_LIMIT, picturePolicy, requestsPicture, usefulFeedback, withoutPictures } from './designflow';
import { templateThumb } from './panels';
import { calmLayout, clearCopyOfZones, decorOnText, layoutPass } from './calm';
import { faceFor, isSingleWeight, pillFor, styleText, textPresetById, type TextPreset } from './textstyles';
import { openInsertPopover } from './insertpop';
import { ImageGenerateDialog, type ImageGenerationContext } from './imagegenerate';
import { BASIC_SHAPES, PATH_SHAPES, type BasicShape } from './shapes';
import { AssetCat, assetSvg, loadAssets } from './assets';
import { assignIds, layoutIssues, placeBox, regionOf, resolveTarget, WHERE_ZH, type Box as SceneBox, type NodeKind, type SceneMeta, type SceneNode, type Target } from './scene';
import { ADJUST_ZH, adjustPalette, colorMap, hexToHsl, fixPalette, mergePalette, MOOD_PALETTES, toneOf, type Tone } from './color';
import { rankAssets } from './resolve';
import { fontProblem } from './fontcheck';
import { pairingById, type Pairing } from './pairings';
import type { RunResult } from './capabilities';
import { downloadPhoto, hasSource, searchPhotos, unsplashKey } from './unsplash';
import { resolvePair, typeFor, usePairing, type Resolved } from './typeset';
import { Background, Design, ExportFormat, ExportPrefs, EXPORT_DEFAULTS, folderPath, History, parseDesign, renderFilename, safeName, SerialWriter, SnapshotCodec, validSize } from './model';
import { Platform, PLATFORMS, platformById, platformFor } from './platforms';
import { BadgeBox } from './badge';
import type { Palette } from './templates';
import { arrangeForSubject, builtPalette, canReflow, reserveBelowTitle, rewrap, sourceOf, unwrap, templateById, templatesFor, gradient, hasCjk, textbox, textWidth, tightenCopy } from './templates';
import { decorInFront, drawDecor } from './decor';
import { expandPattern, patternById } from './playbook';
import { renderPattern } from './preview';
import { MESH_LIBRARY, MeshPreset } from './mesh';
import { glow as kitGlow, grain } from './kit';
import { Anchor, decorPlacement, defaultSubjectBox, SubjectBox, TitleBox } from './compose';
import { contrast, ensureReadable, FEED_WIDTH, readableOn, THUMB_MIN, thumbCheck, toContrast } from './quality';
import { addSeries, pickVariants, Series } from './series';
import { imageStyleById } from './prompts';
import { Align, AssistantInput, AssistantResult, CanvasItem, CoverApi, DecorSpec, DesignSpec, Op, OpOf, OpProblem, Placement, TextChange } from './ops';
import { runOps } from './capabilities';
import { guardSelection, simpleColour } from './edit-scope';
import { Key } from './i18n';
import type CoverPlugin from '../native-controller';
import { renderDrawer, renderInspector, renderLayers, renameLayersDialog } from './panels';
import { colorControl, quietName, iconButton, textButton, toggleButton } from './ui';
import { ExportModal, RenameModal, SizeModal, ShortcutsModal, PickFile } from './modals';

export const VIEW = 'qiaomu-cover-design';
export interface Variant { id: string; label: string; url: string; spec?: DesignSpec; selected?: boolean }
/** One-tap fix offered after an AI turn, e.g. a headline that reads too small in a phone feed. */
export interface Suggestion { id: string; label: string }
export interface AssetPick { target: string; chosen: string; items: { cat: AssetCat; id: string }[] }
export interface ChatMessage { role: 'user' | 'assistant'; text: string; failed?: boolean; applied?: string[]; /** Notes that need attention (e.g. the model narrated without acting), shown with a warning icon. */ warn?: string[]; retry?: boolean; variants?: Variant[]; variantScroll?: number; tweaks?: boolean; options?: string[]; suggestions?: Suggestion[]; /** Runner-up library items for icons this turn added; tapping one swaps it in. */ picks?: AssetPick[]; /** Canvas state right after this turn, so the chat doubles as a visual version history. */ snapshot?: string }
export type QObject = FabricObject & { qcRole?: string; qcShadow?: string; qcKind?: string; qcPrompt?: string; qcAnchor?: string; qcWrapped?: boolean; qcHug?: boolean; qcTpl?: boolean; /** Stable short id the assistant refers to (t1, i3…). */ qcId?: string; qcImageId?: string; qcName?: string; qcLayerGroup?: boolean; /** Palette token the colour follows. */ qcTone?: string; /** Library item, e.g. line:guitar or sticker:rocket. */ qcAsset?: string };
export const PROPS = ['qcRole', 'qcShadow', 'qcKind', 'qcPrompt', 'qcAnchor', 'qcWrapped', 'qcSource', 'qcHug', 'qcTpl', 'qcCredit', 'qcId', 'qcImageId', 'qcName', 'qcLayerGroup', 'qcTone', 'qcAsset'];
type Layout = Pick<DesignSpec, 'title' | 'subtitle' | 'badge' | 'points' | 'palette' | 'titleFont' | 'bodyFont'>;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2600;

export const SHADOWS: Record<string, (fill: string) => Shadow | null> = {
  none: () => null,
  soft: () => new Shadow({ color: 'rgba(0,0,0,0.35)', blur: 18, offsetX: 0, offsetY: 8 }),
  hard: () => new Shadow({ color: '#111111', blur: 0, offsetX: 8, offsetY: 8 }),
  glow: fill => new Shadow({ color: fill || '#ffffff', blur: 28, offsetX: 0, offsetY: 0 }),
};

export class CoverView extends FileView implements CoverApi {
  canvas?: Canvas; design?: Design;
  noteContext?: NoteContext; noteState: 'pending' | 'reading' | 'ready' | 'error' = 'pending';
  onNoteContext?: () => void;
  private expected = ''; private writer = new SerialWriter(); private history = new History(); private codec = new SnapshotCodec();
  restoring = false; private closingView = false; private dirty = false; private saveTimer?: number; private historyTimer?: number; private revision = 0;
  private task = false; private generation = 0; private observer?: ResizeObserver; private resizeFrame?: number; private clip: Record<string, unknown>[] = [];
  stage?: HTMLElement; inspectorEl?: HTMLElement; private drawerEl?: HTMLElement; private baseRevision = 0; private lastDrawer: 'templates' | 'add' | 'fonts' | 'assistant' = 'assistant'; private guidesEl?: HTMLElement; private snapEl?: HTMLElement;
  private statusEl?: HTMLElement; private zoomLabel?: HTMLElement; private undoBtn?: HTMLButtonElement; private redoBtn?: HTMLButtonElement; private platformBtn?: HTMLElement;
  zoom: number | 'fit' = 'fit'; rightTab: 'design' | 'layers' | 'canvas' = 'canvas'; private tabsEl?: HTMLElement; private refreshQueued = false;
  private unsubscribeFonts?: () => void;
  /** Conversation with the designer. It lives on the view so it survives drawer redraws. */
  pictureRequested = false;
  chatDraft = '';
  private conversationBook: ConversationBook = { active: '', sessions: [] };
  private richChats = new Map<string, ChatMessage[]>();
  private drawButton?: HTMLButtonElement; private drawBar?: HTMLElement; private drawing?: DrawingInput; private drawColor = '#111111'; private drawWidth = 8;
  imageDraft = ''; imageModelId = ''; directImageBusy = false;
  private imageDialog?: ImageGenerateDialog;
  chat: ChatMessage[] = []; busy = false; progress = ''; private centerEl?: HTMLElement; private progressEl?: HTMLElement; onChat?: () => void; /** Redraws the composer chip when the canvas pick changes. */ onSelection?: () => void; private lastPrompt = ''; currentPattern?: string; private lastSpec?: DesignSpec; palette?: import('./templates').Palette; private templateId?: string;

  constructor(leaf: WorkspaceLeaf, public plugin: CoverPlugin) { super(leaf); }
  getViewType(): string { return VIEW; }
  getDisplayText(): string { return this.file?.basename || this.plugin.t('open'); }
  getIcon(): string { return COVER_ICON; }
  get doc(): Document { return this.contentEl.ownerDocument; }
  get win(): Window & typeof globalThis { return this.doc.defaultView as Window & typeof globalThis; }
  t(key: Key, params?: Record<string, string | number>): string { return this.plugin.t(key, params); }
  get zh(): boolean { return this.plugin.isZh(); }
  async onOpen(): Promise<void> { this.contentEl.addClass('qc-root'); this.containerEl.addClass('qc-headerless'); this.plugin.ai.warm(); }

  /* ---------- lifecycle ---------- */
  async onLoadFile(file: TFile): Promise<void> {
    this.drawing?.dispose(); this.drawing = undefined;
    this.imageDialog?.close();
    const generation = ++this.generation; this.closingView = false; this.restoring = true; this.dirty = false;
    try {
      const raw = await this.app.vault.read(file); const design = parseDesign(raw);
      if (generation !== this.generation) return;
      this.expected = raw; this.design = design; this.noteContext = undefined; this.noteState = 'pending'; this.templateId = design.template; this.palette = design.palette; this.codec = new SnapshotCodec(); this.history = new History(); this.busy = false; this.inTurn = false; this.turnSelection = undefined; this.turnSelectedObjects = [];
      await this.plugin.fonts.register(this.doc);
      this.build();
      if (generation !== this.generation || !this.canvas) return;
      await this.canvas.loadFromJSON(design.canvas);
      await this.afterLoad();
      if (generation !== this.generation || !this.canvas) return;
      this.history.reset(this.snapshot()); this.restoring = false; this.baseRevision = this.revision;
      // The conversation picks up where this cover left off; rich payloads (variants, snapshots) start empty.
      this.richChats.clear();
      this.conversationBook = structuredClone(this.plugin.settings.conversations[file.path] ?? (() => {
        const session = newConversation(savedMessages(this.plugin.settings.chats[file.path])); return { active: session.id, sessions: [session] };
      })());
      const session = this.conversationBook.sessions.find(s => s.id === this.conversationBook.active)!;
      this.chat = session.messages.map(m => ({ ...m })); this.chatDraft = session.draft; this.richChats.set(session.id, this.chat);
      this.resetConversationContext();
      this.applyZoom(); this.refreshAll(); this.setStatus('saved');
      const brief = this.plugin.takeBrief(file.path); if (brief) void this.autoDesign(brief);
      this.unsubscribeFonts = this.plugin.fonts.onChange(() => { void this.reflowFonts(); this.refreshInspector(true); });
    } catch (e) {
      this.restoring = true; this.contentEl.empty(); this.contentEl.createEl('p', { text: this.t('invalidDesign')+' '+(e instanceof Error?e.message:String(e)), cls: 'qc-invalid-note' }); this.plugin.report(e);
    }
  }
  async onUnloadFile(): Promise<void> {
    this.drawing?.dispose(); this.drawing = undefined;
    this.closingView = true; ++this.generation;
    this.imageDialog?.close();
    if (this.design && !this.restoring) await this.saveChatNow();
    this.closingView = true; this.clearTimers(); this.unsubscribeFonts?.(); this.unsubscribeFonts = undefined;
    const untouched = !!this.file && this.plugin.scratch.has(this.file.path) && this.revision === this.baseRevision && !this.conversations.some(s => s.messages.length || s.draft.trim());
    this.commitHistory(); await this.flush();
    if (untouched && this.file) { this.plugin.scratch.delete(this.file.path); try { await this.app.fileManager.trashFile(this.file); } catch { /* leave the file if it cannot be removed */ } this.dirty = false; }
    if (this.dirty && this.canvas && this.file && this.design && !this.restoring) {
      const folder = folderPath(this.plugin.settings.designFolder);
      await this.plugin.ensureFolder(folder);
      const recovery = await this.app.vault.create(this.plugin.unique(folder, `${this.file.basename} recovery ${Date.now()}`, 'qcover'), JSON.stringify(this.currentDesign(), null, 2));
      new Notice(this.t('recovered', { path: recovery.path }));
      this.dirty = false;
    }
    this.observer?.disconnect(); this.observer = undefined;
    if (this.canvas) await this.canvas.dispose();
    this.canvas = undefined; this.design = undefined; this.contentEl.empty();
  }
  async onClose(): Promise<void> { if (this.canvas) await this.onUnloadFile(); }
  private clearTimers(): void {
    const w = this.win;
    if (this.resizeFrame !== undefined) w?.cancelAnimationFrame(this.resizeFrame); this.resizeFrame = undefined;
    if (this.saveTimer !== undefined) w?.clearTimeout(this.saveTimer); this.saveTimer = undefined;
    if (this.historyTimer !== undefined) w?.clearTimeout(this.historyTimer);
    this.historyTimer = undefined;
    if (this.chatTimer !== undefined) w?.clearTimeout(this.chatTimer);
    this.chatTimer = undefined;
  }
  private chatTimer?: number;
  get conversations(): readonly DesignerConversation[] { return this.conversationBook.sessions; }
  get activeConversation(): DesignerConversation | undefined { return this.conversationBook.sessions.find(s => s.id === this.conversationBook.active); }
  private resetConversationContext(): void { this.lastPrompt = ''; this.currentPattern = undefined; this.lastSpec = undefined; this.pictureRequested = false; }
  private stashConversation(): void {
    const session = this.activeConversation, path = this.file?.path; if (!session || !path) return;
    session.messages = savedMessages(this.chat); session.draft = this.chatDraft; session.updatedAt = Date.now();
    if (!session.title) session.title = conversationTitle(session.messages);
    this.richChats.set(session.id, this.chat);
    this.plugin.settings.conversations[path] = structuredClone(this.conversationBook);
  }
  async saveChatNow(): Promise<void> {
    if (this.chatTimer !== undefined) this.win.clearTimeout(this.chatTimer); this.chatTimer = undefined;
    this.stashConversation(); await this.plugin.saveSettings();
  }
  /** Save before switching, so a pending debounce cannot write one thread into another. */
  async newChat(): Promise<void> {
    if (this.busy || this.restoring || this.closingView) return;
    if (!this.chat.length && !this.chatDraft.trim()) { this.resetConversationContext(); this.focusChat(); return; }
    if (this.conversations.length >= 30) { new Notice(this.t('chatLimit')); return; }
    await this.saveChatNow(); const session = newConversation(); this.conversationBook.sessions.unshift(session); this.conversationBook.active = session.id;
    this.chat = []; this.chatDraft = ''; this.resetConversationContext(); await this.saveChatNow(); this.refreshDrawer(); this.focusChat();
  }
  async switchConversation(id: string): Promise<void> {
    if (this.busy || this.restoring || this.closingView || id === this.conversationBook.active) return;
    const session = this.conversationBook.sessions.find(s => s.id === id); if (!session) return;
    await this.saveChatNow(); this.conversationBook.active = id; this.chat = this.richChats.get(id) ?? session.messages.map(m => ({ ...m })); this.chatDraft = session.draft;
    this.resetConversationContext(); this.lastPrompt = [...this.chat].reverse().find(m => m.role === 'user')?.text ?? ''; await this.saveChatNow(); this.refreshDrawer(); this.focusChat();
  }
  /** Drops one exchange (the prompt and every reply to it) from the thread and from the model's context. The canvas is untouched. */
  async deleteTurn(index: number): Promise<void> {
    if (this.busy || this.restoring || !this.chat[index]) return;
    let start = index; while (start > 0 && this.chat[start]!.role !== 'user') start--;
    if (this.chat[start]!.role !== 'user') start = index;
    let end = index + 1; while (end < this.chat.length && this.chat[end]!.role !== 'user') end++;
    this.chat.splice(start, end - start);
    this.resetConversationContext();
    this.lastPrompt = [...this.chat].reverse().find(m => m.role === 'user')?.text ?? '';
    await this.saveChatNow(); this.onChat?.();
  }
  async retryTurn(index: number): Promise<void> {
    const prompt = this.chat[index - 1]?.role === 'user' ? this.chat[index - 1]!.text : '';
    if (!prompt || this.busy || this.restoring || this.closingView) return;
    const generation = this.generation, conversation = this.activeConversation?.id;
    await this.deleteTurn(index);
    if (generation !== this.generation || conversation !== this.activeConversation?.id || this.closingView) return;
    await this.ask(prompt);
  }
  async renameConversation(title: string): Promise<void> { if (this.busy || !this.activeConversation || !title.trim()) return; this.activeConversation.title = title.trim().slice(0, 80); await this.saveChatNow(); this.onChat?.(); }
  async deleteConversation(): Promise<void> {
    if (this.busy || !this.activeConversation) return; const id = this.activeConversation.id;
    this.conversationBook.sessions = this.conversationBook.sessions.filter(s => s.id !== id); this.richChats.delete(id);
    if (!this.conversations.length) this.conversationBook.sessions.push(newConversation());
    const session = this.conversationBook.sessions[0]!; this.conversationBook.active = session.id;
    this.chat = this.richChats.get(session.id) ?? session.messages.map(m => ({ ...m })); this.chatDraft = session.draft; this.resetConversationContext();
    await this.saveChatNow(); this.refreshDrawer(); this.focusChat();
  }
  /** A direction gets its own canvas. Historical snapshots never overwrite the original artwork. */
  async branchConversation(index?: number): Promise<void> {
    if (this.busy || this.restoring || !this.file || !this.design) return;
    const message = index === undefined ? undefined : this.chat[index];
    const design = message?.snapshot ? this.codec.decode(message.snapshot) : this.currentDesign();
    const messages = index === undefined ? [] : savedMessages(this.chat.slice(0, index + 1));
    const sourceName = this.file.basename; await this.saveChatNow();
    const file = await this.plugin.duplicateDesign(`${sourceName} ${this.t('chatDirection')}`, design);
    const target = this.app.workspace.getLeavesOfType(VIEW).map(l => l.view).find((v): v is CoverView => v instanceof CoverView && v.file?.path === file.path);
    if (target) { const session = newConversation(messages); target.conversationBook = { active: session.id, sessions: [session] }; target.chat = session.messages.map(m => ({ ...m })); target.chatDraft = ''; target.resetConversationContext(); await target.saveChatNow(); target.refreshDrawer(); target.focusChat(); }
  }
  async blankConversation(): Promise<void> {
    if (this.busy || this.restoring || !this.design) return; await this.saveChatNow();
    const { width, height, platform } = this.design;
    await this.plugin.duplicateDesign(this.t('untitled'), { format: 'qiaomu-cover-design', schema: 1, width, height, platform, bg: { kind: 'solid', color: '#ffffff' }, canvas: { version: '7.4.0', background: '#ffffff', objects: [] } });
  }
  private focusChat(): void { this.contentEl.querySelector<HTMLTextAreaElement>('.qc-chat-input')?.focus({ preventScroll: true }); }
  /** Save only the active book; archived sessions never enter the model's input. */
  persistChat(): void {
    const w = this.win; if (this.chatTimer !== undefined) w.clearTimeout(this.chatTimer);
    this.stashConversation();
    this.chatTimer = w.setTimeout(() => {
      this.chatTimer = undefined;
      void this.plugin.saveSettings();
    }, 800);
  }
  private setStatus(key: Key): void {
    // Saving is automatic, so it stays silent; only a failure is worth a word.
    this.statusEl?.setText(key === 'failed' ? this.t(key) : ''); this.statusEl?.setAttribute('data-state', key);
  }
  async action(fn: () => void | Promise<unknown>): Promise<void> {
    if (this.task || this.restoring || this.closingView) return;
    this.task = true;
    try { await fn(); } catch (e) { this.plugin.report(e); } finally { this.task = false; }
  }

  /* ---------- layout ---------- */
  private build(): void {
    this.drawing?.dispose(); this.drawing = undefined;
    if (this.canvas) void this.canvas.dispose();
    if (this.resizeFrame !== undefined) this.win.cancelAnimationFrame(this.resizeFrame); this.resizeFrame = undefined;
    this.observer?.disconnect(); this.contentEl.empty();
    const design = this.design!; const root = this.contentEl;
    const header = root.createDiv('qc-header');
    const left = header.createDiv('qc-header-left');
    iconButton(left, 'panel-left', this.t('togglePanel'), () => this.toggleDrawer());
    this.platformBtn = left.createEl('button', { cls: 'qc-platform', attr: { type: 'button' } });
    this.platformBtn.addEventListener('click', e => this.platformMenu(e));
    const tools = header.createDiv('qc-header-tools');
    const create = tools.createDiv('qc-header-create');
    const generate = textButton(create, this.t('aiGenerateImage'), () => this.openImageGenerator(), 'qc-btn-sm qc-ai-image-btn', 'image');
    const imageIcon = generate.querySelector('.qc-btn-icon') as HTMLElement;
    setIcon(imageIcon.createSpan('qc-image-sparkles-icon'), 'sparkles');
    generate.setAttribute('aria-label', this.t('aiGenerateImage'));
    for (const [category, zh, en, icon] of [['text', '文字', 'Text', 'type'], ['asset', '素材', 'Assets', 'smile-plus'], ['shape', '形状', 'Shapes', 'shapes']] as const) {
      const button = textButton(create, this.zh ? zh : en, () => { this.setDrawing(false); openInsertPopover(this, button, category); }, `qc-btn-sm qc-insert-btn qc-insert-${category}`, icon);
      button.setAttribute('aria-label', this.zh ? zh : en);
    }
    this.drawButton = textButton(create, this.zh ? '画笔' : 'Draw', () => this.setDrawing(!this.canvas?.isDrawingMode), 'qc-btn-sm qc-draw-btn', 'pen-tool');
    this.drawButton.setAttribute('aria-pressed','false');
    textButton(create,this.zh?'图库':'Image library',()=>{this.setDrawing(false);this.plugin.openGallery('images',this);},'qc-btn-sm qc-gallery-trigger','gallery-horizontal-end');
    const mid = tools.createDiv('qc-header-mid');
    this.undoBtn = iconButton(mid, 'undo-2', this.t('undo'), () => void this.action(() => this.travel(-1)));
    this.redoBtn = iconButton(mid, 'redo-2', this.t('redo'), () => void this.action(() => this.travel(1)));
    mid.createSpan({ cls: 'qc-sep' });
    const g = this.plugin.settings.guides;
    toggleButton(mid, 'shield-check', this.t('safeZone'), g.safe, v => { g.safe = v; this.guidesChanged(); });
    toggleButton(mid, 'crosshair', this.t('centerLines'), g.center, v => { g.center = v; this.guidesChanged(); });
    toggleButton(mid, 'grid', this.t('grid'), g.grid, v => { g.grid = v; this.guidesChanged(); });
    toggleButton(mid, 'magnet', this.t('snap'), g.snap, v => { g.snap = v; this.guidesChanged(); });
    const right = header.createDiv('qc-header-right');
    this.statusEl = right.createSpan({ cls: 'qc-status' });
    iconButton(right, 'more-horizontal', this.t('more'), e => this.moreMenu(e));
    const copyBtn = textButton(right, this.zh ? '复制' : 'Copy', () => void this.copyToClipboard(copyBtn), 'qc-btn-sm', 'copy');
    copyBtn.setAttribute('aria-label', this.zh ? '复制图片到剪贴板，可直接粘贴到别的应用（⌘⇧C）' : 'Copy the image to the clipboard (⌘⇧C)');
    const exportGroup = right.createDiv('qc-split');
    textButton(exportGroup, this.t('export'), () => void this.action(() => this.openExport()), 'qc-primary', 'download');
    iconButton(exportGroup, 'chevron-down', this.t('exportMore'), e => this.exportMenu(e), 'qc-primary qc-split-more');

    const main = root.createDiv('qc-main');
    this.drawerEl = main.createDiv('qc-drawer');
    const center = main.createDiv('qc-center'); this.centerEl = center;
    this.drawBar = center.createDiv('qc-draw-bar'); this.drawBar.hidden = true; this.drawingOptions();
    this.stage = center.createDiv('qc-stage'); this.stage.tabIndex = 0;
    const element = this.stage.createEl('canvas');
    const win = this.win;
    setEnv({ ...getEnv(), document: this.doc, window: win });
    this.canvas = new Canvas(element, { width: design.width, height: design.height, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(13,153,255,0.10)', selectionBorderColor: '#0d99ff', selectionLineWidth: 1, uniformScaling: true });
    Object.assign(FabricObject.ownDefaults, { cornerStyle: 'circle', cornerColor: '#ffffff', cornerStrokeColor: '#0d99ff', borderColor: '#0d99ff', transparentCorners: false, cornerSize: 10, touchCornerSize: 24, padding: 3, borderScaleFactor: 1.5, originX: 'left', originY: 'top' });
    this.bindCanvas();
    this.drawing = bindDrawing(this.stage, this.canvas, () => ({ color: this.drawColor, width: this.drawWidth }));
    const wrapper = enhance(this.canvas.wrapperEl);
    // Clicking the grey area around the artboard deselects, like every design tool. Panels on either side keep the selection because they edit it.
    this.register(bindMarquee(this.stage, this.canvas, design.width, design.height));
    this.guidesEl = wrapper.createDiv('qc-guides'); this.snapEl = wrapper.createDiv('qc-snaplines');
    this.zoomBar(center);
    this.inspectorEl = main.createDiv('qc-inspector');
    const tabs = this.inspectorEl.createDiv('qc-tabs'); const body = this.inspectorEl.createDiv('qc-inspector-body');
    this.tabsEl = tabs;
    for (const id of ['design', 'layers', 'canvas'] as const) {
      const b = tabs.createEl('button', { cls: 'qc-tab', attr: { type: 'button', 'data-tab': id } }); b.setText(this.t(id === 'design' ? 'tabDesign' : id === 'layers' ? 'layers' : 'tabCanvas'));
      b.classList.toggle('is-active', this.rightTab === id);
      b.addEventListener('click', () => { this.rightTab = id; this.syncTabs(); this.refreshInspector(true); });
    }
    this.inspectorBody = body;
    this.observer = new win.ResizeObserver(() => {
      // Fit writes layout; defer it out of ResizeObserver's delivery cycle and coalesce resizes.
      if (this.resizeFrame !== undefined) return;
      this.resizeFrame = win.requestAnimationFrame(() => { this.resizeFrame = undefined; if (!this.canvas || this.closingView) return; this.refreshToolbar(); if (this.zoom === 'fit') this.applyZoom(); });
    });
    this.observer.observe(this.stage);
    this.registerStageEvents();
    this.updatePlatformLabel(); this.updateHistoryButtons();
  }
  inspectorBody?: HTMLElement;

  private zoomBar(center: HTMLElement): void {
    const bar = center.createDiv('qc-zoombar');
    iconButton(bar, 'minus', this.t('zoomOut'), () => this.zoomBy(1 / 1.2));
    this.zoomLabel = bar.createEl('button', { cls: 'qc-zoom-label', attr: { type: 'button' } });
    this.zoomLabel.addEventListener('click', () => this.zoomMenu(this.zoomLabel!));
    iconButton(bar, 'plus', this.t('zoomIn'), () => this.zoomBy(1.2));
    iconButton(bar, 'scan', this.t('zoom'), () => this.setZoom('fit'));
  }
  private zoomMenu(anchor: HTMLElement): void {
    const m = new Menu();
    for (const z of [0.25, 0.5, 0.75, 1, 1.5, 2]) m.addItem(i => i.setTitle(`${Math.round(z * 100)}%`).setChecked(this.zoom === z).onClick(() => this.setZoom(z)));
    m.addSeparator(); m.addItem(i => i.setTitle(this.t('zoom')).setIcon('scan').onClick(() => this.setZoom('fit')));
    const r = anchor.getBoundingClientRect(); m.showAtPosition({ x: r.left, y: r.top });
  }
  fitScale(): number {
    if (!this.stage || !this.design) return 1;
    const style = this.win.getComputedStyle(this.stage); const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0); const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const w = Math.max(120, this.stage.clientWidth - padX), h = Math.max(120, this.stage.clientHeight - padY);
    return Math.min(w / this.design.width, h / this.design.height, 1);
  }
  currentScale(): number { return this.zoom === 'fit' ? this.fitScale() : this.zoom; }
  applyZoom(): void {
    if (!this.canvas || !this.design || !mountedCanvasSize(this.stage)) return;
    const scale = this.currentScale();
    this.canvas.setDimensions({ width: Math.round(this.design.width * scale), height: Math.round(this.design.height * scale) });
    this.canvas.setZoom(scale); this.canvas.calcOffset(); this.canvas.requestRenderAll();
    this.zoomLabel?.setText(`${Math.round(scale * 100)}%`);
  }
  setZoom(z: number | 'fit'): void { this.zoom = z === 'fit' ? 'fit' : Math.min(4, Math.max(0.1, z)); this.applyZoom(); }
  zoomBy(factor: number): void { this.setZoom(Math.round(this.currentScale() * factor * 100) / 100); }

  private updatePlatformLabel(): void {
    if (!this.platformBtn || !this.design) return;
    this.platformBtn.empty();
    const p = platformFor(this.design.width, this.design.height, this.design.platform);
    const name = p ? (this.zh ? p.zh : p.en) : this.t('custom');
    this.platformBtn.createSpan({ text: name, cls: 'qc-platform-name' });
    this.platformBtn.createSpan({ text: `${this.design.width} × ${this.design.height}`, cls: 'qc-platform-size' });
  }
  private platformMenu(e: MouseEvent): void {
    const m = new Menu(); const cur = platformFor(this.design!.width, this.design!.height, this.design!.platform);
    const groups: [string, string][] = [['social', this.t('groupSocial')], ['video', this.t('groupVideo')], ['general', this.t('groupGeneral')]];
    for (const [id, label] of groups) {
      m.addItem(i => i.setTitle(label).setIsLabel(true));
      for (const p of PLATFORMS.filter(x => x.group === id)) m.addItem(i => i.setTitle(`${this.zh ? p.zh : p.en}  ·  ${p.width}×${p.height}`).setIcon(p.icon).setChecked(cur?.id === p.id).onClick(() => { this.setPlatform(p.id); }));
    }
    m.addSeparator(); m.addItem(i => i.setTitle(this.t('customSize')).setIcon('ruler').onClick(() => new SizeModal(this).open()));
    m.showAtMouseEvent(e);
  }
  private moreMenu(e: MouseEvent): void {
    const m = new Menu();
    m.addItem(i => i.setTitle(this.t('aiGenerateImage')).setIcon('image-plus').onClick(() => this.openImageGenerator()));
    m.addItem(i => i.setTitle(this.t('duplicateDesign')).setIcon('copy-plus').onClick(() => void this.action(() => this.plugin.duplicateDesign(`${this.file!.basename} copy`, this.currentDesign()))));
    m.addItem(i => i.setTitle(this.t('renameDesign')).setIcon('pencil').onClick(() => { if (this.file) new RenameModal(this.plugin, this.file).open(); }));
    m.addItem(i => i.setTitle(this.t('newCover')).setIcon('image-plus').onClick(() => this.plugin.openNew()));
    m.addItem(i => i.setTitle(this.t('openOther')).setIcon('folder-open').onClick(() => this.plugin.chooseDesign()));
    m.addItem(i=>i.setTitle(this.zh?'打开笔记或工程':'Open note or project').setIcon('file-text').onClick(()=>this.plugin.openWorkspaceFiles()));
    m.addItem(i=>i.setTitle(this.zh?'导入工程、笔记与附件':'Import projects, notes and assets').setIcon('folder-input').onClick(()=>this.plugin.importFiles()));
    m.addItem(i=>i.setTitle(this.zh?'导入原版工作区文件夹':'Import original workspace folder').setIcon('folder-input').onClick(()=>this.plugin.importFiles(true)));
    m.addItem(i=>i.setTitle(this.zh?'导入原版设置 data.json':'Import original data.json settings').setIcon('file-json').onClick(()=>this.plugin.importSettings()));
    m.addSeparator();
    m.addItem(i => i.setTitle(this.t('fontsManage')).setIcon('a-large-small').onClick(() => this.plugin.openSettings('fonts')));
    m.addItem(i => i.setTitle(this.t('shortcuts')).setIcon('keyboard').onClick(() => new ShortcutsModal(this.plugin).open()));
    m.addItem(i => i.setTitle(this.t('settings')).setIcon('settings').onClick(() => this.plugin.openSettings()));
    m.showAtMouseEvent(e);
  }
  private exportMenu(e: MouseEvent): void {
    const m = new Menu();
    m.addItem(i => i.setTitle(this.t('quickExport')).setIcon('zap').onClick(() => void this.action(() => this.quickExport())));
    m.addItem(i => i.setTitle(this.t('copy')).setIcon('clipboard-copy').onClick(() => void this.action(() => this.copyPng())));
    if (this.design?.source) m.addItem(i => i.setTitle(this.t('insert')).setIcon('file-input').onClick(() => void this.action(() => this.exportWith({ ...this.exportPrefs(), insert: true }))));
    m.addItem(i => i.setTitle(this.t('exportAs')).setIcon('sliders-horizontal').onClick(() => void this.action(() => this.openExport())));
    m.showAtMouseEvent(e);
  }

  /* ---------- canvas events ---------- */
  private bindCanvas(): void {
    const c = this.canvas!;
    c.on('before:path:created',()=>this.commitHistory());
    c.on('path:created',e=>{(e.path as QObject).qcName=this.zh?'笔迹':'Brush stroke';this.changed();this.commitHistory();void this.flush();});
    c.on('object:modified', () => this.changed()); c.on('object:added', () => this.changed()); c.on('object:removed', () => this.changed());
    c.on('text:changed', e => { const t = e.target as (Textbox & QObject) | undefined; if (t) { t.splitByGrapheme = hasCjk(t.text); this.rehug(t); } this.changed(); });
    for (const ev of ['selection:created', 'selection:updated', 'selection:cleared'] as const) c.on(ev, () => { this.refreshInspector(true); this.onSelection?.(); });
    c.on('object:moving', e => { if (this.plugin.settings.guides.snap && e.target) this.snapMove(e.target); });
    c.on('mouse:up', () => this.clearSnap()); c.on('mouse:down', () => this.clearSnap());
    c.on('text:editing:exited', () => this.refreshInspector(true));
  }
  private setDrawing(active: boolean): void {
    const c = this.canvas; if (!c || !this.drawing || c.isDrawingMode === active) return;
    this.drawing.setActive(active);
    this.drawButton?.setAttribute('aria-pressed', String(active)); this.drawButton?.classList.toggle('is-active', active);
    if (this.drawBar) this.drawBar.hidden = !active;
    if (active) { this.commitHistory(); c.discardActiveObject(); this.clearSnap(); }
    else this.drawBar?.querySelectorAll('.qc-color-trigger[aria-expanded="true"]').forEach(() => this.doc.querySelector('.qc-color-popover')?.dispatchEvent(new this.win.Event('qc-close')));
    c.requestRenderAll(); if (this.zoom === 'fit') this.applyZoom(); this.stage?.focus({ preventScroll: true });
  }
  private drawingOptions(): void {
    const bar = this.drawBar; if (!bar) return;
    bar.empty(); bar.setAttribute('role', 'toolbar'); quietName(bar, this.zh ? '画笔设置' : 'Brush settings');
    const colors = bar.createDiv('qc-draw-colors'); quietName(colors, this.zh ? '画笔颜色' : 'Brush color');
    const sync = (): void => { for (const el of Array.from(colors.querySelectorAll<HTMLButtonElement>('[data-color]'))) el.setAttribute('aria-pressed', String(el.dataset.color === this.drawColor)); };
    for (const [color, zh, en] of [['#111111', '黑色', 'Black'], ['#ffffff', '白色', 'White'], ['#e11d2e', '红色', 'Red'], ['#f97316', '橙色', 'Orange'], ['#ffe04b', '黄色', 'Yellow'], ['#16a34a', '绿色', 'Green'], ['#2563eb', '蓝色', 'Blue'], ['#7c3aed', '紫色', 'Purple']]) {
      const b = colors.createEl('button', { cls: 'qc-draw-swatch', attr: { type: 'button', 'data-color': color! } }); b.style.backgroundColor = color!; quietName(b, this.zh ? zh! : en!); b.addEventListener('click', () => { this.drawColor = color!; sync(); });
    }
    const custom = colorControl(bar, this.zh ? '自定义颜色' : 'Custom color', this.drawColor, color => { this.drawColor = color; sync(); }, { zh: this.zh, doc: this.doc }); custom.addClass('qc-draw-custom');
    const widths = bar.createDiv('qc-draw-widths'); quietName(widths, this.zh ? '画笔粗细' : 'Brush width');
    const input = widths.createEl('input', { type: 'number', attr: { min: '1', max: '100', step: '1' } }); input.value = String(this.drawWidth); quietName(input, this.zh ? '粗细（画布像素）' : 'Width in canvas pixels', widths);
    const syncWidth = (): void => { input.value = String(this.drawWidth); for (const el of Array.from(widths.querySelectorAll<HTMLButtonElement>('[data-width]'))) el.setAttribute('aria-pressed', String(Number(el.dataset.width) === this.drawWidth)); };
    for (const width of [3, 8, 16]) { const b = widths.createEl('button', { cls: 'qc-draw-size', attr: { type: 'button', 'data-width': String(width) } }); const dot = b.createSpan(); dot.style.width = `${width}px`; dot.style.height = `${width}px`; quietName(b, `${width} px`); b.addEventListener('click', () => { this.drawWidth = width; syncWidth(); }); }
    widths.createSpan({ text: 'px', cls: 'qc-draw-unit' });
    input.addEventListener('input', () => { const n = Number(input.value); if (input.value && Number.isFinite(n) && n >= 1 && n <= 100) { this.drawWidth = n; for (const el of Array.from(widths.querySelectorAll<HTMLButtonElement>('[data-width]'))) el.setAttribute('aria-pressed', String(Number(el.dataset.width) === n)); } });
    textButton(bar, this.zh ? '完成' : 'Done', () => this.setDrawing(false), 'qc-btn-sm qc-draw-done', 'check'); sync(); syncWidth();
  }
  private registerStageEvents(): void {
    const stage = this.stage!;
    this.registerDomEvent(this.contentEl, 'keydown', (e: KeyboardEvent) => this.keyboard(e));
    this.registerDomEvent(stage, 'wheel', (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); } }, { passive: false });
    // Capture before Fabric's default stopContextMenu swallows the event.
    this.registerDomEvent(stage, 'contextmenu', (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); this.contextMenu(e); }, { capture: true });
    this.registerDomEvent(this.contentEl, 'paste', (e: ClipboardEvent) => this.onPaste(e));
    this.registerDomEvent(stage, 'dragover', (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); stage.addClass('is-drop'); } });
    this.registerDomEvent(stage, 'dragleave', () => stage.removeClass('is-drop'));
    this.registerDomEvent(stage, 'drop', (e: DragEvent) => { e.preventDefault(); stage.removeClass('is-drop'); void this.action(() => this.onDrop(e)); });
  }
  private async onDrop(e: DragEvent): Promise<void> {
    const files = Array.from(e.dataTransfer?.files ?? []);
    const images = files.filter(f => /^image\/(png|jpeg|webp)$/.test(f.type)); const fonts = files.filter(f => /\.(ttf|otf|woff2?)$/i.test(f.name));
    if (fonts.length) { const added = await this.plugin.fonts.importFiles(fonts, this.doc); if (added.length) new Notice(this.t('fontsImported', { names: added.join(', ') })); }
    for (const file of images) await this.importImage(file);
  }
  private onPaste(e: ClipboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input,textarea,select,[contenteditable="true"]') || this.canvas?.getActiveObjects().some(o => o instanceof Textbox && o.isEditing)) return;
    const image = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'));
    e.preventDefault();
    if (image) void this.action(() => this.importImage(image)); else void this.action(() => this.pasteObjects());
  }
  private contextMenu(e: MouseEvent): void {
    this.setDrawing(false);
    const c = this.canvas; if (!c || this.restoring) return;
    const hit = c.findTarget(e).target;
    if (hit && hit !== c.getActiveObject() && !c.getActiveObjects().includes(hit)) { c.setActiveObject(hit); c.requestRenderAll(); }
    const has = c.getActiveObjects().length > 0; const m = new Menu().setUseNativeMenu(false).setParentElement(this.stage!);
    if (has) {
      const selected = c.getActiveObject();
      m.addItem(i => i.setTitle(this.t('imageEditSelection')).setIcon('image-pen').onClick(() => void this.action(() => this.openSelectionImageGenerator())));
      m.addItem(i => i.setTitle(this.t('downloadSelection')).setIcon('download').onClick(() => void this.action(() => this.downloadSelection())));
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('renameLayers')).setIcon('pencil').onClick(() => renameLayersDialog(this, c.getActiveObjects())));
      if (c.getActiveObjects().length > 1) m.addItem(i => i.setTitle(this.t('groupLayers')).setIcon('group').setDisabled(c.getActiveObjects().some(o => o.parent !== c.getActiveObjects()[0]!.parent || o.lockMovementX || o.lockMovementY)).onClick(() => this.groupLayers()));
      if ((selected as QObject | undefined)?.qcLayerGroup) m.addItem(i => i.setTitle(this.t('ungroupLayers')).setIcon('ungroup').onClick(() => this.ungroupLayers()));
      m.addItem(i => i.setTitle(this.t('copyObj')).setIcon('copy').onClick(() => void this.action(() => this.copyObjects())));
      m.addItem(i => i.setTitle(this.t('duplicate')).setIcon('copy-plus').onClick(() => void this.action(() => this.cloneSelection())));
    }
    m.addItem(i => i.setTitle(this.t('paste')).setIcon('clipboard-paste').onClick(() => void this.action(() => this.pasteObjects())));
    if (has) {
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('front')).setIcon('bring-to-front').onClick(() => this.order('front')));
      m.addItem(i => i.setTitle(this.t('forward')).setIcon('arrow-up').onClick(() => this.order('forward')));
      m.addItem(i => i.setTitle(this.t('backward')).setIcon('arrow-down').onClick(() => this.order('backward')));
      m.addItem(i => i.setTitle(this.t('back')).setIcon('send-to-back').onClick(() => this.order('back')));
      m.addSeparator();
      m.addItem(i => i.setTitle(this.t('centerH')).setIcon('align-center-vertical').onClick(() => this.align('center')));
      m.addItem(i => i.setTitle(this.t('centerV')).setIcon('align-center-horizontal').onClick(() => this.align('middle')));
      m.addSeparator();
      const locked = c.getActiveObjects().every(o => o.lockMovementX);
      m.addItem(i => i.setTitle(this.zh ? (locked ? '解锁' : '锁定') : (locked ? 'Unlock' : 'Lock')).setIcon(locked ? 'lock-keyhole-open' : 'lock-keyhole').onClick(() => this.toggleLock()));
      m.addItem(i => i.setTitle(this.t('remove')).setIcon('trash-2').setWarning(true).onClick(() => this.removeSelection()));
    }
    m.showAtMouseEvent(e);
  }

  /* ---------- guides and snapping ---------- */
  private guidesChanged(): void { void this.plugin.saveSettings(); this.renderGuides(); }
  renderGuides(): void {
    const el = this.guidesEl; if (!el || !this.design) return; el.empty();
    const g = this.plugin.settings.guides; const d = this.design; const p = platformFor(d.width, d.height, d.platform);
    if (g.grid) { el.createDiv('qc-guide-grid'); }
    if (g.center) { el.createDiv('qc-guide-v'); el.createDiv('qc-guide-h'); }
    if (g.safe) {
      const margin = (p?.margin ?? 0.05) * Math.min(d.width, d.height);
      const box = el.createDiv('qc-safe'); box.style.inset = `${(margin / d.height) * 100}% ${(margin / d.width) * 100}%`;
      for (const z of p?.avoid ?? []) {
        const zone = el.createDiv('qc-avoid'); zone.style.cssText = `left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%`;
        zone.createSpan({ text: this.zh ? z.zh : z.en });
      }
    }
  }
  /** Guide lines gathered once per drag. Decorative layers (grain, glows, scrims, full-bleed pictures) are not snap targets, which also keeps dragging cheap. */
  private snapCache?: { xs: number[]; ys: number[]; stickyX?: SnapHit; stickyY?: SnapHit; shownX?: number; shownY?: number };
  private snapLines(): { xs: number[]; ys: number[] } {
    const c = this.canvas!, d = this.design!; const active = new Set<FabricObject>();
    for (const object of c.getActiveObjects()) { active.add(object); for (let parent = object.parent; parent; parent = parent.parent) active.add(parent); }
    const p = platformFor(d.width, d.height, d.platform); const margin = (p?.margin ?? 0.05) * Math.min(d.width, d.height);
    const xs = [0, d.width / 2, d.width, margin, d.width - margin]; const ys = [0, d.height / 2, d.height, margin, d.height - margin];
    for (const o of c.getObjects()) {
      const role = (o as QObject).qcRole; if (active.has(o) || !o.visible || role === 'grain' || role === 'bgfx' || role === 'scrim' || role === 'ghost' || role === 'flourish') continue;
      const r = o.getBoundingRect(); if (r.width * r.height > d.width * d.height * 0.6) continue;
      xs.push(r.left, r.left + r.width / 2, r.left + r.width); ys.push(r.top, r.top + r.height / 2, r.top + r.height);
    }
    return { xs, ys };
  }
  private snapMove(target: FabricObject): void {
    const c = this.canvas!, d = this.design!; const th = 6 / c.getZoom(); this.snapCache ??= this.snapLines(); const cache = this.snapCache;
    // Fabric fires moving before refreshing aCoords. Bounds from the previous frame
    // feed the snap correction back into the next frame and produce oscillation.
    target.setCoords(); const b = target.getBoundingRect();
    const sx = target.lockMovementX ? undefined : snapAxis([b.left, b.left + b.width / 2, b.left + b.width], cache.xs, th, cache.stickyX);
    const sy = target.lockMovementY ? undefined : snapAxis([b.top, b.top + b.height / 2, b.top + b.height], cache.ys, th, cache.stickyY);
    cache.stickyX = sx; cache.stickyY = sy;
    if (sx || sy) {
      // Bounding rectangles live in world coordinates; nested elements move in parent coordinates.
      const delta = new Point(sx?.delta ?? 0, sy?.delta ?? 0);
      const local = target.group ? delta.transform(util.invertTransform(target.group.calcTransformMatrix()), true) : delta;
      target.set({ left: target.left + local.x, top: target.top + local.y }); target.setCoords();
    }
    const el = this.snapEl; if (!el) return;
    if (cache.shownX === sx?.line && cache.shownY === sy?.line) return; // only touch the DOM when the visible guides change
    cache.shownX = sx?.line; cache.shownY = sy?.line; el.empty();
    if (sx) { const l = el.createDiv('qc-snap-v'); l.style.left = `${(sx.line / d.width) * 100}%`; }
    if (sy) { const l = el.createDiv('qc-snap-h'); l.style.top = `${(sy.line / d.height) * 100}%`; }
  }
  private clearSnap(): void { this.snapEl?.empty(); this.snapCache = undefined; }

  /* ---------- persistence ---------- */
  private async afterLoad(): Promise<void> {
    const d = this.design!; const c = this.canvas!;
    const bg = d.bg ?? this.bgFromCanvas();
    this.applyBackground(bg, false);
    for (const o of c.getObjects()) if (o instanceof Textbox) o.splitByGrapheme = o.splitByGrapheme || hasCjk(o.text);
    await this.reflowFonts();
  }
  private bgFromCanvas(): Background {
    const v = this.canvas?.backgroundColor; return { kind: 'solid', color: typeof v === 'string' && /^#[\da-f]{6}$/i.test(v) ? v : '#ffffff' };
  }
  /** Loads every family used by text, then recomputes layout once real glyph metrics are available. */
  async reflowFonts(): Promise<void> {
    const c = this.canvas; if (!c) return;
    const texts = c.getObjects().filter((o): o is Textbox => o instanceof Textbox);
    await Promise.all([...new Set(texts.map(t => t.fontFamily))].map(f => this.plugin.fonts.ensure(this.doc, f)));
    // Text we wrapped ourselves was measured before its face loaded: wrap it again with the real metrics.
    for (const t of texts) { rewrap(t); t.initDimensions(); t.set('dirty', true); t.setCoords(); }
    c.requestRenderAll();
  }
  currentDesign(): Design {
    const c = this.canvas!;
    // Fabric realizes top-level active selections when serializing, but not selected children inside a group.
    const nested = c.getActiveObjects().filter(o => o.parent && o.group instanceof ActiveSelection).map(o => ({ object: o, original: util.saveObjectTransform(o), matrix: util.multiplyTransformMatrices(util.invertTransform(o.parent!.calcTransformMatrix()), o.calcTransformMatrix()) }));
    let canvas: Record<string, unknown>;
    try { for (const n of nested) util.applyTransformToObject(n.object, n.matrix); canvas = c.toObject(PROPS) as Record<string, unknown>; }
    finally { for (const n of nested) n.object.set(n.original); }
    const bg = this.design!.bg; if (bg) canvas.background = bg.kind === 'solid' ? bg.color : bg.from;
    return { ...this.design!, canvas };
  }
  private snapshot(): string {
    // Assign IDs before recording: restoring the drawer must not mutate a snapshot and discard redo.
    this.sceneNodes(); return this.codec.encode(this.currentDesign());
  }
  changed(): void {
    if (this.restoring || !this.canvas || !this.design || this.closingView) return;
    this.dirty = true; ++this.revision; this.setStatus('saving');
    const w = this.win; if (this.historyTimer !== undefined) w.clearTimeout(this.historyTimer);
    this.historyTimer = w.setTimeout(() => { this.historyTimer = undefined; this.commitHistory(); void this.flush(); }, 450);
    if (!this.refreshQueued) { this.refreshQueued = true; w.requestAnimationFrame(() => { this.refreshQueued = false; this.refreshLayers(); }); }
  }
  private commitHistory(): void {
    if (this.historyTimer !== undefined) { this.win.clearTimeout(this.historyTimer); this.historyTimer = undefined; }
    if (this.restoring || !this.canvas || !this.design || !this.dirty || this.inTurn) return;
    this.history.push(this.snapshot()); this.updateHistoryButtons();
  }
  private updateHistoryButtons(): void {
    if (this.undoBtn) this.undoBtn.disabled = !this.history.canStep(-1);
    if (this.redoBtn) this.redoBtn.disabled = !this.history.canStep(1);
  }
  async flush(): Promise<void> {
    this.commitHistory();
    await this.writer.run(async () => {
      if (!this.dirty || !this.file || !this.canvas || this.restoring) return;
      const file = this.file; const revision = this.revision; const raw = JSON.stringify(this.currentDesign(), null, 2); const expected = this.expected;
      try {
        await this.app.vault.process(file, old => { if (old !== expected) throw new Error(this.t('conflict')); return raw; });
        this.expected = raw;
        if (revision === this.revision) { this.dirty = false; this.setStatus('saved'); } else this.setStatus('saving');
      } catch (e) { this.setStatus('failed'); this.plugin.report(e); }
    });
  }
  async travel(direction: -1 | 1): Promise<void> {
    this.drawing?.finish();
    this.commitHistory();
    const snapshot = this.history.step(direction); if (!snapshot || !this.canvas) return;
    const d = this.codec.decode(snapshot); this.restoring = true;
    try {
      this.canvas.discardActiveObject(); await this.canvas.loadFromJSON(d.canvas); this.design = d; await this.afterLoad();
      this.applyZoom(); this.updatePlatformLabel(); this.renderGuides();
    } finally { this.restoring = false; }
    this.dirty = true; ++this.revision; this.refreshAll(); this.history.replaceCurrent(this.snapshot()); this.updateHistoryButtons(); await this.flush();
  }
  undo(): Promise<void> { return this.travel(-1); }
  redo(): Promise<void> { return this.travel(1); }

  /* ---------- panels ---------- */
  refreshAll(): void {
    if (!this.canvas) return;
    renderDrawer(this, this.drawerEl!); this.refreshInspector(true); this.renderGuides(); this.updatePlatformLabel();
  }
  refreshToolbar(): void {
    const labels = this.plugin.settings.toolbarLabels;
    this.contentEl.classList.toggle('qc-toolbar-icons', !labels);
    for (const button of Array.from(this.contentEl.querySelectorAll<HTMLButtonElement>('.qc-header-create button'))) {
      if (labels) button.removeAttribute('aria-label');
      else button.setAttribute('aria-label', button.querySelector(':scope > span:last-child')?.textContent ?? '');
    }
    const drawerWidth = this.drawerEl?.getBoundingClientRect().width ?? 0;
    const offset = `${Math.max(240, drawerWidth - 20)}px`;
    if (this.contentEl.style.getPropertyValue('--qc-toolbar-offset') !== offset) this.contentEl.style.setProperty('--qc-toolbar-offset', offset);
  }
  refreshDrawer(): void { if (this.drawerEl) { if (this.plugin.settings.drawer) this.lastDrawer = this.plugin.settings.drawer; renderDrawer(this, this.drawerEl); this.refreshToolbar(); } }
  toggleDrawer(): void { const s = this.plugin.settings; s.drawer = s.drawer ? '' : this.lastDrawer; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom(); }
  private syncTabs(): void { for (const b of Array.from(this.tabsEl?.children ?? [])) b.classList.toggle('is-active', b.getAttribute('data-tab') === this.rightTab); }
  refreshInspector(force = false): void {
    const el = this.inspectorBody; if (!el || !this.canvas) return;
    const a = this.doc.activeElement; if (!force && a && el.contains(a)) return;
    // Rebuilding while the user types would drop focus and break IME composition.
    if (!force && a && el.contains(a)) return;
    // Picking something on the canvas shows its properties; clicking empty space goes back to the canvas settings. Layers stays put.
    const has = this.selection().length > 0;
    if (has && this.rightTab === 'canvas') { this.rightTab = 'design'; this.syncTabs(); } else if (!has && this.rightTab === 'design') { this.rightTab = 'canvas'; this.syncTabs(); }
    if (this.rightTab === 'layers') renderLayers(this, el); else renderInspector(this, el);
  }
  private refreshLayers(): void { if (this.rightTab === 'layers' && this.inspectorBody) renderLayers(this, this.inspectorBody); }

  /* ---------- object helpers ---------- */
  selection(): QObject[] { return (this.canvas?.getActiveObjects() ?? []) as QObject[]; }
  /** What the composer chip shows about the current pick, so "make it bigger" has a visible referent. */
  selectionLabel(): string | undefined {
    const selected = this.inTurn ? this.turnSelectedObjects : this.selection();
    if (selected.length > 1) return this.t('selected', { n: selected.length });
    const o = selected[0];
    return o instanceof Textbox ? this.layerLabel(o) : o ? o.qcName || this.t(o instanceof FabricImage ? 'image' : 'shape') : undefined;
  }
  /** A text layer named the way people talk about it: 标题「保留的 作品」. */
  layerLabel(o: Textbox): string {
    const role = (o as QObject).qcRole;
    const name = role === 'title' ? this.t('roleTitle') : role === 'subtitle' ? this.t('roleSubtitle') : '';
    const text = o.text.trim().replace(/\s+/g, ' ').slice(0, 16);
    return name ? `${name}「${text}」` : `「${text}」`;
  }
  texts(): Textbox[] { return this.selection().filter((o): o is Textbox & QObject => o instanceof Textbox); }
  update(props: Record<string, unknown>, only?: (o: FabricObject) => boolean): void {
    const targets = this.selection().filter(o => !only || only(o));
    for (const o of targets) {
      o.set(props);
      if (o instanceof Textbox) { if ('text' in props) o.splitByGrapheme = hasCjk(o.text); o.initDimensions(); }
      o.setCoords();
    }
    this.canvas?.requestRenderAll(); this.changed();
  }
  beginColorEdit(): void { this.commitHistory(); this.inTurn = true; }
  endColorEdit(): void { this.endTurn(); }
  async setFont(family: string): Promise<void> {
    await this.plugin.fonts.ensure(this.doc, family);
    this.plugin.rememberFont(family);
    const targets = this.texts();
    if (!targets.length) { this.plugin.settings.defaultFont = family; void this.plugin.saveSettings(); }
    else this.update({ fontFamily: family }, o => o instanceof Textbox);
    this.refreshInspector(true); this.refreshDrawer();
  }
  setShadow(name: string): void {
    for (const o of this.selection()) {
      const fill = typeof o.fill === 'string' ? o.fill : '#ffffff';
      o.set({ shadow: SHADOWS[name]?.(fill) ?? null }); (o as QObject).qcShadow = name === 'none' ? undefined : name; o.setCoords();
    }
    this.canvas?.requestRenderAll(); this.changed();
  }
  private place(o: FabricObject): void {
    const c = this.canvas!; c.add(o); c.setActiveObject(o); c.requestRenderAll(); this.refreshInspector(true);
  }
  /**
   * New text hugs its own length and lands in the middle of the artboard, centred, so it is already a sensible thing to drag
   * from. Only text longer than the safe width wraps. It keeps hugging as the words are edited (see `rehug`).
   */
  addText(text = this.t('newText'), o: { size?: number; color?: string; font?: string; bold?: boolean; align?: 'left' | 'center' | 'right' } = {}): Textbox {
    const d = this.design!; const m = Math.round(Math.min(d.width, d.height) * 0.08); const size = o.size ?? Math.round(Math.min(d.width, d.height) * 0.09);
    const weight = o.bold === false ? 'normal' : 'bold'; const maxW = d.width - m * 2;
    const widest = Math.max(...text.split('\n').map(l => textWidth(l, size, weight)));
    const width = Math.min(maxW, Math.ceil(widest + size * 0.12));
    const count = this.canvas!.getObjects().filter(x => x instanceof Textbox).length;
    const box = textbox(text, 0, 0, width, { fontSize: size, fill: o.color ?? '#171717', fontWeight: weight, fontFamily: o.font ?? this.plugin.settings.defaultFont, textAlign: o.align ?? 'center' });
    (box as QObject).qcHug = true;
    box.set({ left: Math.round((d.width - box.width) / 2), top: Math.round((d.height - box.getScaledHeight()) / 2 + (count % 5) * d.height * 0.07) });
    this.place(box); return box;
  }
  /** Keeps a hugging text box exactly as wide as its longest line after an edit, around the same centre. */
  rehug(t: Textbox & QObject): void {
    const d = this.design; if (!d || !t.qcHug) return;
    const m = Math.round(Math.min(d.width, d.height) * 0.08); const size = t.fontSize * t.scaleY; const weight = String(t.fontWeight) === 'bold' || Number(t.fontWeight) >= 600 ? 'bold' : 'normal';
    const widest = Math.max(...t.text.split('\n').map(l => textWidth(l, t.fontSize, weight))); const width = Math.min(d.width - m * 2, Math.ceil(widest + t.fontSize * 0.12));
    const cx = t.left + t.getScaledWidth() / 2; t.set({ width, left: cx - (width * t.scaleX) / 2 }); t.initDimensions(); t.setCoords(); void size;
  }
  addPreset(kind: 'title' | 'subtitle' | 'body' | 'marker' | 'outline' | 'shadow' | 'tag' | 'number'): Textbox {
    const d = this.design!; const u = Math.min(d.width, d.height) / 1000;
    const label = { title: this.t('presetTitle'), subtitle: this.t('presetSubtitle'), body: this.t('presetBody'), marker: this.t('presetMarker'), outline: this.t('presetOutline'), shadow: this.t('presetShadow'), tag: this.t('presetTag'), number: '01' }[kind];
    const base: Record<string, unknown> = {
      title: { size: 110 * u, bold: true }, subtitle: { size: 52 * u, bold: false, color: '#525252' }, body: { size: 36 * u, bold: false, color: '#404040' },
      marker: { size: 96 * u, bold: true }, outline: { size: 130 * u, bold: true, color: '#ffffff' }, shadow: { size: 110 * u, bold: true, color: '#ffe04b' }, tag: { size: 40 * u, bold: true, color: '#ffffff' }, number: { size: 220 * u, bold: true, color: '#e11d2e' },
    }[kind];
    if (kind === 'tag' || kind === 'marker') { // real pills (word centred, padding fixed to the type size) instead of a long text box with a background
      const c = this.canvas!; const size = Math.round(base.size as number); const tag = kind === 'tag';
      const pill = new BadgeBox(label, { fontSize: size, fontWeight: 'bold', fill: tag ? '#ffffff' : '#171717', badgeBg: tag ? '#e11d2e' : '#ffe04b', radius: tag ? 0.5 : 0.14, padX: tag ? 0.7 : 0.4, fontFamily: this.plugin.settings.defaultFont } as ConstructorParameters<typeof BadgeBox>[1]);
      const count = c.getObjects().filter(x => x instanceof Textbox).length;
      pill.set({ left: Math.round((this.design!.width - pill.width) / 2), top: Math.round((this.design!.height - pill.height) / 2 + (count % 5) * this.design!.height * 0.07) });
      this.place(pill); return pill;
    }
    const box = this.addText(label, { size: Math.round(base.size as number), color: base.color as string | undefined, bold: base.bold as boolean });
    if (kind === 'outline') box.set({ stroke: '#111111', strokeWidth: Math.max(4, Math.round(10 * u)), paintFirst: 'stroke' });
    if (kind === 'shadow') { box.set({ shadow: SHADOWS.hard!('#111111') }); (box as QObject).qcShadow = 'hard'; }
    box.initDimensions(); box.setCoords(); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return box;
  }
  /** Adds a text style from the Insert menu, centred and offset a little so repeated adds do not stack exactly. */
  addTextStyle(p: TextPreset): Textbox {
    const d = this.design!; const u = Math.min(d.width, d.height) / 1000; const have = (f: string): boolean => this.plugin.fonts.available(this.doc, f);
    const face = faceFor(p.font, have) ?? this.plugin.settings.defaultFont; const label = this.zh ? p.sample : p.sampleEn; const size = Math.round(p.size * u);
    if (p.pill) {
      const pill = pillFor(p, label, size, face); const count = this.canvas!.getObjects().filter(x => x instanceof Textbox).length;
      pill.set({ left: Math.round((d.width - pill.width) / 2), top: Math.round((d.height - pill.height) / 2 + (count % 5) * d.height * 0.07) }); void this.plugin.fonts.ensure(this.doc, face).then(() => { pill.initDimensions(); this.canvas?.requestRenderAll(); });
      this.place(pill); return pill;
    }
    const box = this.addText(label, { size, ...(p.color ? { color: p.color } : {}), font: face, bold: p.weight !== 'normal' && !isSingleWeight(face) });
    this.rehug(box as Textbox & QObject); styleText(box, p, size); (box as QObject).qcShadow = p.shadow && p.shadow.blur === 0 ? 'hard' : undefined;
    box.setCoords(); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true); return box;
  }
  addShape(type: 'rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star'): FabricObject | undefined {
    if (!this.canvas || !this.design) return undefined;
    const d = this.design; const size = Math.round(Math.min(d.width, d.height) * 0.3); const left = Math.round((d.width - size) / 2), top = Math.round((d.height - size) / 2);
    const common = { left, top, fill: '#2563eb' };
    let o: FabricObject;
    switch (type) {
      case 'rect': o = new Rect({ ...common, width: size * 1.4, height: size * 0.8 }); break;
      case 'rounded': o = new Rect({ ...common, width: size * 1.4, height: size * 0.8, rx: size * 0.12, ry: size * 0.12 }); break;
      case 'circle': o = new Circle({ ...common, radius: size / 2 }); break;
      case 'triangle': o = new Triangle({ ...common, width: size, height: size * 0.9 }); break;
      case 'line': o = new Line([0, 0, size * 1.4, 0], { left, top: top + size / 2, stroke: '#171717', strokeWidth: Math.max(6, Math.round(size * 0.04)), strokeLineCap: 'round' }); break;
      default: {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) { const r = i % 2 ? size * 0.2 : size * 0.5; const a = (Math.PI / 5) * i - Math.PI / 2; pts.push({ x: size / 2 + r * Math.cos(a), y: size / 2 + r * Math.sin(a) }); }
        o = new Polygon(pts, { ...common });
      }
    }
    if (type !== 'line') o.set({ left: Math.round((d.width - o.getScaledWidth()) / 2), top: Math.round((d.height - o.getScaledHeight()) / 2) });
    this.place(o); return o;
  }
  /** A shape by its semantic id (basic six or a named path shape), optionally recoloured — what the assistant calls. */
  addSemanticShape(kind: string, color?: string, place: Placement & { size?: number; tone?: Tone } = {}): boolean {
    let o: FabricObject | undefined;
    if ((BASIC_SHAPES as readonly string[]).includes(kind)) o = this.addShape(kind as BasicShape);
    else {
      const hit = PATH_SHAPES.find(([id]) => id === kind); if (!hit) return false;
      this.addPathShape(hit[2]); o = this.canvas?.getActiveObject() ?? undefined;
    }
    if (!o) return false; (o as QObject).qcKind = kind;
    const fill = color ?? (place.tone ? this.currentPalette()[place.tone] : undefined);
    if (fill) { if (kind === 'line') o.set({ stroke: fill }); else o.set({ fill }); }
    if (place.tone) (o as QObject).qcTone = place.tone;
    if (place.size) { const d = this.design!; const k = place.size * Math.min(d.width, d.height) / Math.max(o.getScaledWidth(), o.getScaledHeight(), 1); o.set({ scaleX: o.scaleX * k, scaleY: o.scaleY * k }); }
    o.setCoords();
    if (place.to || place.near || place.x !== undefined || place.y !== undefined) this.placeObjects([o as QObject], place, true);
    this.canvas?.requestRenderAll(); this.changed();
    return true;
  }
  /** A preset text look (caption, display type, pill, highlighter) carrying the assistant's own words. */
  addTextPreset(id: string, text?: string): boolean {
    const p = textPresetById(id); if (!p || !this.canvas) return false;
    const box = this.addTextStyle(p);
    if (text && text !== box.text) {
      box.set({ text }); box.splitByGrapheme = hasCjk(text); box.initDimensions(); box.setCoords();
      this.canvas.requestRenderAll(); this.changed();
    }
    return true;
  }
  /** The best-matching sticker (or line icon) from the offline library, in the current ink colour. */
  async addSticker(query: string): Promise<string> {
    return this.addIcon({ op: 'icon', want: { zh: query.trim(), ...(/[a-z]/i.test(query) ? { en: [query.trim()] } : {}) }, style: 'auto' });
  }
  /**
   * The best library match for a semantic ask (both libraries, every phrasing), sized and placed where it does not cover the
   * words, in the palette colour it should follow. The runners-up are kept for the chat so the user can swap with one tap.
   */
  async addIcon(op: OpOf<'icon'>): Promise<string> {
    const data = await loadAssets(this.app, this.plugin.manifest.dir ?? '');
    const ranked = rankAssets(data, op.want, op.style ?? 'auto', 9); const label = op.want.zh ?? op.want.en?.[0] ?? '';
    const hit = ranked[0];
    if (!hit) throw new OpProblem(this.zh ? `素材库里没有匹配「${label}」的图标；换一个更常见的说法或英文同义词再试` : `No library match for "${label}"; try a more common word or English synonyms`);
    const old = op.replace ? this.targets(op.replace)[0] : undefined;
    const pal = this.currentPalette(); const tone: Tone | undefined = hit.cat === 'line' && !op.color ? op.tone ?? (old?.qcTone as Tone | undefined) ?? 'accent' : undefined;
    const color = op.color ?? (tone ? pal[tone] : pal.ink);
    const g = await this.addAssetSvg(assetSvg(hit, color), { asset: `${hit.cat}:${hit.id}`, tone });
    if (!g) throw new OpProblem('svg');
    const d = this.design!;
    if (old) {
      const b = old.getBoundingRect(); const k = Math.max(b.width, b.height) / Math.max(g.getScaledWidth(), g.getScaledHeight(), 1);
      g.set({ scaleX: g.scaleX * k, scaleY: g.scaleY * k, left: b.left + b.width / 2, top: b.top + b.height / 2 }); g.setCoords();
      this.canvas!.remove(old);
    } else {
      const side = (op.size ?? 0.17) * Math.min(d.width, d.height); const k = side / Math.max(g.getScaledWidth(), g.getScaledHeight(), 1);
      g.set({ scaleX: g.scaleX * k, scaleY: g.scaleY * k }); g.setCoords();
      const place: Placement = op.to || op.near || op.x !== undefined || op.y !== undefined ? op : { ...op, to: 'top-right' };
      this.placeObjects([g], place, true);
    }
    this.canvas!.setActiveObject(g); this.canvas!.requestRenderAll(); this.changed();
    const id = this.idOf(g); this.touched.add(id);
    if (ranked.length > 1) this.turnPicks.push({ target: id, chosen: `${hit.cat}:${hit.id}`, items: ranked.slice(1, 9).map(a => ({ cat: a.cat, id: a.id })) });
    const name = this.zh && hit.cat === 'sticker' ? hit.zh : hit.id; const b = g.getBoundingRect(); const where = regionOf({ x: b.left, y: b.top, w: b.width, h: b.height }, d.width, d.height);
    return this.zh ? `已${old ? '替换为' : '添加'}${hit.cat === 'line' ? '线性图标' : '贴纸'}：${name}（${WHERE_ZH[where]}）` : `${old ? 'Swapped in' : 'Added'} ${hit.cat === 'line' ? 'line icon' : 'sticker'}: ${hit.id} (${where})`;
  }
  /** Swaps an icon for another library item in the same place and size (the chat's runner-up strip). */
  async swapAsset(targetId: string, cat: AssetCat, id: string): Promise<void> {
    const old = (this.canvas?.getObjects() as QObject[] | undefined)?.find(o => o.qcId === targetId); if (!old) return;
    const data = await loadAssets(this.app, this.plugin.manifest.dir ?? '');
    const item = (cat === 'line' ? data.lines : data.stickers).find(a => a.id === id); if (!item) return;
    const tone = cat === 'line' ? (old.qcTone as Tone | undefined) ?? 'accent' : undefined; const color = tone ? this.currentPalette()[tone] : this.currentPalette().ink;
    const b = old.getBoundingRect(); const angle = old.angle; const z = this.canvas!.getObjects().indexOf(old);
    const g = await this.addAssetSvg(assetSvg(item, color), { asset: `${cat}:${id}`, tone }); if (!g) return;
    const k = Math.max(b.width, b.height) / Math.max(g.getScaledWidth(), g.getScaledHeight(), 1);
    g.set({ scaleX: g.scaleX * k, scaleY: g.scaleY * k, left: b.left + b.width / 2, top: b.top + b.height / 2, angle }); g.qcId = targetId;
    this.canvas!.remove(old); this.canvas!.moveObjectTo(g, Math.max(0, z)); g.setCoords(); this.canvas!.setActiveObject(g); this.canvas!.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** The top Unsplash photo for the query as a full-bleed background. */
  async addPhotoBackground(query: string): Promise<string> {
    const src = { key: unsplashKey(this.app, this.plugin.settings.unsplashSecret), proxy: this.plugin.settings.unsplashProxy };
    if (!hasSource(src)) throw new Error(this.t('photoNoKey'));
    const photo = (await searchPhotos(src, query.trim()))[0];
    if (!photo) throw new Error(this.t('photoNone', { query: query.trim() }));
    const blob = await downloadPhoto(src, photo);
    await this.addBackgroundPhoto(blob, `Unsplash · ${photo.author}`);
    return this.t('photoAdded', { author: photo.author });
  }
  layerQuery = ''; layerAnchor?: FabricObject; layerFolded = new WeakSet<FabricObject>();
  groupLayers(): void {
    const c = this.canvas; if (!c) return;
    const selected = c.getActiveObjects(); if (!selected.length) return;
    const owner = selected[0]!.parent ?? c;
    if (selected.some(o => (o.parent ?? c) !== owner)) return;
    const chosen = owner.getObjects().filter(o => selected.includes(o));
    if (chosen.length < 2 || chosen.some(o => o.lockMovementX || o.lockMovementY)) return;
    this.beginTurn();
    try {
      c.discardActiveObject(); const index = owner.getObjects().filter(o => !chosen.includes(o) && owner.getObjects().indexOf(o) < owner.getObjects().indexOf(chosen[chosen.length - 1]!)).length;
      owner.remove(...chosen);
      const group = new Group(chosen, { subTargetCheck: true, interactive: true }) as Group & QObject;
      group.qcLayerGroup = true; group.qcName = this.t('layerGroup'); owner.insertAt(index, group); c.setActiveObject(group); group.setCoords(); this.changed();
    } finally { this.endTurn(); }
    c.requestRenderAll(); this.refreshInspector(true);
  }
  ungroupLayers(): void {
    const c = this.canvas, selected = c?.getActiveObject() as (Group & QObject) | undefined;
    if (!c || !(selected instanceof Group) || !selected.qcLayerGroup || selected.lockMovementX || selected.lockMovementY) return;
    this.beginTurn();
    try { c.discardActiveObject(); const parent = selected.parent, owner = parent ?? c, index = owner.getObjects().indexOf(selected); const children = selected.removeAll(); owner.remove(selected); owner.insertAt(index, ...children); if (children.length === 1) c.setActiveObject(children[0]!); else if (children.length) c.setActiveObject(new ActiveSelection(children, { canvas: c })); for (const child of children) child.setCoords(); this.changed(); }
    finally { this.endTurn(); }
    c.requestRenderAll(); this.refreshInspector(true);
  }
  renameLayers(objects: FabricObject[], name: string): void {
    const c = this.canvas; if (!c || !name.trim() || !objects.length) return;
    this.beginTurn(); try { objects.forEach((o, i) => { (o as QObject).qcName = `${name.trim().slice(0, 100)}${objects.length > 1 ? ` ${i + 1}` : ''}`; }); this.changed(); } finally { this.endTurn(); } this.refreshInspector(true);
  }
  removeSelection(): void {
    const c = this.canvas; if (!c) return;
    const targets = c.getActiveObjects(); if (!targets.length) return;
    this.beginTurn(); try {
      c.discardActiveObject();
      for (const o of targets) { const parent = o.parent; if (parent) { parent.remove(o); if (!parent.getObjects().length) { if (parent.parent) parent.parent.remove(parent); else c.remove(parent); } } else c.remove(o); }
      this.changed();
    } finally { this.endTurn(); } c.requestRenderAll(); this.refreshInspector(true);
  }
  async cloneSelection(): Promise<void> {
    const c = this.canvas; if (!c) return; const generation = this.generation;
    const sources = c.getActiveObjects().map(o => ({ object: o, matrix: o.calcTransformMatrix() }));
    const copies = await Promise.all(sources.map(async ({ object, matrix }) => { const copy = await object.clone(PROPS); util.applyTransformToObject(copy, matrix); return copy; }));
    if (generation !== this.generation || this.closingView) return;
    c.discardActiveObject();
    for (const copy of copies) { clearImageIds(copy); copy.set({ left: copy.left + 28, top: copy.top + 28 }); c.add(copy); }
    if (copies.length === 1) c.setActiveObject(copies[0]!); else if (copies.length > 1) c.setActiveObject(new ActiveSelection(copies, { canvas: c }));
    c.requestRenderAll(); this.refreshInspector(true);
  }
  async copyObjects(): Promise<void> {
    const c = this.canvas; if (!c) return;
    const sources = c.getActiveObjects().map(o => ({ object: o, matrix: o.calcTransformMatrix() }));
    this.clip = (await Promise.all(sources.map(async ({ object, matrix }) => { const copy = await object.clone(PROPS); util.applyTransformToObject(copy, matrix); return copy; }))).map(o => o.toObject(PROPS));
    if (this.clip.length) new Notice(this.t('copiedObj'));
  }
  async pasteObjects(): Promise<void> {
    const c = this.canvas; if (!c || !this.clip.length) return;
    const { util } = await import('fabric'); const generation = this.generation;
    const copies = await util.enlivenObjects<FabricObject>(structuredClone(this.clip));
    if (generation !== this.generation || this.closingView) return;
    c.discardActiveObject();
    for (const o of copies) { clearImageIds(o); o.set({ left: o.left + 28, top: o.top + 28 }); c.add(o); }
    this.clip = copies.map(o => o.toObject(PROPS));
    if (copies.length === 1) c.setActiveObject(copies[0]!); else if (copies.length > 1) c.setActiveObject(new ActiveSelection(copies, { canvas: c }));
    c.requestRenderAll(); this.refreshInspector(true);
  }
  order(where: 'front' | 'forward' | 'backward' | 'back'): void {
    const c = this.canvas; if (!c) return;
    const selected = c.getActiveObjects(); const owners = new Set(selected.map(o => o.parent ?? c));
    for (const owner of owners) {
      const ordered = owner.getObjects().filter(o => selected.includes(o));
      if (where === 'forward' || where === 'back') ordered.reverse();
      for (const o of ordered) {
        if (where === 'front') owner.bringObjectToFront(o); else if (where === 'forward') owner.bringObjectForward(o);
        else if (where === 'backward') owner.sendObjectBackwards(o); else owner.sendObjectToBack(o);
      }
    }
    c.requestRenderAll(); this.changed();
  }
  toggleLock(): void {
    const targets = this.selection(); if (!targets.length) return;
    const locked = !targets.every(o => o.lockMovementX);
    for (const o of targets) o.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked, ...(o instanceof Textbox ? { editable: !locked } : {}) });
    this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** Snaps the selection (or the assistant's target, which keeps the cover's margin) to an edge or the centre. */
  align(to: Align, target?: Target): boolean {
    const c = this.canvas, d = this.design; if (!c || !d) return false;
    const objs: FabricObject[] = target !== undefined ? this.targets(target) : c.getActiveObject() ? [c.getActiveObject()!] : []; if (!objs.length) return false;
    const m = target !== undefined ? Math.round(Math.min(d.width, d.height) * 0.06) : 0;
    for (const o of objs) {
      const b = o.getBoundingRect();
      const dx = to === 'left' ? m - b.left : to === 'right' ? d.width - m - (b.left + b.width) : to === 'center' ? d.width / 2 - (b.left + b.width / 2) : 0;
      const dy = to === 'top' ? m - b.top : to === 'bottom' ? d.height - m - (b.top + b.height) : to === 'middle' ? d.height / 2 - (b.top + b.height / 2) : 0;
      o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); if (target !== undefined) this.touched.add(this.idOf(o as QObject));
    }
    c.requestRenderAll(); this.changed(); this.refreshInspector(true); return true;
  }
  move(dx: number, dy: number): void {
    for (const o of this.canvas?.getActiveObjects() ?? []) { if (o.lockMovementX) continue; o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); }
    this.canvas?.requestRenderAll(); this.changed();
  }
  /** Scales an image so it covers or fits the whole canvas, centred. */
  fitImage(img: FabricObject, mode: 'cover' | 'contain'): void {
    const d = this.design!; const w = img.width, h = img.height;
    const s = mode === 'cover' ? Math.max(d.width / w, d.height / h) : Math.min(d.width / w, d.height / h);
    img.set({ scaleX: s, scaleY: s, left: (d.width - w * s) / 2, top: (d.height - h * s) / 2 }); img.setCoords();
    this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  setCorner(img: FabricObject, radius: number): void {
    if (img instanceof Rect) { img.set({ rx: radius, ry: radius }); } else {
      img.clipPath = radius > 0 ? new Rect({ width: img.width, height: img.height, rx: radius / Math.max(img.scaleX, 0.0001), ry: radius / Math.max(img.scaleY, 0.0001), originX: 'center', originY: 'center' }) : undefined;
      img.set('dirty', true);
    }
    this.canvas?.requestRenderAll(); this.changed();
  }

  /* ---------- canvas settings ---------- */
  /** A mesh background: a base colour plus soft light blobs (and fine grain) sitting behind everything, locked so they never get in the way. */
  applyMesh(preset: MeshPreset, withGrain = true): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    for (const o of c.getObjects().filter(x => (x as QObject).qcRole === 'bgfx')) c.remove(o);
    this.applyBackground({ kind: 'solid', color: preset.base }, false);
    const side = Math.min(d.width, d.height); const fx: FabricObject[] = preset.glows.map(g => kitGlow(g.x * d.width, g.y * d.height, g.r * side * 1.1, g.color, g.a));
    const gr = withGrain ? grain(d.width, d.height, 0.1, 5) : undefined; if (gr) fx.push(gr);
    fx.forEach((o, i) => { (o as QObject).qcRole = 'bgfx'; (o as QObject).qcKind = preset.id; o.set({ selectable: false, evented: false, hoverCursor: 'default' }); c.insertAt(i, o); });
    this.qualityPass(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  hasMesh(): boolean { return !!this.canvas?.getObjects().some(o => (o as QObject).qcRole === 'bgfx'); }
  applyBackground(bg: Background, record = true): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    if (record) for (const o of c.getObjects().filter(x => (x as QObject).qcRole === 'bgfx')) c.remove(o);
    d.bg = bg; c.backgroundColor = bg.kind === 'solid' ? bg.color : gradient(d.width, d.height, bg.from, bg.to, bg.angle);
    c.requestRenderAll(); if (record) this.changed();
  }
  setBackground(spec: { color?: string; from?: string; to?: string; angle?: number; mesh?: string }): boolean {
    if (spec.mesh) { const m = MESH_LIBRARY.find(x => x.id === spec.mesh); if (!m) return false; this.applyMesh(m); this.refreshInspector(true); return true; }
    if (spec.color) this.applyBackground({ kind: 'solid', color: spec.color });
    else if (spec.from && spec.to) this.applyBackground({ kind: 'linear', from: spec.from, to: spec.to, angle: spec.angle ?? 135 });
    else return false;
    this.refreshInspector(true); return true;
  }
  /**
   * Switching platform re-lays the cover out for the new shape when it came from a template: the same words, palette, picture
   * and decoration, but headline size, spacing and anchors recomputed for the new proportions. Without a template (a cover built by
   * hand) it falls back to scaling everything to fit.
   */
  setPlatform(id: string, relayout = true): boolean {
    const p = platformById(id); if (!p) return false; const d = this.design; if (!d) return false;
    const tpl = d.template ? templateById(d.template) : undefined; const shapeChanged = d.width !== p.width || d.height !== p.height;
    if (relayout && shapeChanged && tpl && this.canvas) { this.relayout(p, tpl.id); return true; }
    this.resizeTo(p.width, p.height, true, p); return true;
  }
  private relayout(p: Platform, tplId: string): void {
    const d = this.design!, c = this.canvas!; const ow = d.width, oh = d.height; const copy = this.copyText(); const spec = this.lastSpec;
    const mesh = c.getObjects().find(o => (o as QObject).qcRole === 'bgfx') as QObject | undefined; const meshId = mesh?.qcKind;
    this.resizeTo(p.width, p.height, false, p);
    const s = Math.min(p.width / ow, p.height / oh); const ox = (p.width - ow * s) / 2, oy = (p.height - oh * s) / 2;
    for (const o of c.getObjects().filter(x => !(x as QObject).qcTpl && !(x as QObject).qcRole)) { // the user's own pieces: scale to fit the new frame
      if (o instanceof Textbox) o.set({ fontSize: o.fontSize * s, width: o.width * s, strokeWidth: o.strokeWidth * s }); else o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
      o.set({ left: o.left * s + ox, top: o.top * s + oy }); if (o instanceof Textbox) o.initDimensions(); o.setCoords();
    }
    this.applyTemplate(tplId, { title: copy.title, subtitle: copy.subtitle, badge: copy.badge, points: spec?.points, palette: spec?.palette }, ['image', 'subject', 'decor', '*user']);
    for (const o of c.getObjects()) { const q = o as QObject; if (q.qcRole === 'subject') this.fitSubject(o); else if (q.qcRole === 'image' && !o.clipPath) this.fitImage(o, 'cover'); }
    this.finishLayout(spec, false);
    if (meshId) { const m = MESH_LIBRARY.find(x => x.id === meshId); if (m) this.applyMesh(m); }
    c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    new Notice(this.t('relaidOut', { platform: this.zh ? p.zh : p.en }));
  }
  /** Titles, anchors and quality checks after any layout: shared by a fresh design and a platform re-layout. */
  private finishLayout(spec: DesignSpec | undefined, expectSubject: boolean): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    if (spec?.titleFont && this.plugin.fonts.available(this.doc, spec.titleFont)) this.styleText('title', { font: spec.titleFont });
    if (spec?.bodyFont && this.plugin.fonts.available(this.doc, spec.bodyFont)) this.styleText('subtitle', { font: spec.bodyFont });
    const hasSubject = expectSubject || c.getObjects().some(o => (o as QObject).qcRole === 'subject');
    this.followTitle(() => {
      // Only plain text-block layouts are re-stacked; styles with stickers, rules or frames keep the arrangement they were designed with.
      if (canReflow(d.template)) { if (hasSubject) arrangeForSubject(c.getObjects(), d.width, d.height); else tightenCopy(c.getObjects(), d.width, d.height); }
      this.reanchorDecor(); this.calm(); layoutPass(c.getObjects(), d.width, d.height);
    });
  }
  private following = false;
  /**
   * Shapes drawn for the headline itself (a highlighter or brush stroke, tagged qcKind 'mark-title') move and scale with it
   * when a pass restacks the words, so they never stay behind on an empty spot.
   */
  private followTitle<T>(run: () => T): T {
    const c = this.canvas; const title = c?.getObjects().find((o): o is Textbox => o instanceof Textbox && (o as QObject).qcRole === 'title');
    const marks = c?.getObjects().filter(o => (o as QObject).qcKind === 'mark-title') ?? [];
    if (this.following || !c || !title || !marks.length) return run();
    const x0 = title.left, y0 = title.top, s0 = title.fontSize * title.scaleY;
    this.following = true; let out: T; try { out = run(); } finally { this.following = false; }
    const k = (title.fontSize * title.scaleY) / s0;
    if (k !== 1 || title.left !== x0 || title.top !== y0) for (const m of marks) {
      if (!c.getObjects().includes(m)) continue;
      m.set({ left: title.left + (m.left - x0) * k, top: title.top + (m.top - y0) * k, scaleX: m.scaleX * k, scaleY: m.scaleY * k }); m.setCoords();
    }
    return out;
  }
  /** One hero, one headline, at most one accent: thins ornaments, keeps the subject off the words, keeps decoration off the text. */
  calm(): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    const hasSubject = c.getObjects().some(o => (o as QObject).qcRole === 'subject');
    if (hasSubject) this.followTitle(() => calmLayout(() => c.getObjects(), o => { c.remove(o); }, d.width, d.height, d.template));
    for (const o of decorOnText(c.getObjects(), d.width, d.height)) c.remove(o);
    c.requestRenderAll();
  }
  /** Puts a subject picture where the placement rules say for the current shape (right on wide canvases, lower middle on tall ones). */
  private fitSubject(img: FabricObject): void {
    const d = this.design!; const portrait = d.height > d.width * 1.1; const boxW = portrait ? d.width * 0.86 : d.width * 0.46, boxH = portrait ? d.height * 0.5 : d.height * 0.9;
    const k = Math.min(boxW / img.width, boxH / img.height); const w = img.width * k, h = img.height * k;
    img.set({ scaleX: k, scaleY: k, left: portrait ? (d.width - w) / 2 : d.width - w - d.width * 0.04, top: portrait ? d.height - h - d.height * 0.03 : (d.height - h) / 2 }); img.setCoords();
  }
  resizeTo(width: number, height: number, fit = true, platform?: Platform): void {
    const d = this.design, c = this.canvas; if (!d || !c || !validSize(width, height)) return;
    const ow = d.width, oh = d.height;
    if (fit && (ow !== width || oh !== height)) {
      const s = Math.min(width / ow, height / oh); const ox = (width - ow * s) / 2, oy = (height - oh * s) / 2;
      for (const o of c.getObjects()) {
        if (o instanceof Textbox) o.set({ fontSize: o.fontSize * s, width: o.width * s, strokeWidth: o.strokeWidth * s });
        else o.set({ scaleX: o.scaleX * s, scaleY: o.scaleY * s });
        o.set({ left: o.left * s + ox, top: o.top * s + oy }); if (o instanceof Textbox) o.initDimensions(); o.setCoords();
      }
    }
    d.width = width; d.height = height; d.platform = platform?.id ?? platformFor(width, height)?.id;
    if (d.bg?.kind === 'linear') this.applyBackground(d.bg, false);
    this.applyZoom(); this.updatePlatformLabel(); this.renderGuides(); this.changed(); this.refreshInspector(true); this.refreshDrawer();
  }
  /** Re-lays the design out from a template, keeping the user's own title and subtitle unless `over` supplies new copy. */
  /** `keepLayers` carries the picture, subject and decoration over, so changing the layout never throws the artwork away. */
  applyTemplate(id: string, over: Layout = {}, keepLayers: boolean | string[] = false): boolean {
    const t = templateById(id), c = this.canvas, d = this.design; if (!t || !c || !d) return false;
    const keepRoles = Array.isArray(keepLayers) ? keepLayers : keepLayers ? ['image', 'subject', 'decor'] : [];
    const kept = c.getObjects().filter(o => keepRoles.includes((o as QObject).qcRole ?? ''));
    // Things the user added themselves (no template flag, no role) can be carried over too, so a re-layout never deletes their work.
    const mine = keepRoles.includes('*user') ? c.getObjects().filter(o => !(o as QObject).qcTpl && !(o as QObject).qcRole) : [];
    const copy = this.copyText();
    const pair = this.pairing(t.id);
    if (over.titleFont && this.plugin.fonts.available(this.doc, over.titleFont)) { pair.title = over.titleFont; pair.titleBold = !isSingleWeight(over.titleFont); }
    if (over.bodyFont && this.plugin.fonts.available(this.doc, over.bodyFont)) pair.body = over.bodyFont;
    usePairing(pair);
    let result: ReturnType<typeof t.build>;
    try { result = t.build({ width: d.width, height: d.height, title: over.title ?? copy.title, subtitle: over.subtitle ?? copy.subtitle, badge: over.badge ?? copy.badge, points: over.points, palette: over.palette, zh: this.zh }); } finally { usePairing(undefined); }
    this.missingFonts = pair.missing;
    c.discardActiveObject(); this.restoring = true;
    try {
      c.remove(...c.getObjects()); for (const o of result.objects) c.add(o);
      const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim');
      for (const o of kept.filter(k => (k as QObject).qcRole === 'image' && !k.clipPath)) c.insertAt(Math.max(0, scrim), o);
      for (const o of kept.filter(k => !((k as QObject).qcRole === 'image' && !k.clipPath))) c.insertAt(this.belowText(), o);
      for (const o of mine) c.add(o);
    } finally { this.restoring = false; }
    this.templateId = t.id; d.template = t.id; this.palette = builtPalette(); d.palette = this.palette; for (const o of result.objects) (o as QObject).qcTpl = true;
    this.applyBackground(result.background, false);
    // A bundled font that is not loaded yet was measured with a fallback face: load it, then lay the template out again with real metrics.
    const faces = [pair.title, pair.body].filter((f): f is string => !!f && this.plugin.fonts.needsLoad(this.doc, f));
    if (faces.length && !this.relaying) {
      this.relaying = true;
      void Promise.all(faces.map(f => this.plugin.fonts.ensure(this.doc, f))).then(() => { if (this.canvas && this.design?.template === t.id) this.applyTemplate(id, over, keepLayers); }).finally(() => { this.relaying = false; });
    }
    void this.reflowFonts().then(() => { layoutPass(c.getObjects(), d.width, d.height); c.requestRenderAll(); this.changed(); }); this.changed(); this.refreshInspector(true); return true;
  }
  private relaying = false;
  /** Fonts the template would like to use but that are not installed yet; the drawer offers to fetch them. */
  missingFonts: string[] = [];
  /** Library faces count as available even before their file lands: `ensure` fetches them on demand and the layout re-runs. */
  pairing(templateId: string | undefined): Resolved { const f = this.plugin.fonts; return resolvePair(templateId, family => f.available(this.doc, family) || f.isLibraryFamily(family)); }
  /** After fonts are installed: swaps generic families on template text for the paired faces and re-measures. */
  repairFonts(): void {
    const c = this.canvas; if (!c) return;
    const pair = this.pairing(this.design?.template ?? this.templateId); usePairing(pair);
    try {
      for (const o of c.getObjects()) {
        if (!(o instanceof Textbox)) continue; const q = o as Textbox & QObject; if (!q.qcRole) continue;
        const tf = typeFor(q.qcRole, o.fontFamily, String(o.fontWeight)); if (tf.fontFamily) o.set(tf);
      }
    } finally { usePairing(undefined); }
    void this.reflowFonts().then(() => { c.requestRenderAll(); this.changed(); this.refreshInspector(true); });
  }
  copyText(): { title: string; subtitle: string; badge?: string } {
    const texts = (this.canvas?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox);
    const title = texts.find(o => o.qcRole === 'title') ?? [...texts].sort((a, b) => b.fontSize * b.scaleY - a.fontSize * a.scaleY)[0];
    const sub = texts.find(o => o.qcRole === 'subtitle') ?? [...texts].filter(o => o !== title).sort((a, b) => b.fontSize - a.fontSize)[0];
    const badge = texts.find(o => o.qcRole === 'badge')?.text.trim();
    const flat = (t?: Textbox & QObject): string | undefined => t ? sourceOf(t) : undefined;
    return { title: flat(title) ?? this.design?.source?.replace(/^.*\//, '').replace(/\.md$/, '') ?? this.t('newText'), subtitle: flat(sub) ?? this.t('subtext'), ...(badge ? { badge } : {}) };
  }

  /* ---------- the designer ---------- */
  /** One-shot layout from a spec: sizes the canvas, picks a template that suits the picture, then generates the picture. */
  /** Pure Latin and number text (issue numbers, "No. 01", English kickers) takes the pairing's Latin face. */
  private async applyLatinFaces(p: Pairing): Promise<void> {
    const texts = (this.canvas?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox && !hasCjk(o.text) && /[A-Za-z0-9]/.test(o.text));
    if (!texts.length) return;
    const face = (o: Textbox & QObject): string => o.qcRole === 'title' ? p.latin : p.tag ?? p.latin;
    const ok = new Map<string, boolean>(); for (const f of new Set(texts.map(face))) ok.set(f, await this.plugin.fonts.ensure(this.doc, f));
    for (const o of texts) { const f = face(o); if (!ok.get(f)) continue; o.set({ fontFamily: f, fontWeight: 'normal' }); o.initDimensions(); if (o.qcHug) this.rehug(o); o.setCoords(); }
    this.canvas?.requestRenderAll(); this.changed();
  }
  async applyDesign(input: DesignSpec): Promise<string[]> {
    const d = this.design; if (!d || !this.canvas) return [];
    const targetCanvas = this.canvas;
    const spec = expandPattern(input, family => this.plugin.fonts.available(this.doc, family));
    // A pairing fills the faces the model did not name itself.
    const pairing = pairingById(spec.typeset); if (pairing) { spec.titleFont ??= pairing.title; spec.bodyFont ??= pairing.body; }
    // A face that cannot set the words (or does not exist) is dropped, so the template's own pairing takes over.
    const fontNotes: string[] = []; const words = this.copyText();
    for (const [key, text] of [['titleFont', spec.title ?? words.title], ['bodyFont', spec.subtitle ?? words.subtitle]] as const) {
      const family = spec[key]; const issue = family ? this.fontIssue(family, text ?? '') : undefined; if (issue) { delete spec[key]; fontNotes.push(issue); }
    }
    const pair = this.pairing(spec.template);
    await Promise.all([spec.titleFont ?? pair.title, spec.bodyFont ?? pair.body].filter((f): f is string => !!f).map(f => this.plugin.fonts.ensure(this.doc, f)));
    if (this.canvas !== targetCanvas || this.design !== d) return [];
    const notes: string[] = [...fontNotes]; const zh = this.zh; this.lastSpec = spec; if (spec.pattern) this.currentPattern = spec.pattern;
    if (spec.platform && spec.platform !== this.platform()?.id && this.setPlatform(spec.platform, false)) notes.push(zh ? `已切换平台：${spec.platform}` : `Platform: ${spec.platform}`);
    const imageOkEarly = this.plugin.ai.imageReady(); const picture = !!spec.imagePrompt && imageOkEarly;
    let role: 'background' | 'side' | undefined = picture ? spec.imageRole ?? 'background' : undefined;
    // An omitted template keeps the current one, like every other omitted field; only a blank canvas falls back to the platform default.
    const tpl = (spec.template ? templateById(spec.template) : undefined) ?? templateById(d.template ?? this.templateId ?? '') ?? templatesFor(this.platform()?.id)[0]!;
    if (role === 'side' && !tpl.slot?.({ width: d.width, height: d.height, title: '', subtitle: '', zh })) role = 'background';
    // Re-theming or re-wording must not throw away a picture the user already likes: keep artwork unless this design brings new.
    const newArt = !!spec.imagePrompt || !!spec.subjectPrompt; const keep = newArt ? [] : spec.decor ? ['image', 'subject'] : ['image', 'subject', 'decor'];
    // An omitted palette keeps the current colours, so a font-only or copy-only tweak does not reset the theme.
    const themed = !spec.palette && this.palette ? { ...spec, palette: { ...this.palette } } : spec;
    this.applyTemplate(tpl.id, themed, keep); notes.push(zh ? `已套用模板：${tpl.zh}` : `Template: ${tpl.en}`);
    this.finishLayout(spec, !!spec.subjectPrompt && imageOkEarly);
    // Vector decoration is free (the chat model drew it), so it never waits on or depends on an image model.
    if (spec.decor?.length) { notes.push(await this.addDecor(spec.decor.slice(0, spec.subjectPrompt && imageOkEarly ? 1 : 2))); this.calm(); }
    if (pairing) await this.applyLatinFaces(pairing);
    notes.push(...this.qualityPass());
    const jobs: Promise<void>[] = []; const fail = (e: unknown): string => this.t('imageFailed', { message: e instanceof Error ? e.message : String(e) });
    const imageOk = this.plugin.ai.imageReady();
    if (spec.imagePrompt && !role) notes.push(this.t('imageSkipped'));
    else if (spec.imagePrompt && role) jobs.push(this.generateImage(spec.imagePrompt, role).then(n => { notes.push(n); }, (e: unknown) => { notes.push(fail(e)); }));
    if (spec.subjectPrompt) {
      if (!imageOk) notes.push(this.t('imageSkipped'));
      else jobs.push(this.generateSubject(spec.subjectPrompt, spec.subjectAt).then(n => { notes.push(n); }, (e: unknown) => { notes.push(fail(e)); }));
    }
    if (jobs.length) this.setProgress(this.t(spec.subjectPrompt ? 'progressSubject' : 'progressImage'));
    await Promise.all(jobs);
    notes.push(...this.qualityPass(), ...this.thumbIssues());
    return notes;
  }
  /** Shows what the designer is doing, in the chat and as a floating chip over the canvas, so a 30 s picture never looks like a hang. */
  setProgress(text = ''): void {
    this.progress = text; const host = this.centerEl;
    if (host && text) {
      if (!this.progressEl?.isConnected) { this.progressEl = host.createDiv('qc-progress'); setIcon(this.progressEl.createSpan({ cls: 'qc-progress-icon' }), 'loader-circle'); this.progressEl.createSpan({ cls: 'qc-progress-text' }); }
      this.progressEl.querySelector('.qc-progress-text')!.textContent = text;
    } else { this.progressEl?.remove(); this.progressEl = undefined; }
    this.onChat?.();
  }
  /** Runs after a design: keeps text off platform UI (avatar, duration badge, stats bar) and readable on its background. Returns what it fixed. */
  qualityPass(): string[] { return this.followTitle(() => this.qualityChecks()); }
  private qualityChecks(): string[] {
    const c = this.canvas, d = this.design; if (!c || !d) return [];
    const notes: string[] = []; const pf = this.platform();
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && !o.lockMovementX);
    let moved = 0;
    if (pf?.avoid.length) {
      const zones = pf.avoid.map(z => ({ x: z.x * d.width, y: z.y * d.height, w: z.w * d.width, h: z.h * d.height, zh: z.zh, en: z.en }));
      moved = clearCopyOfZones(c.getObjects(), zones, d.width, d.height);
    }
    if (moved) notes.push(this.zh ? `已让 ${moved} 处文字避开平台遮挡区` : `Moved ${moved} text layer${moved > 1 ? 's' : ''} clear of platform UI`);
    const bg = d.bg?.kind === 'solid' ? d.bg.color : d.bg?.kind === 'linear' ? d.bg.from : undefined;
    const fullBleed = c.getObjects().some(o => (o as QObject).qcRole === 'image' && !o.clipPath);
    let fixed = 0;
    const panels = c.getObjects().filter(o => !(o instanceof Textbox) && !(o instanceof FabricImage) && !['decor', 'subject', 'image', 'scrim'].includes((o as QObject).qcRole ?? '') && o.opacity >= 0.5);
    const onPanel = (t: Textbox): boolean => panels.some(p => { const r = p.getBoundingRect(); const cx = t.left + t.getScaledWidth() / 2, cy = t.top + t.getScaledHeight() / 2; return cx > r.left && cx < r.left + r.width && cy > r.top && cy < r.top + r.height && r.width < d.width * 0.98; });
    for (const t of texts) {
      // A badge has its own opaque background; testing it against the page can erase readable label text.
      const backdrop = t instanceof BadgeBox ? t.badgeBg : !fullBleed && !onPanel(t) ? bg : undefined;
      if (!backdrop || t.textBackgroundColor || t.stroke || typeof t.fill !== 'string') continue;
      const next = ensureReadable(t.fill, backdrop); if (next === t.fill) continue;
      // A colour the user just asked for is theirs: keep it, say why it may be hard to read, and offer the fix as a suggestion.
      if (this.chosenColor.has(t)) { const ratio = contrast(t.fill, backdrop) ?? 1; this.turnNotes.push(this.t('lowContrast', { what: this.layerLabel(t), ratio: ratio.toFixed(1) })); continue; }
      t.set({ fill: next }); fixed++;
    }
    if (fixed) notes.push(this.zh ? `已提高 ${fixed} 处文字的对比度` : `Raised contrast on ${fixed} text layer${fixed > 1 ? 's' : ''}`);
    if (moved || fixed) { c.requestRenderAll(); this.changed(); this.refreshInspector(true); }
    return notes;
  }
  /** Index just below the first text layer: pictures and stickers sit behind the words, above the background. */
  private belowText(): number { const c = this.canvas!; const i = c.getObjects().findIndex(o => o instanceof Textbox); return i < 0 ? c.getObjects().length : i; }
  /** Where the subject will be (or is): its real box once it exists, otherwise the region the placement rules reserve for it. */
  private subjectBox(): SubjectBox {
    const sub = this.canvas!.getObjects().find(o => (o as QObject).qcRole === 'subject');
    if (sub) return { cx: sub.left + sub.getScaledWidth() / 2, cy: sub.top + sub.getScaledHeight() / 2, w: sub.getScaledWidth(), h: sub.getScaledHeight() };
    return defaultSubjectBox(this.design!.width, this.design!.height);
  }
  /** Centre and width for a piece, resolved from what it is attached to, so decoration follows the subject and the headline. */
  private decorPlace(a: Anchor, ratio: number, kind = ''): { cx: number; cy: number; width: number } {
    const d = this.design!; const title = this.canvas!.getObjects().find((o): o is Textbox & QObject => o instanceof Textbox && (o as QObject).qcRole === 'title');
    const tb: TitleBox | undefined = title ? { left: title.left, top: title.top, height: title.getScaledHeight(), fontSize: title.fontSize * title.scaleY, lastLineWidth: title.getLineWidth(Math.max(0, title.textLines.length - 1)) * title.scaleX } : undefined;
    return decorPlacement(a, ratio, kind, { width: d.width, height: d.height, subject: this.subjectBox(), title: tb });
  }
  /** A filled vector shape from an SVG path (24 × 24 box), in the palette accent so it matches the cover; fill and stroke stay editable. */
  addPathShape(d24: string, ratio = 1): void {
    const c = this.canvas, d = this.design; if (!c || !d) return;
    const o = new Path(d24, { fill: this.palette?.accent ?? '#2563eb', originX: 'center', originY: 'center' });
    const target = Math.min(d.width, d.height) * 0.26; const k = target / Math.max(o.width, o.height, 1);
    o.set({ scaleX: k * ratio, scaleY: k, left: d.width / 2, top: d.height / 2 }); o.setCoords(); c.add(o); c.setActiveObject(o); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** Drops a sticker or icon on the canvas as an editable vector group, centred and sized to about a fifth of the cover. */
  async addAssetSvg(svg: string, meta: { asset?: string; tone?: string } = {}): Promise<QObject | undefined> {
    const c = this.canvas, d = this.design; if (!c || !d) return undefined;
    const parsed = await loadSVGFromString(svg); const objects = parsed.objects.filter((o): o is FabricObject => !!o); if (!objects.length) throw new Error('empty svg');
    const group = util.groupSVGElements(objects, parsed.options) as QObject;
    if (meta.asset) group.qcAsset = meta.asset; if (meta.tone) group.qcTone = meta.tone;
    const target = Math.min(d.width, d.height) * 0.22; const scale = target / Math.max(group.width, group.height, 1);
    group.set({ scaleX: scale, scaleY: scale, left: d.width / 2, top: d.height / 2, originX: 'center', originY: 'center' });
    c.add(group); c.setActiveObject(group); group.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return group;
  }
  /** A photo as the full-bleed background: replaces any earlier background picture, sits under everything else. */
  async addBackgroundPhoto(blob: Blob, credit: string): Promise<void> {
    const generation = this.generation; const url = await this.prepareImage(blob, true);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c || !this.design) return;
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'image' && !o.clipPath)) c.remove(old);
    (image as QObject).qcRole = 'image'; (image as QObject).qcPrompt = undefined; (image as FabricObject & { qcCredit?: string }).qcCredit = credit;
    this.fitImage(image, 'cover'); c.add(image);
    const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim'); c.moveObjectTo(image, Math.max(0, scrim < 0 ? 0 : scrim));
    image.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }
  /** Adds pieces from the decoration library as editable vector groups, coloured from the current palette. */
  async addDecor(list: DecorSpec[]): Promise<string> {
    const c = this.canvas, d = this.design; if (!c || !d) return '';
    const p = this.palette ?? { ink: '#171717', accent: '#ef4444', sub: '#737373', bg2: '#e5e5e5', accentInk: '#ffffff' };
    const generation = this.generation; let added = 0;
    for (const item of list) {
      try {
        const art = drawDecor(item.kind, p, item.tone); if (!art) continue;
        const parsed = await loadSVGFromString(art.svg); const objects = parsed.objects.filter((o): o is FabricObject => !!o);
        if (!objects.length) continue;
        const group = util.groupSVGElements(objects, parsed.options) as FabricObject;
        if (generation !== this.generation || this.closingView || !this.canvas) return '';
        const anchor = { at: item.at ?? 'canvas', x: item.x, y: item.y, w: item.w } as const;
        const pos = this.decorPlace(anchor, art.ratio, item.kind); const scale = pos.width / Math.max(1, group.width);
        group.set({ scaleX: scale, scaleY: scale, left: pos.cx, top: pos.cy, originX: 'center', originY: 'center', angle: item.rotate ?? 0, opacity: item.opacity ?? 1 });
        (group as QObject).qcRole = 'decor'; (group as QObject).qcKind = item.kind; (group as QObject).qcAnchor = JSON.stringify(anchor);
        if (anchor.at === 'title') reserveBelowTitle(c.getObjects(), pos.cy + pos.width / art.ratio / 2);
        this.placeDecorLayer(group); group.setCoords(); added++;
      } catch { /* a piece that fails to import is skipped, the rest still land */ }
    }
    if (added) { c.requestRenderAll(); this.changed(); this.refreshInspector(true); }
    return added ? (this.zh ? `已添加 ${added} 个矢量装饰（可编辑）` : `Added ${added} editable vector decoration${added > 1 ? 's' : ''}`) : '';
  }
  /** Background structure goes behind the subject, small marks in front of it, and everything stays under the text. */
  private placeDecorLayer(o: FabricObject): void {
    const c = this.canvas!; const kind = (o as QObject).qcKind ?? '';
    if (decorInFront(kind)) { c.insertAt(this.belowText(), o); return; }
    const objs = c.getObjects(); const sub = objs.findIndex(x => (x as QObject).qcRole === 'subject');
    let floor = 0; objs.forEach((x, i) => { const r = (x as QObject).qcRole; if ((r === 'image' && !x.clipPath) || r === 'scrim') floor = i + 1; });
    c.insertAt(sub >= 0 ? sub : floor, o);
  }
  /** After the subject lands or moves, pieces attached to it are re-centred and re-sized on its real box, and front marks return above it. */
  private reanchorDecor(): void {
    const c = this.canvas; if (!c) return;
    for (const o of c.getObjects()) {
      const q = o as QObject; if (q.qcRole !== 'decor' || !q.qcAnchor) continue;
      let a: Anchor; try { a = JSON.parse(q.qcAnchor) as Anchor; } catch { continue; }
      const ratio = o.width / Math.max(1, o.height); const pos = this.decorPlace(a, ratio); const scale = pos.width / Math.max(1, o.width);
      o.set({ scaleX: scale, scaleY: scale, left: pos.cx, top: pos.cy, originX: 'center', originY: 'center' }); o.setCoords();
    }
    const fronts = c.getObjects().filter(o => (o as QObject).qcRole === 'decor' && decorInFront((o as QObject).qcKind ?? ''));
    for (const o of fronts) { c.remove(o); c.insertAt(this.belowText(), o); }
    const behind = c.getObjects().filter(o => (o as QObject).qcRole === 'decor' && !decorInFront((o as QObject).qcKind ?? ''));
    const sub = c.getObjects().findIndex(x => (x as QObject).qcRole === 'subject');
    if (sub >= 0) for (const o of behind) { if (c.getObjects().indexOf(o) > sub) { c.remove(o); c.insertAt(c.getObjects().findIndex(x => (x as QObject).qcRole === 'subject'), o); } }
  }
  /** Generates one subject on a flat key colour, cuts it out locally and adds it as its own transparent layer. Falls back to the full picture. */
  async generateSubject(prompt: string, at: 'left' | 'right' | 'center' | undefined, keep?: FabricObject): Promise<string> {
    const d = this.design; if (!this.canvas || !d) throw new Error('no-canvas');
    const generation = this.generation;
    const pic = await this.plugin.ai.image(prompt, d.width, d.height, imageStyleById(this.plugin.settings.imageStyle).prompt, true);
    if (generation !== this.generation || this.closingView) return this.t('imageDropped');
    const bitmap = await this.win.createImageBitmap(new Blob([pic.data], { type: pic.type }));
    let blob: Blob | undefined; let cut = false;
    try {
      const cv = this.doc.createElement('canvas'); cv.width = bitmap.width; cv.height = bitmap.height;
      const ctx = cv.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
      const px = ctx.getImageData(0, 0, cv.width, cv.height); const out = cutout(px.data, cv.width, cv.height);
      const box = out ? opaqueBounds(out.data, cv.width, cv.height) : undefined;
      if (out && box) {
        px.data.set(out.data); ctx.putImageData(px, 0, 0);
        const crop = this.doc.createElement('canvas'); crop.width = box.w; crop.height = box.h; crop.getContext('2d')!.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        blob = await new Promise<Blob | null>(r => crop.toBlob(r, 'image/png')) ?? undefined; cut = !!blob;
      }
    } finally { bitmap.close(); }
    const url = await this.prepareImage(blob ?? new Blob([pic.data], { type: pic.type }), !cut);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c) return this.t('imageDropped');
    const was = keep ?? c.getObjects().find(o => (o as QObject).qcRole === 'subject');
    const spot = was ? { cx: was.left + was.getScaledWidth() / 2, cy: was.top + was.getScaledHeight() / 2, h: was.getScaledHeight() } : undefined;
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'subject')) c.remove(old);
    (image as QObject).qcRole = 'subject'; (image as QObject).qcPrompt = prompt;
    for (const f of c.getObjects().filter(o => (o as QObject).qcRole === 'flourish')) c.remove(f);
    const portrait = d.height > d.width * 1.1;
    const boxW = portrait ? d.width * 0.86 : d.width * 0.46, boxH = portrait ? d.height * 0.5 : d.height * 0.9;
    const s = Math.min(boxW / image.width, boxH / image.height);
    const side = at ?? (portrait ? 'center' : 'right');
    const w = image.width * s, h = image.height * s;
    image.set({ scaleX: s, scaleY: s, left: side === 'left' ? d.width * 0.04 : side === 'right' ? d.width - w - d.width * 0.04 : (d.width - w) / 2, top: portrait ? d.height - h - d.height * 0.03 : (d.height - h) / 2 });
    if (keep && spot) { const k = spot.h / image.height; image.set({ scaleX: k, scaleY: k, left: spot.cx - (image.width * k) / 2, top: spot.cy - spot.h / 2 }); }
    c.insertAt(this.belowText(), image); image.setCoords(); this.reanchorDecor(); if (!keep) this.calm(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return cut ? (this.zh ? '已生成主体（透明图层，可拖动）' : 'Subject added as a transparent layer') : (this.zh ? '主体抠图失败，已作为整图放入' : 'Cut-out failed; added the full picture');
  }
  /** Asks the image model for a picture and places it behind the text (full bleed) or in the template's picture slot. */
  async generateImage(prompt: string, role: 'background' | 'side'): Promise<string> {
    const d = this.design; if (!this.canvas || !d) throw new Error('no-canvas');
    if (!this.plugin.ai.imageReady()) return this.t('imageSkipped');
    const generation = this.generation;
    const pic = await this.plugin.ai.image(prompt, d.width, d.height, imageStyleById(this.plugin.settings.imageStyle).prompt);
    if (generation !== this.generation || this.closingView) return this.t('imageDropped');
    const url = await this.prepareImage(new Blob([pic.data], { type: pic.type }), true);
    const image = await FabricImage.fromURL(url);
    const c = this.canvas; if (generation !== this.generation || this.closingView || !c) return this.t('imageDropped');
    for (const old of c.getObjects().filter(o => (o as QObject).qcRole === 'image')) c.remove(old);
    (image as QObject).qcRole = 'image'; (image as QObject).qcPrompt = prompt;
    const slot = role === 'side' ? templateById(this.templateId ?? '')?.slot?.({ width: d.width, height: d.height, title: '', subtitle: '', zh: this.zh }) : undefined;
    if (slot) {
      const s = Math.max(slot.w / image.width, slot.h / image.height);
      image.set({ scaleX: s, scaleY: s, left: slot.x + (slot.w - image.width * s) / 2, top: slot.y + (slot.h - image.height * s) / 2, clipPath: new Rect({ left: slot.x, top: slot.y, width: slot.w, height: slot.h, rx: slot.radius, ry: slot.radius, absolutePositioned: true }) });
      const firstText = c.getObjects().findIndex(o => o instanceof Textbox);
      c.insertAt(firstText < 0 ? c.getObjects().length : firstText, image);
    } else {
      this.fitImage(image, 'cover'); c.add(image);
      const scrim = c.getObjects().findIndex(o => (o as QObject).qcRole === 'scrim');
      c.moveObjectTo(image, Math.max(0, scrim < 0 ? 0 : scrim));
    }
    image.setCoords(); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return this.zh ? '已生成配图' : 'Picture added';
  }
  private canvasItems(): CanvasItem[] {
    return (this.canvas?.getObjects() ?? []).slice(0, 14).map((o): CanvasItem => {
      const q = o as QObject;
      if (o instanceof Textbox) return { kind: 'text', role: q.qcRole, text: o.text.trim(), size: Math.round(o.fontSize * o.scaleY), color: typeof o.fill === 'string' ? o.fill : undefined };
      return { kind: o instanceof FabricImage ? 'image' : 'shape', role: q.qcRole };
    });
  }
  assistantInput(prompt: string, source = this.noteContext): AssistantInput {
    const sel = this.selection()[0];
    // Failed turns (prose-only replies the model narrated without acting) stay OUT of history:
    // the model imitates its own past replies, so one bad example breeds more.
    const history = conversationContext(this.chat.slice(0, -1));
    const texts = (this.canvas?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox);
    const titleFont = texts.find(o => o.qcRole === 'title')?.fontFamily, bodyFont = texts.find(o => o.qcRole === 'subtitle')?.fontFamily;
    const template = this.design?.template ?? this.templateId;
    const book = this.plugin.fonts.catalog();
    const nodes = this.sceneNodes(), meta = this.sceneMeta();
    const ids = this.inTurn ? this.turnSelection : meta.selection;
    if (this.inTurn) meta.selection = [...(ids ?? [])];
    return {
      source,
      editScope: ids?.length ? { kind: 'selection', ids: [...ids] } : { kind: 'canvas' },
      prompt, zh: this.zh, fonts: book.map(f => f.family), platform: this.platform()?.id, size: { width: this.design!.width, height: this.design!.height },
      selected: sel instanceof Textbox ? sel.text : undefined, canvas: this.canvasItems(), scene: { nodes, meta }, history, imageStyle: imageStyleById(this.plugin.settings.imageStyle).prompt || undefined, pattern: this.currentPattern, noPicture: !(this.pictureRequested || requestsPicture(prompt)) || this.plugin.settings.imageStyle === 'none', chooseDesigns: !ids?.length && !(this.pictureRequested || requestsPicture(prompt)), series: this.plugin.settings.series,
      state: { ...(template ? { template } : {}), ...(this.palette ? { palette: this.palette } : {}), ...(titleFont ? { titleFont } : {}), ...(bodyFont ? { bodyFont } : {}) },
      fontBook: book.map(f => ({ family: f.family, source: f.source, ...(f.zh ? { zh: f.zh } : {}), ...(f.mood ? { mood: f.mood } : {}), ...(f.hint ? { hint: f.hint } : {}), ...(f.cjk !== undefined ? { cjk: f.cjk } : {}) })),
      photoSearch: hasSource({ key: unsplashKey(this.app, this.plugin.settings.unsplashSecret), proxy: this.plugin.settings.unsplashProxy }),
    };
  }
  /** Sends a request to the selected assistant and applies what comes back. Shared by the chat box, retry and auto-design. */
  async ask(prompt: string, display = prompt, options: { applyFirst?: boolean } = {}): Promise<void> {
    if (this.busy || this.restoring || !this.canvas) return;
    const list = this.plugin.assistantList(); const extras = list.some(p => p.id !== 'ai' && p.id !== 'offline'); const provider = (extras ? list.find(p => p.id === this.plugin.settings.assistant) : list.find(p => p.id === 'ai')) ?? list[0]!;
    const generation = this.generation;
    this.busy = true; this.lastPrompt = prompt; this.chat.push({ role: 'user', text: display });
    if (this.activeConversation && !this.activeConversation.title) this.activeConversation.title = conversationTitle(this.chat);
    this.setProgress(this.t('progressPlan'));
    this.beginTurn();
    try {
      const colour = this.turnSelection?.length ? simpleColour(prompt) : undefined;
      const readsSource = !colour && provider.id !== 'offline' && (provider.id !== 'ai' || this.plugin.ai.ready());
      const source = readsSource ? await this.prepareSource(prompt, generation) : undefined;
      if (generation !== this.generation || this.closingView || (readsSource && this.design?.source && !source)) return;
      const request = this.assistantInput(prompt, source);
      let result: AssistantResult = colour ? { reply: this.t('chatSelectionUpdated'), ops: [{ op: 'recolor', target: [...this.turnSelection!], color: colour }] } : picturePolicy(await provider.run(request), !request.noPicture);
      if (generation !== this.generation) return;
      // One silent second chance: models sometimes narrate instead of emitting commands, and a reworded
      // nudge usually snaps them back to JSON. The miss never reaches the chat or the history.
      if (!result.ops.length && !result.designs?.length && !result.options?.length) {
        result = picturePolicy(await provider.run({ ...request, prompt: `${prompt}\n\n${this.t('noOpsHint')}` }), !request.noPicture);
        if (generation !== this.generation) return;
      }
      const scoped = guardSelection(result, request); result = scoped.result;
      // Two or more full design commands are layout proposals to choose from; a single design command on an
      // existing cover is a tweak (new colours, new fonts) and must apply right away, not turn into candidates.
      const designOps = request.chooseDesigns ? result.ops.filter((o): o is Extract<Op, { op: 'design' }> => o.op === 'design' && !!o.title) : [];
      const proposals = result.designs?.length ? result.designs : designOps.length > 1 ? designOps : [];
      if (proposals.length) {
        const variants = await this.designChoices(proposals);
        if (generation !== this.generation || !this.canvas) return;
        if (!variants.length) throw new Error(this.t('previewFailed'));
        const message: ChatMessage = { role: 'assistant', text: this.t('chooseDirection'), variants };
        if (options.applyFirst && !this.turnSelection?.length) {
          if (!await this.applyVariant(message, variants[0]!)) return;
          message.text = this.t('firstDirectionApplied');
        }
        this.chat.push(message);
        return;
      }
      // The model would rather ask than guess: show its question with tappable answers and change nothing.
      if (!result.ops.length && !scoped.problems.length && result.options?.length) {
        this.chat.push({ role: 'assistant', text: result.reply || this.t('chatNothing'), options: result.options });
        return;
      }
      // The model narrated a change but issued no commands (or none survived validation): say so, offer a retry,
      // instead of letting a "done" claim stand over an untouched canvas.
      if (!result.ops.length && !scoped.problems.length) {
        this.chat.push({ role: 'assistant', text: result.reply || this.t('chatNothing'), warn: [this.t('aiNoOps')], retry: true });
        return;
      }
      if (!this.canvas) return;
      const run = await this.runAssistantOps(result.ops); run.problems.push(...scoped.problems); let reply = result.reply;
      // Closed loop: commands that could not be carried out (a missing #id, no library match) go back to the model once,
      // with the fresh scene, and its corrected commands run in the same turn and the same undo step.
      if (run.problems.length && !colour && provider.id !== 'offline' && generation === this.generation && this.canvas) {
        this.setProgress(this.t('progressFix'));
        const secondInput = { ...this.assistantInput(prompt, request.source), feedback: run.problems };
        const correction = guardSelection(picturePolicy(await provider.run(secondInput), !request.noPicture), secondInput);
        const second = correction.result;
        if (generation !== this.generation || !this.canvas) return;
        if (second.ops.length) { const again = await this.runAssistantOps(second.ops); run.done.push(...again.done); run.problems = [...again.problems, ...correction.problems]; if (second.reply) reply = second.reply; }
      }
      if (!this.turnSelection?.length) run.done.push(...this.selfCheck());
      if (this.turnSelection?.length) reply = this.t(run.problems.length ? 'chatSelectionBlocked' : 'chatSelectionUpdated');
      const applied = run.done;
      const designed = result.ops.some(o => o.op === 'design');
      const message: ChatMessage = { role: 'assistant', text: reply || (applied.length ? this.t('chatDone') : this.t('chatNothing')), applied: usefulFeedback(applied), retry: designed, tweaks: applied.length > 0 };
      if (run.problems.length) { message.warn = run.problems; message.retry = true; }
      if (this.turnNotes.length) message.warn = [...(message.warn ?? []), ...new Set(this.turnNotes)];
      if (this.turnPicks.length) message.picks = this.turnPicks.slice(-3);
      if (applied.length) { message.snapshot = this.snapshot(); if (!this.turnSelection?.length) message.suggestions = this.thumbSuggestions(); }
      this.chat.push(message);
      if (designed) void this.variantThumbs().then(v => { message.variants = v; this.onChat?.(); }).catch(() => undefined);
    } catch (e) {
      if (generation !== this.generation) return;
      this.chat.push({ role: 'assistant', text: this.t('error', { message: e instanceof Error ? e.message : String(e) }), failed: true });
    } finally { if (generation === this.generation) { this.endTurn(); this.busy = false; this.pictureRequested = false; this.persistChat(); this.setProgress(); } }
  }
  /**
   * Other layouts for the same words, rendered offline in a blink, so a first pass is a choice and not a gamble. They come from
   * different style families and follow the copy (a number, a question, a list), and use the fonts each layout really gets.
   */
  async designChoices(proposals: DesignSpec[]): Promise<Variant[]> {
    const d = this.design; if (!d) return [];
    const specs = proposals.slice(0, DESIGN_PREVIEW_LIMIT).map(withoutPictures).filter((s, i, all) => all.findIndex(p => p.template === s.template) === i);
    if (!specs.length) return [];
    if (specs.length < DESIGN_PREVIEW_LIMIT) {
      const seed = specs[0]!;
      const ids = pickVariants(templatesFor(this.platform()?.id).filter(t => !t.photo && !t.slot && !specs.some(s => s.template === t.id)).map(t => t.id), seed.template, { title: seed.title ?? '', subtitle: seed.subtitle }, DESIGN_PREVIEW_LIMIT - specs.length);
      for (const id of ids) specs.push({ ...seed, template: id, titleFont: undefined, bodyFont: undefined, palette: undefined });
    }
    const out: Variant[] = [];
    for (const input of specs) {
      const spec = expandPattern(input, f => this.plugin.fonts.available(this.doc, f));
      delete spec.pattern; delete spec.decor;
      let t = templateById(spec.template ?? ''); if (!t) continue;
      // A text-first proposal must be complete without an empty photo/subject slot.
      if (t.photo || t.slot) { t = templateById('highlight')!; spec.template = t.id; }
      const platform = spec.platform ? platformById(spec.platform) : undefined;
      const pair = this.pairing(t.id); const fonts = this.plugin.fonts; const usable = (f: string): boolean => fonts.available(this.doc, f) || fonts.isLibraryFamily(f);
      const typeset = pairingById(spec.typeset); if (typeset) { spec.titleFont ??= typeset.title; spec.bodyFont ??= typeset.body; }
      if (spec.titleFont && usable(spec.titleFont)) pair.title = spec.titleFont;
      if (spec.bodyFont && usable(spec.bodyFont)) pair.body = spec.bodyFont;
      if (spec.titleFont) pair.titleBold = !isSingleWeight(spec.titleFont);
      if (pair.title) await this.plugin.fonts.ensure(this.doc, pair.title);
      if (pair.body) await this.plugin.fonts.ensure(this.doc, pair.body);
      const url = await templateThumb(this.doc, this.zh, platform?.width ?? d.width, platform?.height ?? d.height, t, spec.title ?? '', spec.subtitle ?? '', { badge: spec.badge, points: spec.points, pair, palette: spec.palette });
      out.push({ id: t.id, label: spec.title ?? (this.zh ? t.zh : t.en), spec, url });
    }
    return out;
  }
  async chooseVariant(message: ChatMessage, variant: Variant): Promise<void> {
    if (this.busy || this.task || this.restoring || !this.canvas) return;
    this.busy = true; this.onChat?.();
    try {
      await this.applyVariant(message, variant);
    } catch (e) { new Notice(this.t('error', { message: e instanceof Error ? e.message : String(e) })); }
    finally { this.busy = false; this.onChat?.(); this.persistChat(); }
  }
  /** Initial creation and later choice clicks use the same editable layout and selected state. */
  private async applyVariant(message: ChatMessage, variant: Variant): Promise<boolean> {
    const generation = this.generation, canvas = this.canvas;
    if (!canvas) return false;
    const applied = variant.spec ? usefulFeedback(await this.applyDesign(withoutPictures(variant.spec))) : undefined;
    if (generation !== this.generation || canvas !== this.canvas || this.closingView) return false;
    if (!variant.spec) this.applyTemplate(variant.id, {}, true);
    message.applied = applied;
    for (const v of message.variants ?? []) v.selected = v === variant;
    message.text = this.t('directionApplied'); message.tweaks = true;
    message.snapshot = this.snapshot(); message.suggestions = this.thumbSuggestions();
    return true;
  }
  /** Returns the canvas to the state captured right after that chat turn — the chat doubles as a version history. */
  async restoreSnapshot(snapshot: string): Promise<void> {
    if (this.busy || !this.canvas) return;
    let d: Design; try { d = this.codec.decode(snapshot); } catch { return; }
    this.restoring = true;
    try {
      this.canvas.discardActiveObject(); await this.canvas.loadFromJSON(d.canvas); this.design = d; await this.afterLoad();
      this.applyZoom(); this.updatePlatformLabel(); this.renderGuides();
    } finally { this.restoring = false; }
    this.dirty = true; ++this.revision; this.refreshAll(); this.commitHistory(); await this.flush();
    new Notice(this.t('msgRestored'));
  }
  async variantThumbs(n = DESIGN_PREVIEW_LIMIT): Promise<Variant[]> {
    const d = this.design, c = this.canvas; if (!d || !c) return [];
    const copy = this.copyText(); const hasPhoto = c.getObjects().some(o => (o as QObject).qcRole === 'image' && !o.clipPath);
    const candidates = templatesFor(this.platform()?.id).filter(t => !['checklist', 'compare'].includes(t.id) && (hasPhoto || !t.photo)).map(t => t.id);
    const out: Variant[] = [];
    for (const id of pickVariants(candidates, this.templateId, { title: copy.title, subtitle: copy.subtitle, points: this.lastSpec?.points }, Math.min(DESIGN_PREVIEW_LIMIT, n))) {
      const t = templateById(id); if (!t) continue;
      const sc = new StaticCanvas(this.doc.createElement('canvas'), { width: d.width, height: d.height, enableRetinaScaling: false });
      usePairing(this.pairing(t.id));
      try {
        const r = t.build({ width: d.width, height: d.height, title: copy.title, subtitle: copy.subtitle, badge: copy.badge, points: this.lastSpec?.points, zh: this.zh });
        for (const o of r.objects) sc.add(o);
        sc.backgroundColor = r.background.kind === 'solid' ? r.background.color : gradient(d.width, d.height, r.background.from, r.background.to, r.background.angle);
        sc.renderAll(); out.push({ id: t.id, label: this.zh ? t.zh : t.en, url: sc.toDataURL({ format: 'jpeg', quality: 0.72, multiplier: Math.min(1, 280 / d.width) }) });
      } catch { /* a layout that cannot be previewed is simply not offered */ } finally { usePairing(undefined); void sc.dispose(); }
    }
    return out;
  }
  /** A/B on demand: up to seven different directions for the current words. */
  async showVariants(): Promise<void> {
    if (!this.canvas) return;
    this.plugin.settings.drawer = 'assistant'; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom();
    const message: ChatMessage = { role: 'assistant', text: this.t('abTitle') }; this.chat.push(message); this.onChat?.();
    message.variants = await this.variantThumbs(); this.onChat?.();
  }
  /* ---------- series: one look reused across covers ---------- */
  /** Saves the current layout, colours and faces as a series (newest first; the first one is the default). */
  saveSeries(): Series | undefined {
    const d = this.design, c = this.canvas; if (!d?.template || !c) return undefined;
    const t = templateById(d.template); const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox);
    const face = (role: string): string | undefined => { const f = texts.find(o => o.qcRole === role)?.fontFamily; return f && !['sans-serif', 'serif', 'monospace'].includes(f) ? f : undefined; };
    const palette = { ...(this.palette ?? {}) }; const titleFont = face('title'), bodyFont = face('subtitle');
    const list = this.plugin.settings.series;
    const base = t ? (this.zh ? t.zh : t.en) : d.template; const taken = new Set(list.map(x => x.name)); let n = 1; while (taken.has(`${base} ${n}`)) n++;
    const s: Series = { id: `s${Date.now().toString(36)}`, name: `${base} ${n}`, template: d.template, palette, ...(titleFont ? { titleFont } : {}), ...(bodyFont ? { bodyFont } : {}) };
    this.plugin.settings.series = addSeries(list, s); void this.plugin.saveSettings(); return s;
  }
  removeSeries(id: string): void { this.plugin.settings.series = this.plugin.settings.series.filter(s => s.id !== id); void this.plugin.saveSettings(); }
  /** Re-lays the cover in a saved look, keeping the words, picture and decoration. */
  async applySeries(id: string): Promise<void> {
    const s = this.plugin.settings.series.find(x => x.id === id); if (!s || !templateById(s.template)) return;
    await this.applyDesign({ template: s.template, palette: s.palette, ...(s.titleFont ? { titleFont: s.titleFont } : {}), ...(s.bodyFont ? { bodyFont: s.bodyFont } : {}) });
    new Notice(this.t('seriesApplied', { name: s.name }));
  }
  /** What the cover looks like as a card in a phone feed: words too small to read, or a headline too long to take in. */
  thumbIssues(): string[] {
    const c = this.canvas, d = this.design; if (!c || !d) return [];
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && ((o as QObject).qcRole === 'title' || ((o as QObject).qcRole === 'subtitle' && !(o instanceof BadgeBox))))
      .map(o => ({ role: o.qcRole as 'title' | 'subtitle', size: o.fontSize * o.scaleY, text: o.qcWrapped ? unwrap(o.text) : o.text }));
    return thumbCheck(texts, d.width, this.platform()?.id).map(x => x.kind === 'long' ? this.t('thumbLong') : this.t('thumbSmall', { role: this.t(x.role === 'title' ? 'roleTitle' : 'roleSubtitle'), px: x.px ?? 0, min: x.min ?? 0 }));
  }
  private thumbTexts(): { role: 'title' | 'subtitle'; size: number; text: string }[] {
    const c = this.canvas; if (!c) return [];
    return c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && ((o as QObject).qcRole === 'title' || ((o as QObject).qcRole === 'subtitle' && !(o instanceof BadgeBox))))
      .map(o => ({ role: o.qcRole as 'title' | 'subtitle', size: o.fontSize * o.scaleY, text: o.qcWrapped ? unwrap(o.text) : o.text }));
  }
  /** Feed-size problems as one-tap fixes, offered on the assistant message right after a change. */
  thumbSuggestions(): Suggestion[] {
    const d = this.design; if (!d) return [];
    const feed = thumbCheck(this.thumbTexts(), d.width, this.platform()?.id).map(x => x.kind === 'small'
      ? { id: `small:${x.role}`, label: this.t('sugBigger', { role: this.t(x.role === 'title' ? 'roleTitle' : 'roleSubtitle') }) }
      : { id: 'long:title', label: this.t('sugShorter') });
    // A colour kept against the readability pass (the user asked for it) gets two ways out that keep the hue.
    const faint = this.faintText()[0]; const role = faint?.qcRole === 'title' || faint?.qcRole === 'subtitle' ? this.t(faint.qcRole === 'title' ? 'roleTitle' : 'roleSubtitle') : this.t('text');
    return faint ? [{ id: 'contrast:stroke', label: this.t('sugOutline', { role }) }, { id: 'contrast:deepen', label: this.t('sugDeepen', { role }) }, ...feed] : feed;
  }
  /** Main copy whose plain colour sits too close to the background to read. */
  private faintText(): (Textbox & QObject)[] {
    const d = this.design, c = this.canvas; const bg = d?.bg?.kind === 'solid' ? d.bg.color : d?.bg?.kind === 'linear' ? d.bg.from : undefined; if (!c || !bg) return [];
    return c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox && ((o as QObject).qcRole === 'title' || (o as QObject).qcRole === 'subtitle')
      && !o.textBackgroundColor && !(o.stroke && o.strokeWidth) && typeof o.fill === 'string' && (contrast(o.fill, bg) ?? 21) < 3);
  }
  /** Runs a feed-size fix: small words grow to the readable floor locally; a long headline asks the designer to shorten it. */
  async runThumbSuggestion(id: string): Promise<void> {
    const [kind, role] = id.split(':');
    if (kind === 'long') { await this.ask(this.t('tweakShortP'), this.t('tweakShort')); return; }
    const d = this.design; if (!d) return;
    if (kind === 'contrast') {
      const bg = d.bg?.kind === 'solid' ? d.bg.color : d.bg?.kind === 'linear' ? d.bg.from : '#ffffff';
      for (const o of this.faintText()) {
        if (role === 'stroke') o.set({ stroke: readableOn(bg), strokeWidth: Math.max(4, Math.round(o.fontSize * (o.scaleY || 1) * 0.05)), paintFirst: 'stroke' });
        else o.set({ fill: toContrast(o.fill as string, bg, 3) });
        o.set('dirty', true);
      }
      this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
    } else if (role === 'title' || role === 'subtitle') {
      const k = (FEED_WIDTH[this.platform()?.id ?? ''] ?? 150) / d.width;
      this.styleText(role, { size: Math.ceil(THUMB_MIN[role] / k) });
    } else return;
    // The turn that offered the fix now reflects the fix: its snapshot and remaining suggestions stay true.
    const last = [...this.chat].reverse().find(m => m.role === 'assistant' && m.suggestions?.length);
    if (last) { last.snapshot = this.snapshot(); last.suggestions = this.thumbSuggestions(); }
    new Notice(this.t(kind === 'contrast' ? 'sugContrastDone' : 'sugDone'));
    this.onChat?.(); this.persistChat();
  }
  private patternCache = new Map<string, Promise<string>>();
  /** Thumbnail of a pattern at this canvas's size (cached per platform and size). */
  patternThumb(id: string): Promise<string> {
    const d = this.design; const p = patternById(id); if (!d || !p) return Promise.reject(new Error('no-pattern'));
    const key = `${d.width}x${d.height}:${id}:${this.zh}`; let hit = this.patternCache.get(key);
    if (!hit) { hit = renderPattern(p, { width: d.width, height: d.height }, this.doc, this.zh, family => this.plugin.fonts.available(this.doc, family)); this.patternCache.set(key, hit); hit.catch(() => this.patternCache.delete(key)); }
    return hit;
  }
  /** Applies a pattern with its sample words straight away. Used when no model is connected. */
  async applyPatternNow(id: string): Promise<void> {
    const p = patternById(id); if (!p || this.busy || !this.canvas) return;
    this.busy = true;
    try {
      const notes = await this.applyDesign({ pattern: id, title: p.sample.title, subtitle: p.sample.subtitle, badge: p.sample.badge, points: p.sample.points });
      // Trying styles is high-frequency and reversible: the canvas and the active card already say it worked,
      // so a toast is enough. Only warnings worth keeping (readability, failures) stay in the chat.
      new Notice(this.t('patternApplied', { name: this.zh ? p.zh : p.en }));
      const applied = usefulFeedback(notes);
      if (applied.length) this.chat.push({ role: 'assistant', text: this.t('patternApplied', { name: this.zh ? p.zh : p.en }), applied });
    }
    finally { this.busy = false; this.onChat?.(); }
  }
  /** Touch edit: redraws one picture layer from its own prompt (optionally edited) and keeps its place on the canvas. */
  async regenerate(target: QObject, prompt: string): Promise<void> {
    if (this.busy || !prompt.trim()) return;
    if (!this.plugin.ai.imageReady()) { new Notice(this.t('imageSkipped')); return; }
    this.busy = true; this.setProgress(this.t(target.qcRole === 'subject' ? 'progressSubject' : 'progressImage'));
    try {
      if (target.qcRole === 'subject') new Notice(await this.generateSubject(prompt.trim(), undefined, target));
      else new Notice(await this.generateImage(prompt.trim(), target.clipPath ? 'side' : 'background'));
    } catch (e) { new Notice(this.t('imageFailed', { message: e instanceof Error ? e.message : String(e) })); } finally { this.busy = false; this.setProgress(); }
  }
  retry(): Promise<void> { return this.ask(`${this.lastPrompt}\n\n${this.t('retryHint')}`, this.t('retry')); }
  /** The note this cover was made for, when it still exists. Lets the empty chat offer a one-click cover. */
  sourceNote(): TFile | undefined { const path = this.design?.source; const f = path ? this.plugin.app.vault.getFileByPath(path) : null; return f && f.extension === 'md' ? f : undefined; }
  /** Read material on submission, so follow-ups and reopened covers always have a source. */
  private async prepareSource(prompt: string, generation: number): Promise<NoteContext | undefined> {
    const design = this.design; if (!design) return;
    const whole = wantsWholeNote(prompt);
    if (!design.source) {
      if (whole) throw new Error(this.t('noteNoSource'));
      return;
    }
    const path = design.source;
    const current = (): boolean => generation === this.generation && design === this.design && design.source === path && !this.closingView;
    this.noteState = 'reading'; this.onNoteContext?.();
    try {
      const selection = !whole ? design.noteSelection : undefined;
      const note = this.sourceNote();
      if (!selection && !note) throw new Error('note-missing');
      const raw = selection ?? await this.plugin.readNote(note!);
      if (!current()) return;
      const result = await prepareNote({ path: design.source, title: note?.basename ?? design.source.replace(/^.*\//, '').replace(/\.md$/, ''), raw, selection: !!selection, cache: design.noteSummary },
        async (...args) => { try { return await this.plugin.ai.summarizeNote(...args); } catch { throw new Error('note-summary-failed'); } }, current);
      if (!current()) return;
      // Persist scope/summary with the design, not in the preview-length chat history.
      if ((whole && design.noteSelection) || JSON.stringify(result.cache) !== JSON.stringify(design.noteSummary)) {
        if (whole) delete design.noteSelection;
        design.noteSummary = result.cache; this.changed();
      }
      this.noteContext = result.context; this.noteState = 'ready'; this.onNoteContext?.();
      return result.context;
    } catch (error) {
      if (!current()) return;
      this.noteContext = undefined; this.noteState = 'error'; this.onNoteContext?.();
      const key = error instanceof Error ? error.message : '';
      throw new Error(this.t(key === 'note-empty' ? 'noteEmpty' : key === 'note-too-large' ? 'noteTooLarge' : key === 'note-summary-failed' ? 'noteSummaryFailed' : key === 'note-missing' ? 'sourceMissing' : 'noteReadError'));
    }
  }
  async coverFromSourceNote(): Promise<void> {
    await this.autoDesign(this.t('noteDesignRequest'));
  }
  private async autoDesign(brief: string): Promise<void> {
    this.plugin.settings.drawer = 'assistant'; void this.plugin.saveSettings(); this.refreshDrawer(); this.applyZoom();
    await this.ask(this.design?.source ? brief : `${this.t('briefPrefix')}\n${brief}`, brief.length > 140 ? `${brief.slice(0, 140)}…` : brief, { applyFirst: true });
  }
  styleText(target: Target, change: TextChange): boolean {
    const c = this.canvas; if (!c) return false;
    const texts = c.getObjects().filter((o): o is Textbox & QObject => o instanceof Textbox);
    let targets: (Textbox & QObject)[];
    if (target === 'title' || target === 'subtitle') {
      const info = this.copyText();
      const hit = texts.find(o => o.qcRole === target) ?? texts.find(o => o.text === (target === 'title' ? info.title : info.subtitle));
      targets = hit ? [hit] : [];
    } else if (target === 'selection') targets = this.texts() as (Textbox & QObject)[];
    else targets = this.targets(target).filter((o): o is Textbox & QObject => o instanceof Textbox);
    if (!targets.length && target === 'selection') targets = texts.filter(o => o.qcRole === 'title').slice(0, 1);
    if (!targets.length) return false;
    const pal = this.currentPalette();
    if (change.font) for (const o of targets) { const issue = this.fontIssue(change.font, change.text ?? o.text); if (issue) throw new OpProblem(issue); }
    for (const o of targets) {
      const props: Record<string, unknown> = {};
      if (change.text !== undefined) props.text = change.text;
      if (change.size) props.fontSize = change.size; if (change.scale) props.fontSize = Math.round(o.fontSize * change.scale);
      const fill = change.color ?? (change.tone ? pal[change.tone] : undefined);
      if (fill) { props.fill = fill; o.qcTone = change.tone ?? toneOf(fill, pal); this.chosenColor.add(o); }
      if (change.bold !== undefined) props.fontWeight = change.bold ? 'bold' : 'normal';
      if (change.italic !== undefined) props.fontStyle = change.italic ? 'italic' : 'normal'; if (change.align) props.textAlign = change.align;
      if (change.lineHeight) props.lineHeight = change.lineHeight; if (change.letterSpacing !== undefined) props.charSpacing = change.letterSpacing;
      if (change.highlight !== undefined) props.textBackgroundColor = change.highlight;
      if (change.stroke !== undefined) { props.stroke = change.stroke || null; props.strokeWidth = change.stroke ? change.strokeWidth ?? Math.max(o.strokeWidth || 0, 4) : 0; props.paintFirst = 'stroke'; }
      else if (change.strokeWidth !== undefined) { props.strokeWidth = change.strokeWidth; props.paintFirst = 'stroke'; }
      o.set(props); if (change.text !== undefined) o.splitByGrapheme = hasCjk(change.text);
      if (change.font) { o.set({ fontFamily: change.font }); void this.plugin.fonts.ensure(this.doc, change.font).then(() => { o.initDimensions(); if (o.qcHug) this.rehug(o); this.canvas?.requestRenderAll(); }); }
      if (change.shadow !== undefined) {
        const glow = typeof props.fill === 'string' ? props.fill : typeof o.fill === 'string' ? o.fill : '#111111';
        o.set({ shadow: SHADOWS[change.shadow]?.(glow) ?? null }); o.qcShadow = change.shadow === 'none' ? undefined : change.shadow;
      }
      o.initDimensions(); if (o.qcHug && (change.text !== undefined || change.size || change.scale || change.letterSpacing !== undefined)) this.rehug(o); o.setCoords(); this.touched.add(this.idOf(o));
    }
    c.requestRenderAll(); this.changed(); this.refreshInspector(true); return true;
  }

  /* ---------- scene graph & layer commands (the assistant's hands) ---------- */
  /** True while an assistant turn runs: its edits become one undo step. */
  private inTurn = false; private turnStart = new Set<string>(); private touched = new Set<string>(); private turnPicks: AssetPick[] = [];
  private turnSelection?: string[];
  private turnSelectedObjects: QObject[] = [];
  /** Text the user explicitly recoloured this turn: the readability pass warns about it instead of silently overriding the choice. */
  private chosenColor = new Set<FabricObject>(); private turnNotes: string[] = [];
  private kindOf(o: QObject): NodeKind {
    const role = o.qcRole ?? '';
    if (o instanceof Textbox) return 'text';
    if (['bgfx', 'grain', 'scrim', 'ghost'].includes(role)) return 'effect';
    if (o instanceof FabricImage) return role === 'subject' ? 'subject' : 'image';
    if (role === 'decor' || role === 'flourish') return 'decor';
    if (o.qcAsset?.startsWith('line:')) return 'icon'; if (o.qcAsset?.startsWith('sticker:')) return 'sticker';
    return 'shape';
  }
  /** The colour a layer shows: text fill, an icon's stroke, a shape's fill (or stroke for lines). */
  private colorOf(o: FabricObject): string | undefined {
    const hexOf = (v: unknown): string | undefined => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
    if (o instanceof Group) { for (const ch of o.getObjects()) { const v = hexOf(ch.stroke) ?? hexOf(ch.fill); if (v) return v; } return undefined; }
    if ((o as QObject).qcAsset?.startsWith('line:') || o instanceof Line) return hexOf(o.stroke) ?? hexOf(o.fill);
    return hexOf(o.fill) ?? hexOf(o.stroke);
  }
  /** Every layer as a scene node. Layers without an id (or sharing one after a copy) get the next free id for their kind. */
  sceneNodes(): SceneNode[] {
    const c = this.canvas; if (!c) return [];
    const objs = c.getObjects() as QObject[]; const kinds = objs.map(o => this.kindOf(o));
    const ids = assignIds(objs.map((o, i) => ({ id: o.qcId, kind: kinds[i]! }))); const pal = this.currentPalette();
    return objs.map((o, i) => {
      o.qcId = ids[i]; const b = o.getBoundingRect(); const kind = kinds[i]!;
      const node: SceneNode = { id: ids[i]!, kind, box: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }, z: i };
      if (o.qcRole) node.role = o.qcRole;
      const name = o.qcAsset ?? (kind === 'decor' || kind === 'shape' || kind === 'effect' ? o.qcKind : undefined); if (name) node.name = name;
      if (o instanceof Textbox) { node.text = o.text.trim(); node.font = o.fontFamily; node.size = Math.round(o.fontSize * o.scaleY); }
      if (kind !== 'sticker' && kind !== 'image' && kind !== 'subject' && kind !== 'effect') { const col = this.colorOf(o); if (col) { node.color = col; const tone = o.qcTone ?? toneOf(col, pal); if (tone) node.tone = tone; } }
      if (o.lockMovementX) node.locked = true; if (o.opacity < 0.99) node.opacity = Math.round(o.opacity * 100) / 100; if (o.angle) node.angle = Math.round(o.angle);
      return node;
    });
  }
  sceneMeta(): SceneMeta {
    const d = this.design!; const pf = this.platform(); const bg = d.bg?.kind === 'solid' ? d.bg.color : d.bg ? `渐变 ${d.bg.from}→${d.bg.to}` : undefined;
    return {
      width: d.width, height: d.height, ...(pf ? { platform: pf.id, platformName: this.zh ? pf.zh : pf.en } : {}),
      ...(pf?.avoid.length ? { avoid: pf.avoid.map(a => ({ zh: a.zh, en: a.en, x: a.x, y: a.y, w: a.w, h: a.h })) } : {}),
      palette: { ...this.currentPalette() }, selection: this.selection().map(o => o.qcId).filter((x): x is string => !!x),
      ...(d.template ? { template: d.template } : {}), ...(bg ? { background: bg + (this.hasMesh() ? '（弥散光）' : '') } : {}),
    };
  }
  /** The id of a layer, assigning ids first when it has none yet. */
  private idOf(o: QObject): string { if (!o.qcId) this.sceneNodes(); return o.qcId ?? ''; }
  /** Layers a target names. Throws an `OpProblem` the model can act on when it names nothing. */
  private targets(target: Target | undefined): QObject[] {
    const c = this.canvas!, d = this.design!; const nodes = this.sceneNodes();
    const last = nodes.filter(n => !this.turnStart.has(n.id) && n.kind !== 'effect').map(n => n.id);
    const ids = resolveTarget(target, nodes, { selection: this.selection().map(o => o.qcId!).filter(Boolean), width: d.width, height: d.height, last });
    const hit = (c.getObjects() as QObject[]).filter(o => o.qcId && ids.includes(o.qcId));
    if (!hit.length) throw new OpProblem(target === undefined || target === 'selection' ? (this.zh ? '没有选中的对象；请用场景里的 #id 指定' : 'Nothing is selected; name a layer by its #id') : (this.zh ? `找不到 ${JSON.stringify(target)}；请用场景里存在的 #id` : `No layer matches ${JSON.stringify(target)}; use an #id from the scene`));
    return hit;
  }
  private boxOf(objs: FabricObject[]): SceneBox {
    const rs = objs.map(o => o.getBoundingRect()); const x = Math.min(...rs.map(r => r.left)), y = Math.min(...rs.map(r => r.top));
    return { x, y, w: Math.max(...rs.map(r => r.left + r.width)) - x, h: Math.max(...rs.map(r => r.top + r.height)) - y };
  }
  /** Moves layers together to a placement; words and platform zones are obstacles for anything that is not itself text. */
  private placeObjects(objs: QObject[], place: Placement, avoidText: boolean): void {
    const d = this.design!; const box = this.boxOf(objs);
    const near = place.near !== undefined ? this.boxOf(this.targets(place.near)) : undefined;
    const others = this.canvas!.getObjects().filter(o => !objs.includes(o as QObject) && o.visible);
    const obstacles = avoidText ? others.filter(o => o instanceof Textbox || ['subject'].includes((o as QObject).qcRole ?? '') || (o as QObject).qcAsset).map(o => this.boxOf([o])) : [];
    const avoid = (this.platform()?.avoid ?? []).map(z => ({ x: z.x * d.width, y: z.y * d.height, w: z.w * d.width, h: z.h * d.height }));
    const onlyNudge = !place.to && !near && place.x === undefined && place.y === undefined;
    const to = onlyNudge ? { x: box.x + (place.dx ?? 0) * d.width, y: box.y + (place.dy ?? 0) * d.height }
      : placeBox({ w: box.w, h: box.h }, { anchor: place.to, near, side: place.side, x: place.x, y: place.y, dx: place.dx, dy: place.dy }, { width: d.width, height: d.height }, obstacles, avoid);
    const dx = to.x - box.x, dy = to.y - box.y;
    for (const o of objs) { o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); }
  }
  private edited(objs: QObject[], note: [string, string]): string {
    for (const o of objs) { o.setCoords(); this.touched.add(this.idOf(o)); }
    this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true); return this.zh ? note[0] : note[1];
  }
  moveLayers(target: Target | undefined, place: Placement): string {
    const objs = this.targets(target).filter(o => !o.lockMovementX); if (!objs.length) throw new OpProblem(this.zh ? '目标已锁定，先解锁（set lock:false）' : 'Target is locked');
    this.placeObjects(objs, place, !objs.every(o => o instanceof Textbox) || !!place.to);
    return this.edited(objs, ['已移动', 'Moved']);
  }
  resizeLayers(target: Target | undefined, o: { scale?: number; w?: number }): string {
    const objs = this.targets(target); const d = this.design!;
    for (const x of objs) {
      const b = x.getBoundingRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const k = o.w ? o.w * d.width / Math.max(b.width, 1) : o.scale ?? 1;
      if (x instanceof Textbox) { x.set({ fontSize: Math.round(x.fontSize * k), width: x.width * k }); x.initDimensions(); if ((x as QObject).qcHug) this.rehug(x as Textbox & QObject); }
      else x.set({ scaleX: x.scaleX * k, scaleY: x.scaleY * k });
      x.setCoords(); const nb = x.getBoundingRect(); x.set({ left: x.left + cx - (nb.left + nb.width / 2), top: x.top + cy - (nb.top + nb.height / 2) });
    }
    return this.edited(objs, ['已调整大小', 'Resized']);
  }
  orderLayers(target: Target | undefined, to: OpOf<'layer'>['to']): string {
    const c = this.canvas!; const objs = this.targets(target);
    for (const o of to === 'front' || to === 'forward' ? objs : [...objs].reverse()) {
      if (to === 'front') c.bringObjectToFront(o); else if (to === 'forward') c.bringObjectForward(o); else if (to === 'backward') c.sendObjectBackwards(o); else c.sendObjectToBack(o);
    }
    // Background effects stay at the very bottom whatever happens above them.
    if (to === 'back') for (const fx of c.getObjects().filter(x => ['bgfx', 'grain'].includes((x as QObject).qcRole ?? '')).reverse()) c.sendObjectToBack(fx);
    return this.edited(objs, ['已调整图层顺序', 'Reordered']);
  }
  removeLayers(target: Target): string {
    const c = this.canvas!; const objs = this.targets(target); c.discardActiveObject(); c.remove(...objs); c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    return this.zh ? `已删除 ${objs.length} 个元素` : `Removed ${objs.length}`;
  }
  async duplicateLayers(target: Target | undefined, count: number): Promise<string> {
    const c = this.canvas!, d = this.design!; const objs = this.targets(target); const step = Math.min(d.width, d.height) * 0.04; const made: QObject[] = [];
    for (let i = 1; i <= count; i++) for (const o of objs) { const copy = await o.clone(PROPS) as QObject; copy.qcId = undefined; copy.set({ left: o.left + step * i, top: o.top + step * i }); c.add(copy); made.push(copy); }
    return this.edited(made, [`已复制 ${made.length} 个`, `Duplicated ${made.length}`]);
  }
  setLayers(target: Target | undefined, o: Omit<OpOf<'set'>, 'op' | 'target'>): string {
    const objs = this.targets(target);
    for (const x of objs) {
      if (o.opacity !== undefined) x.set({ opacity: o.opacity });
      if (o.rotate !== undefined) x.rotate(o.rotate);
      if (o.flipX !== undefined) x.set({ flipX: o.flipX }); if (o.flipY !== undefined) x.set({ flipY: o.flipY });
      if (o.lock !== undefined) x.set({ lockMovementX: o.lock, lockMovementY: o.lock, lockScalingX: o.lock, lockScalingY: o.lock, lockRotation: o.lock, hasControls: !o.lock, ...(x instanceof Textbox ? { editable: !o.lock } : {}) });
      if (o.radius !== undefined && (x instanceof FabricImage || x instanceof Rect)) this.setCorner(x, o.radius);
      if (o.fit && x instanceof FabricImage) this.fitImage(x, o.fit);
    }
    return this.edited(objs, ['已更新属性', 'Updated']);
  }
  /** Paints one layer: text fill, a line icon's strokes, a shape's fill (a line's stroke); decoration groups recolour every painted part. */
  private paint(o: FabricObject, color: string): boolean {
    const painted = (v: unknown): boolean => typeof v === 'string' && v !== '' && v !== 'none' && v !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(v);
    if (o instanceof Textbox) { o.set({ fill: color }); this.chosenColor.add(o); return true; }
    // A line icon is drawn by its strokes; a one-path icon is not a group, and filling it would turn the outline into a blob.
    if ((o as QObject).qcAsset?.startsWith('line:') && !(o instanceof Group)) { o.set({ stroke: color, ...(painted(o.fill) ? { fill: color } : {}) }); return true; }
    if (o instanceof Group) { for (const ch of o.getObjects()) { if (painted(ch.stroke)) ch.set({ stroke: color }); if (painted(ch.fill)) ch.set({ fill: color }); ch.set('dirty', true); } o.set('dirty', true); return true; }
    if (o instanceof Line) { o.set({ stroke: color }); return true; }
    if (o instanceof FabricImage) return false;
    o.set({ fill: color }); return true;
  }
  recolorLayers(target: Target | undefined, o: Omit<OpOf<'recolor'>, 'op' | 'target'>): string {
    const objs = this.targets(target); const pal = this.currentPalette(); const color = o.color ?? (o.tone ? pal[o.tone] : undefined); let skipped = 0;
    for (const x of objs) {
      if (color) { if ((x.qcAsset?.startsWith('sticker:')) || !this.paint(x, color)) { skipped++; continue; } x.qcTone = o.tone ?? toneOf(color, pal); }
      if (o.stroke !== undefined) x.set({ stroke: o.stroke, strokeWidth: o.strokeWidth ?? Math.max(x.strokeWidth || 0, 4), ...(x instanceof Textbox ? { paintFirst: 'stroke' } : {}) });
      else if (o.strokeWidth !== undefined) x.set({ strokeWidth: o.strokeWidth });
    }
    if (skipped === objs.length) throw new OpProblem(this.zh ? '彩色贴纸和图片不能单色化；要换颜色请换成线性图标（icon style:line）' : 'Stickers and pictures cannot be recoloured');
    return this.edited(objs, ['已换颜色', 'Recoloured']);
  }
  distributeLayers(target: Target, axis: 'horizontal' | 'vertical'): string {
    const objs = this.targets(target); if (objs.length < 3) throw new OpProblem(this.zh ? '等距分布至少需要 3 个元素' : 'Distribute needs at least 3 layers');
    const h = axis === 'horizontal'; const items = objs.map(o => ({ o, b: o.getBoundingRect() })).sort((a, b) => h ? a.b.left - b.b.left : a.b.top - b.b.top);
    const first = items[0]!.b, last = items[items.length - 1]!.b; const span = h ? last.left + last.width - first.left : last.top + last.height - first.top;
    const gap = (span - items.reduce((s, it) => s + (h ? it.b.width : it.b.height), 0)) / (items.length - 1); let at = h ? first.left : first.top;
    for (const it of items) { const delta = at - (h ? it.b.left : it.b.top); it.o.set(h ? { left: it.o.left + delta } : { top: it.o.top + delta }); at += (h ? it.b.width : it.b.height) + gap; }
    return this.edited(objs, ['已等距分布', 'Distributed']);
  }
  selectLayers(target: Target): string {
    const c = this.canvas!; const objs = this.targets(target); c.discardActiveObject();
    c.setActiveObject(objs.length === 1 ? objs[0]! : new ActiveSelection(objs, { canvas: c })); c.requestRenderAll(); this.refreshInspector(true);
    return this.zh ? `已选中 ${objs.length} 个元素` : `Selected ${objs.length}`;
  }
  /** Why a font cannot set this text (unknown name, or Latin-only on Chinese), for the assistant's commands. */
  fontIssue(family: string, text: string): string | undefined { return fontProblem(family, text, this.plugin.fonts.catalog(), this.zh); }
  /** The palette the cover follows: the template's, the saved one, or one read off the canvas for hand-made covers. */
  currentPalette(): Palette {
    if (this.palette) return this.palette;
    const d = this.design; const c = this.canvas; const texts = (c?.getObjects() ?? []).filter((o): o is Textbox & QObject => o instanceof Textbox);
    const bg = d?.bg?.kind === 'solid' ? d.bg.color : d?.bg?.kind === 'linear' ? d.bg.from : '#ffffff'; const fill = (o?: Textbox): string | undefined => typeof o?.fill === 'string' && /^#[\da-f]{6}$/i.test(o.fill) ? o.fill : undefined;
    const ink = fill(texts.find(o => o.qcRole === 'title')) ?? readableOn(bg); const sub = fill(texts.find(o => o.qcRole === 'subtitle')) ?? ink;
    // The accent is the most used saturated colour on the canvas that is not the ink or the ground.
    const tally = new Map<string, number>();
    for (const o of c?.getObjects() ?? []) { const col = this.colorOf(o); if (col && ![bg, ink, sub].map(x => x.toLowerCase()).includes(col) && hexToHsl(col)[1] > 0.35) tally.set(col, (tally.get(col) ?? 0) + 1); }
    const accent = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#ef4444';
    return { bg, bg2: d?.bg?.kind === 'linear' ? d.bg.to : bg, ink, sub, accent, accentInk: readableOn(accent) };
  }
  /**
   * A new palette, applied in place: every colour that was a token becomes the new token (text, icons, shapes, decoration,
   * gradient stops, the background), layers that remember their token follow it, and nothing moves.
   */
  setPalette(o: Omit<OpOf<'palette'>, 'op'>): string {
    const c = this.canvas, d = this.design; if (!c || !d) return '';
    const from = this.currentPalette(); const mood = o.mood ? MOOD_PALETTES.find(m => m.id === o.mood) : undefined;
    let to: Palette = mood ? fixPalette({ ...mood.p }) : o.adjust ? adjustPalette(from, o.adjust) : from;
    if (o.palette) to = mergePalette(to, o.palette);
    const map = colorMap(from, to); const swap = (v: unknown): unknown => typeof v === 'string' ? map.get(v.toLowerCase()) ?? v : v;
    const walk = (x: FabricObject): void => {
      const q = x as QObject; const tone = q.qcTone as Tone | undefined;
      if (tone && to[tone]) this.paint(x, to[tone]);
      else {
        x.set({ fill: x.fill instanceof Gradient ? x.fill : swap(x.fill), stroke: swap(x.stroke) });
        if (x instanceof Textbox && x.textBackgroundColor) x.set({ textBackgroundColor: swap(x.textBackgroundColor) as string });
        if (x.fill instanceof Gradient) for (const st of x.fill.colorStops) st.color = swap(st.color) as string;
        if (x instanceof Group && !q.qcAsset?.startsWith('sticker:')) x.getObjects().forEach(walk);
      }
      x.set('dirty', true);
    };
    for (const x of c.getObjects()) if (!(x instanceof FabricImage) && (x as QObject).qcRole !== 'grain') walk(x);
    const bg = d.bg; if (bg?.kind === 'solid') this.applyBackground({ kind: 'solid', color: map.get(bg.color.toLowerCase()) ?? to.bg }, false);
    else if (bg?.kind === 'linear') this.applyBackground({ ...bg, from: map.get(bg.from.toLowerCase()) ?? to.bg, to: map.get(bg.to.toLowerCase()) ?? to.bg2 }, false);
    this.palette = to; d.palette = to;
    c.requestRenderAll(); this.changed(); this.refreshInspector(true);
    const name = mood ? (this.zh ? mood.zh : mood.id) : o.adjust ? (this.zh ? ADJUST_ZH[o.adjust] : o.adjust) : '';
    return this.zh ? `已换配色${name ? `：${name}` : ''}` : `Palette updated${name ? `: ${name}` : ''}`;
  }
  /** Starts an assistant turn: pending edits are committed first so the turn becomes exactly one undo step. */
  private beginTurn(): void {
    this.commitHistory(); this.inTurn = true; this.turnStart = new Set(this.sceneNodes().map(n => n.id)); this.touched = new Set(); this.turnPicks = []; this.chosenColor = new Set(); this.turnNotes = [];
    this.turnSelectedObjects = [...this.selection()]; this.turnSelection = this.turnSelectedObjects.map(o => this.idOf(o)).filter(Boolean);
  }
  private endTurn(): void { this.inTurn = false; this.turnSelection = undefined; this.turnSelectedObjects = []; if (this.dirty) { this.commitHistory(); void this.flush(); } }
  /**
   * Geometry check after a turn for the layers it touched: a new icon or shape that ended up over the words is moved to the
   * nearest free spot, a layer pushed off the canvas is brought back. Text collisions are only reported.
   */
  private selfCheck(): string[] {
    const d = this.design; if (!d || !this.canvas) return [];
    const nodes = this.sceneNodes(); const added = nodes.filter(n => !this.turnStart.has(n.id)).map(n => n.id);
    const issues = layoutIssues(nodes, d, [...new Set([...this.touched, ...added])]); const notes: string[] = [];
    for (const issue of issues) {
      const o = (this.canvas.getObjects() as QObject[]).find(x => x.qcId === issue.id); if (!o) continue;
      if (issue.kind === 'covers-text' && !o.lockMovementX) { this.placeObjects([o], { to: 'top-right' }, true); notes.push(this.zh ? `已把 #${issue.id} 挪开，避免压住文字` : `Moved #${issue.id} off the text`); }
      else if (issue.kind === 'off-canvas' && !o.lockMovementX) { const b = this.boxOf([o]); this.placeObjects([o], { x: Math.min(0.9, Math.max(0.1, (b.x + b.w / 2) / d.width)), y: Math.min(0.9, Math.max(0.1, (b.y + b.h / 2) / d.height)) }, false); notes.push(this.zh ? `已把 #${issue.id} 移回画布内` : `Brought #${issue.id} back onto the canvas`); }
      else if (issue.kind === 'text-overlap') notes.push(this.zh ? `#${issue.id} 和 #${issue.other} 两段文字有重叠` : `#${issue.id} overlaps #${issue.other}`);
    }
    if (notes.length) { this.canvas.requestRenderAll(); this.changed(); }
    return notes;
  }
  fontsInUse(): string[] {
    return [...new Set((this.canvas?.getObjects() ?? []).filter((o): o is Textbox => o instanceof Textbox).map(o => o.fontFamily))];
  }
  async runAssistantOps(ops: Op[]): Promise<RunResult> {
    if (this.turnSelection?.length && this.turnSelectedObjects.some(o => !this.canvas?.getObjects().includes(o))) return { done: [], problems: [this.t('chatSelectionMissing')] };
    const result = await runOps(this, ops, this.zh);
    // Any change (a new background, a new colour) can leave words unreadable, so readability is re-checked after every run.
    if (!this.turnSelection?.length && ops.some(o => o.op !== 'design' && o.op !== 'undo' && o.op !== 'redo')) result.done.push(...this.qualityPass());
    return result;
  }

  /* ---------- images ---------- */
  pickImage(): void {
    const input = this.doc.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.multiple = true;
    input.addEventListener('change', () => { for (const f of Array.from(input.files ?? [])) void this.action(() => this.importImage(f)); }, { once: true }); input.click();
  }
  pickVaultImage(onPick?: (file: TFile) => void): void {
    const files = this.app.vault.getFiles().filter(f => /^(png|jpe?g|webp)$/i.test(f.extension));
    if (!files.length) { new Notice(this.t('noImages')); return; }
    const generation = this.generation;
    new PickFile(this.app, files, file => {
      if (onPick) { onPick(file); return; }
      void this.action(async () => {
        const data = await this.app.vault.readBinary(file); if (generation !== this.generation) return;
        await this.importImage(new Blob([data], { type: mimeOf(file.extension) }));
      });
    }, this.t('imageVault')).open();
  }
  /** Reads a raster, shrinks very large photos and returns an embeddable data URL. */
  async prepareImage(blob: Blob, compact = false): Promise<string> {
    if (blob.size > MAX_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error(this.t('imageLimit'));
    const bitmap = await this.win.createImageBitmap(blob);
    try {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
      if (!compact && scale === 1 && blob.size < 6 * 1024 * 1024) return await readDataUrl(this.win, blob);
      const canvas = this.doc.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const type = !compact && blob.type === 'image/png' ? 'image/png' : 'image/webp';
      const out = await new Promise<Blob | null>(r => canvas.toBlob(r, type, 0.9));
      if (!out) throw new Error(this.t('imageLimit'));
      return await readDataUrl(this.win, out);
    } finally { bitmap.close(); }
  }
  openImageGenerator(target?: FabricImage, context?: ImageGenerationContext): void {
    this.setDrawing(false);
    if (this.imageDialog) return;
    const dialog = new ImageGenerateDialog(this, () => { if (this.imageDialog === dialog) this.imageDialog = undefined; }, target, context);
    this.imageDialog = dialog; dialog.open();
  }
  async openSelectionImageGenerator(): Promise<void> {
    if (this.imageDialog || !this.canvas) return;
    const objects = this.canvas.getActiveObjects() as QObject[];
    if (objects.length === 1 && objects[0] instanceof FabricImage) { this.openImageGenerator(objects[0]); return; }
    const selected = objects.filter(o => !objects.some(other => { let p=o.parent; while(p){if(p===other)return true;p=p.parent;}return false; }));
    if (!selected.length) return;
    const guard=this.imageGuard();
    for(const o of selected)o.qcImageId ??= crypto.randomUUID();
    const hashes=await Promise.all(selected.map(async o=>({id:o.qcImageId!,hash:await this.selectionObjectHash(o)})));
    const { reference, box } = await this.selectionPicture(selected);
    if(!guard()||!await this.selectionMatches({objects:hashes,box}))throw Error(this.t('imageOriginalChanged'));
    this.changed();await this.flush();this.openImageGenerator(undefined,{reference,selection:{objects:hashes,box}});
  }
  private async selectionPicture(selected: FabricObject[]): Promise<{reference: ImageReference; box: ImageSelection['box']}> {
    const boxes=selected.map(o=>o.getBoundingRect()),left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top));
    const box={left,top,width:Math.max(...boxes.map(b=>b.left+b.width))-left,height:Math.max(...boxes.map(b=>b.top+b.height))-top};
    if(!Number.isFinite(box.width+box.height)||box.width<=0||box.height<=0)throw Error(this.t('imageNotInserted'));
    // Match canvas stacking even when layers were selected in a different order.
    const flatten = (items: FabricObject[]): FabricObject[] => items.flatMap(o => o instanceof Group ? [o, ...flatten(o.getObjects())] : [o]);
    const order = flatten(this.canvas!.getObjects()); selected = [...selected].sort((a,b) => order.indexOf(a)-order.indexOf(b));
    const clones=await Promise.all(selected.map(async o=>{const clone=await o.clone(PROPS);util.applyTransformToObject(clone,util.multiplyTransformMatrices([1,0,0,1,-left,-top],o.calcTransformMatrix()));let opacity=o.opacity;for(let p=o.parent;p;p=p.parent)opacity*=p.opacity;clone.set({opacity});return clone;}));
    const scale=Math.min(1,4096/Math.max(box.width,box.height)),element=this.doc.createElement('canvas');
    const off=new StaticCanvas(element,{width:Math.max(1,Math.ceil(box.width*scale)),height:Math.max(1,Math.ceil(box.height*scale)),enableRetinaScaling:false,renderOnAddRemove:false});
    let reference:ImageReference;
    try{off.setViewportTransform([scale,0,0,scale,0,0]);off.add(...clones);off.renderAll();reference={url:off.toDataURL({format:'png',multiplier:1}),width:off.width,height:off.height};}finally{void off.dispose();}
    return { reference, box };
  }
  async downloadSelection(): Promise<void> {
    const selected = this.canvas?.getActiveObjects() ?? []; if (!selected.length) return;
    const { reference } = await this.selectionPicture(selected);
    const data = await (await this.win.fetch(reference.url!)).arrayBuffer();
    const name = selected.length === 1 ? (selected[0] as QObject).qcName : undefined;
    const path = await this.plugin.saveSystemPng(`${safeName(name || (this.zh ? '选中内容' : 'Selection'))}.png`, data);
    if (path) new Notice(this.t('exportDone', { path }));
  }
  private async selectionObjectHash(object:QObject):Promise<string>{
    const walk=(items:Record<string,unknown>[]):Record<string,unknown>|undefined=>{for(const item of items){if(item.qcImageId===object.qcImageId)return item;const found=Array.isArray(item.objects)?walk(item.objects as Record<string,unknown>[]):undefined;if(found)return found;}return undefined;};
    const serialized=walk((this.currentDesign().canvas.objects??[]) as Record<string,unknown>[]);
    return imageHash(JSON.stringify({object:serialized,world:object.calcTransformMatrix().map(n=>Math.round(n*1000)/1000)}));
  }
  selectionObjects(selection:ImageSelection):QObject[]{
    const flatten=(items:FabricObject[]):QObject[]=>items.flatMap(o=>o instanceof Group?[o as QObject,...flatten(o.getObjects())]:[o as QObject]);
    const all=flatten(this.canvas?.getObjects()??[]);return selection.objects.map(item=>all.find(o=>o.qcImageId===item.id)).filter((o):o is QObject=>!!o);
  }
  async selectionMatches(selection:ImageSelection):Promise<boolean>{
    const objects=this.selectionObjects(selection);return objects.length===selection.objects.length && (await Promise.all(objects.map(o=>this.selectionObjectHash(o)))).every((hash,i)=>hash===selection.objects[i]!.hash);
  }
  async replaceImageSelection(picture:GeneratedPicture,selection:ImageSelection,keep:()=>boolean):Promise<boolean>{
    if(!keep()||!await this.selectionMatches(selection))throw Error(this.t('imageOriginalChanged'));
    if(picture.data.byteLength>MAX_IMAGE_BYTES||!['image/png','image/jpeg','image/webp'].includes(picture.type))throw Error(this.t('imageLimit'));
    const image=await FabricImage.fromURL(await readDataUrl(this.win,new Blob([picture.data],{type:picture.type})));
    if(!keep()||!await this.selectionMatches(selection))throw Error(this.t('imageOriginalChanged'));
    const c=this.canvas!,objects=this.selectionObjects(selection),parent=objects[0]!.parent,owner=objects.every(o=>o.parent===parent)?parent??c:c;
    const root=(o:FabricObject):FabricObject=>o.parent?root(o.parent):o;
    const at=Math.max(...objects.map(o=>owner.getObjects().indexOf(owner===c?root(o):o)));
    const box=selection.box;image.set({left:box.left,top:box.top,scaleX:box.width/image.width,scaleY:box.height/image.height});
    (image as QObject).qcName=picture.name??this.t('imageResult');
    this.beginTurn();try{c.discardActiveObject();const before=owner.getObjects().slice(0,at).filter(o=>!objects.includes(o as QObject)).length;for(const object of objects)(object.parent??c).remove(object);owner.insertAt(before,image);image.setCoords();c.setActiveObject(image);this.changed();}finally{this.endTurn();}
    c.requestRenderAll();this.refreshInspector(true);return true;
  }
  /** A delayed result belongs to its original file and raster, even if another tab is now active. */
  imageGuard(target?: FabricImage): () => boolean {
    const generation = this.generation, canvas = this.canvas, source = target?.getSrc();
    return () => !!canvas && canvas === this.canvas && generation === this.generation && !this.closingView && !this.restoring && (!target || (objectsContain(canvas.getObjects(), target) && target.getSrc() === source));
  }
  /** Prepare every result before changing the scene; one group import is one undo step. */
  async applyImageResult(pictures: GeneratedPicture[], target: FabricImage | undefined, layers: boolean, keep: () => boolean): Promise<boolean> {
    if (!pictures.length || !keep()) return false;
    const c = this.canvas!, d = this.design!;
    const images = await Promise.all(pictures.map(async pic => {
      const blob = new Blob([pic.data], { type: pic.type });
      // AI output retains its native resolution, including 4K and transparent layers.
      if (blob.size > MAX_IMAGE_BYTES || !['image/png', 'image/jpeg', 'image/webp'].includes(pic.type)) throw new Error(this.t('imageLimit'));
      const image = await FabricImage.fromURL(await readDataUrl(this.win, blob));
      if (pic.name) (image as QObject & { qcCredit?: string }).qcCredit = pic.name.slice(0, 128);
      return image;
    }));
    if (!keep()) return false;
    if (target && !layers) {
      const replacement = await target.clone(PROPS) as FabricImage;
      if (!keep()) return false;
      const old = target.getElement() as HTMLImageElement;
      const sx = images[0]!.width / (old.naturalWidth || old.width), sy = images[0]!.height / (old.naturalHeight || old.height);
      await replacement.setSrc(images[0]!.getSrc());
      if (!keep()) return false;
      replacement.set({ width: target.width * sx, height: target.height * sy, cropX: target.cropX * sx, cropY: target.cropY * sy, scaleX: target.scaleX / sx, scaleY: target.scaleY / sy, left: target.left, top: target.top, angle: target.angle, skewX: target.skewX, skewY: target.skewY, flipX: target.flipX, flipY: target.flipY });
      if (replacement.clipPath && !replacement.clipPath.absolutePositioned) { const clip = replacement.clipPath; clip.set({ left: clip.left * sx, top: clip.top * sy, scaleX: clip.scaleX * sx, scaleY: clip.scaleY * sy }); }
      this.beginTurn();
      try {
        const parent = target.parent;
        if (parent) {
          const at = parent.getObjects().indexOf(target);
          util.applyTransformToObject(replacement, util.multiplyTransformMatrices(target.group!.calcTransformMatrix(), replacement.calcOwnMatrix()));
          c.discardActiveObject(); parent.remove(target); parent.insertAt(at, replacement);
        } else { const at = c.getObjects().indexOf(target); c.discardActiveObject(); c.remove(target); c.insertAt(at, replacement); }
        replacement.setCoords(); c.setActiveObject(replacement); this.changed();
      }
      finally { this.endTurn(); }
    } else if (layers) {
      const baseAt = pictures.findIndex(p => p.zIndex === 0); if (baseAt < 0) throw new Error('Seedream: missing base layer');
      const base = images[baseAt]!;
      const ordered = pictures.map((pic, i) => ({ pic, img: images[i]! })).sort((a, b) => (a.pic.zIndex ?? 0) - (b.pic.zIndex ?? 0));
      for (const { pic, img } of ordered) {
        if (pic.zIndex === 0) img.set({ left: 0, top: 0 });
        else {
          const b = pic.box; if (!b || b.length !== 4 || !b.every(Number.isFinite) || b[2]! <= b[0]! || b[3]! <= b[1]!) throw new Error('Seedream: invalid layer bounding box');
          img.set({ left: b[0], top: b[1], scaleX: (b[2]! - b[0]!) / img.width, scaleY: (b[3]! - b[1]!) / img.height });
        }
      }
      const group = new Group(ordered.map(p => p.img)) as Group & QObject; group.qcLayerGroup = true; group.qcName = this.t('imageInsertLayers'); group.scaleToWidth(Math.min(d.width * .7, base.width)); if (group.getScaledHeight() > d.height * .8) group.scaleToHeight(d.height * .8);
      group.set({ left: (d.width - group.getScaledWidth()) / 2, top: (d.height - group.getScaledHeight()) / 2 });
      this.beginTurn(); try { this.place(group); } finally { this.endTurn(); }
    } else {
      this.beginTurn();
      try { for (const [index, image] of images.entries()) { image.scaleToWidth(Math.min(d.width * .7, image.width)); if (image.getScaledHeight() > d.height * .8) image.scaleToHeight(d.height * .8); image.set({ left: (d.width - image.getScaledWidth()) / 2 + (index - (images.length - 1) / 2) * Math.min(d.width * .04, d.width * .2 / Math.max(1, images.length - 1)), top: (d.height - image.getScaledHeight()) / 2 + (index - (images.length - 1) / 2) * Math.min(d.height * .03, d.height * .15 / Math.max(1, images.length - 1)) }); this.place(image); } }
      finally { this.endTurn(); }
    }
    c.requestRenderAll(); this.refreshInspector(true); return true;
  }
  async importImage(blob: Blob, keep: () => boolean = () => true): Promise<boolean> {
    const generation = this.generation; const url = await this.prepareImage(blob);
    const image = await FabricImage.fromURL(url);
    if (!keep() || generation !== this.generation || this.closingView || !this.canvas || !this.design) return false;
    const d = this.design; image.scaleToWidth(Math.min(d.width * 0.7, image.width)); if (image.getScaledHeight() > d.height * 0.8) image.scaleToHeight(d.height * 0.8);
    image.set({ left: (d.width - image.getScaledWidth()) / 2, top: (d.height - image.getScaledHeight()) / 2 }); this.place(image);
    return true;
  }
  async replaceImage(target: FabricImage, blob: Blob): Promise<void> {
    const url = await this.prepareImage(blob); const shown = target.getScaledWidth(); const generation = this.generation;
    await target.setSrc(url); if (generation !== this.generation) return;
    const s = shown / target.width; target.set({ scaleX: s, scaleY: s }); target.setCoords(); this.canvas?.requestRenderAll(); this.changed(); this.refreshInspector(true);
  }

  /* ---------- keyboard ---------- */
  private keyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input,textarea,select,[contenteditable="true"]') || this.canvas?.getActiveObjects().some(o => o instanceof Textbox && o.isEditing) || event.isComposing) return;
    if (this.restoring) return;
    const mod = event.metaKey || event.ctrlKey; const k = event.key.toLowerCase(); let run: (() => void | Promise<unknown>) | undefined;
    if (mod && k === 'z') run = () => this.travel(event.shiftKey ? 1 : -1);
    else if (mod && k === 'y') run = () => this.travel(1);
    else if (mod && k === 's') run = () => this.flush();
    else if (mod && k === 'd') run = () => this.cloneSelection();
    else if (mod && k === 'c') run = () => this.copyObjects();
    else if (mod && k === 'g') run = () => { if (event.shiftKey) this.ungroupLayers(); else this.groupLayers(); };
    else if (k === 'f2') run = () => renameLayersDialog(this, this.canvas!.getActiveObjects());
    else if (mod && k === 'a') run = () => { const c = this.canvas!; const all = c.getObjects().filter(o => o.selectable); c.discardActiveObject(); if (all.length === 1) c.setActiveObject(all[0]!); else if (all.length) c.setActiveObject(new ActiveSelection(all, { canvas: c })); c.requestRenderAll(); };
    else if (mod && event.shiftKey && k === 'e') run = () => this.quickExport();
    else if (mod && event.shiftKey && k === 'c') run = () => this.copyToClipboard();
    else if (mod && k === 'e') run = () => this.openExport();
    else if (mod && (k === '=' || k === '+')) run = () => this.zoomBy(1.2);
    else if (mod && k === '-') run = () => this.zoomBy(1 / 1.2);
    else if (mod && k === '0') run = () => this.setZoom('fit');
    else if (mod && k === '1') run = () => this.setZoom(1);
    else if (mod && k === ']') run = () => this.order(event.shiftKey ? 'front' : 'forward');
    else if (mod && k === '[') run = () => this.order(event.shiftKey ? 'back' : 'backward');
    else if (mod && k === 'l') run = () => this.toggleLock();
    else if (!mod && event.key === 'Escape') run = () => { this.setDrawing(false); this.canvas?.discardActiveObject(); this.canvas?.requestRenderAll(); };
    else if (!mod && event.key === 'Delete' || event.key === 'Backspace') run = () => this.removeSelection();
    else if (!mod && !event.altKey && k === 'b') run=()=>this.setDrawing(!this.canvas?.isDrawingMode);
    else if (!mod && !event.altKey && k === 't') run = () => { this.addText(); };
    else if (!mod && !event.altKey && k === 'r') run = () => { this.addShape('rect'); };
    else if (!mod && !event.altKey && k === 'o') run = () => { this.addShape('circle'); };
    else if (!mod && !event.altKey && k === 'l') run = () => { this.addShape('line'); };
    else if (event.key === '?') run = () => { new ShortcutsModal(this.plugin).open(); };
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const n = event.shiftKey ? 10 : 1;
      run = () => this.move(event.key === 'ArrowLeft' ? -n : event.key === 'ArrowRight' ? n : 0, event.key === 'ArrowUp' ? -n : event.key === 'ArrowDown' ? n : 0);
    }
    if (run) { event.preventDefault(); event.stopPropagation(); void this.action(run); }
  }

  /* ---------- export ---------- */
  exportPrefs(): ExportPrefs {
    return { ...EXPORT_DEFAULTS, folder: this.plugin.settings.exportFolder, ...this.plugin.settings.export, ...this.design?.export };
  }
  /** Renders the design at its native size times `scale`. */
  render(scale = 1): HTMLCanvasElement {
    if (!this.canvas || !this.design) throw new Error('no-canvas');
    const c = this.canvas; c.discardActiveObject();
    const transform = [...c.viewportTransform] as [number, number, number, number, number, number];
    c.viewportTransform = [1, 0, 0, 1, 0, 0];
    try { return c.toCanvasElement(scale, { left: 0, top: 0, width: this.design.width, height: this.design.height }); }
    finally { c.viewportTransform = transform; c.calcViewportBoundaries(); c.requestRenderAll(); }
  }
  png(): HTMLCanvasElement { return this.render(1); }
  /** PNG on the clipboard, ready to paste into a chat, a post editor or a slide. */
  async copyToClipboard(btn?: HTMLElement): Promise<void> {
    if (!this.canvas || !this.design) return;
    try {
      const source = this.render(Math.min(2, this.exportPrefs().scale || 1));
      const blob = await new Promise<Blob>((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), 'image/png'));
      const Item = (this.win as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem;
      await this.win.navigator.clipboard.write([new Item({ 'image/png': blob })]);
      new Notice(this.zh ? '已复制图片，直接粘贴就行' : 'Image copied. Just paste it.');
      if (btn) { btn.addClass('is-done'); this.win.setTimeout(() => btn.removeClass('is-done'), 1200); }
    } catch (e) { new Notice(this.zh ? `复制失败：${e instanceof Error ? e.message : String(e)}。可以改用导出。` : 'Copy failed. Use Export instead.'); }
  }
  async encode(prefs: ExportPrefs, limit?: number): Promise<{ blob: Blob; format: ExportFormat; quality: number; width: number; height: number }> {
    const source = this.render(prefs.scale);
    const mime = (f: ExportFormat): string => f === 'jpeg' ? 'image/jpeg' : f === 'webp' ? 'image/webp' : 'image/png';
    const toBlob = (f: ExportFormat, q: number): Promise<Blob> => new Promise((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), mime(f), q));
    let format = prefs.format; let quality = prefs.quality; let blob = await toBlob(format, quality);
    if (limit && prefs.fitLimit && blob.size > limit) {
      format = format === 'png' ? 'jpeg' : format; let lo = 0.4, hi = Math.min(quality, 0.95); quality = hi; blob = await toBlob(format, hi);
      for (let i = 0; i < 6 && blob.size > limit; i++) { quality = (lo + hi) / 2; blob = await toBlob(format, quality); if (blob.size > limit) hi = quality; else lo = quality; }
    }
    return { blob, format, quality, width: source.width, height: source.height };
  }
  platform(): Platform | undefined { return this.design ? platformFor(this.design.width, this.design.height, this.design.platform) : undefined; }
  private async pngBlob(): Promise<Blob> {
    const source = this.render(1); return new Promise((res, rej) => source.toBlob(b => b ? res(b) : rej(new Error('export-failed')), 'image/png'));
  }
  async openExport(): Promise<void> { await this.flush(); new ExportModal(this).open(); }
  async quickExport(): Promise<TFile | string> { return this.exportWith(this.exportPrefs()); }
  async exportNow(o: { format?: ExportFormat; scale?: number }): Promise<string> {
    const r = await this.exportWith({ ...this.exportPrefs(), ...(o.format ? { format: o.format } : {}), ...(o.scale ? { scale: o.scale } : {}) });
    return typeof r === 'string' ? r : r.path;
  }
  /** Writes the image where `prefs` says and runs the follow-up actions. Returns the vault file or the system path. */
  async exportWith(prefs: ExportPrefs): Promise<TFile | string> {
    const d = this.design; if (!d) throw new Error('no-canvas');
    const sourcePath = d.source; const source = sourcePath ? this.app.vault.getAbstractFileByPath(sourcePath) : null;
    const note = source instanceof TFile && source.extension === 'md' ? source : null;
    if ((prefs.insert || prefs.cover) && !note) throw new Error(this.t('sourceMissing'));
    await this.flush();
    const p = this.platform(); const now = new Date(); const pad = (n: number): string => String(n).padStart(2, '0');
    const base = renderFilename(prefs.filename, {
      name: this.file?.basename ?? 'Cover', platform: p?.id ?? 'custom', size: `${d.width}x${d.height}`,
      date: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`, time: `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    });
    const out = await this.encode(prefs, p?.maxBytes);
    const ext = out.format === 'jpeg' ? 'jpg' : out.format; const data = await out.blob.arrayBuffer();
    let result: TFile | string;
    if (prefs.destination === 'system') {
      result = await this.plugin.writeSystemFile(prefs.systemDir || this.plugin.settings.export.systemDir || '', `${base}.${ext}`, data);
    } else {
      const folder = prefs.destination === 'note' && note?.parent && !note.parent.isRoot() ? note.parent.path : folderPath(prefs.folder || this.plugin.settings.exportFolder);
      if (!(prefs.destination === 'note' && note)) await this.plugin.ensureFolder(folder);
      const target = prefs.destination === 'note' && note?.parent?.isRoot() ? await this.rootPath(base, ext) : this.plugin.unique(folder, base, ext);
      result = await this.app.vault.createBinary(target, data);
    }
    if (result instanceof TFile && note) {
      if (prefs.insert) await this.insertEmbed(note, result);
      if (prefs.cover) await this.app.fileManager.processFrontMatter(note, fm => { (fm as Record<string, unknown>).cover = this.app.fileManager.generateMarkdownLink(result as TFile, note.path); });
    }
    if (prefs.copy) { try { await this.copyPng(); } catch (e) { this.plugin.report(e); } }
    d.export = { ...d.export, format: prefs.format, scale: prefs.scale, quality: prefs.quality, destination: prefs.destination, folder: prefs.folder, systemDir: prefs.systemDir, filename: prefs.filename, insert: prefs.insert, cover: prefs.cover, copy: prefs.copy, fitLimit: prefs.fitLimit };
    this.plugin.settings.export = { ...this.plugin.settings.export, format: prefs.format, scale: prefs.scale, quality: prefs.quality, destination: prefs.destination, folder: prefs.folder, systemDir: prefs.systemDir, filename: prefs.filename, fitLimit: prefs.fitLimit };
    void this.plugin.saveSettings(); this.changed();
    new Notice(this.t('exportDone', { path: typeof result === 'string' ? result : result.path }) + (out.format !== prefs.format ? ` · ${this.t('exportConverted', { format: out.format.toUpperCase() })}` : ''));
    return result;
  }
  private async rootPath(base: string, ext: string): Promise<string> { return this.plugin.unique('', base, ext); }
  private async insertEmbed(note: TFile, image: TFile): Promise<void> {
    const link = this.app.fileManager.generateMarkdownLink(image, note.path); const embed = link.startsWith('!') ? link : `!${link}`;
    const view = this.app.workspace.getLeavesOfType('markdown').map(l => l.view).find((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === note.path);
    if (view) { view.editor.replaceSelection(`${embed}\n`); return; }
    await this.app.vault.process(note, text => `${text.trimEnd()}\n\n${embed}\n`);
  }
  async copyPng(): Promise<void> {
    const w = this.win; if (!w.ClipboardItem || !w.navigator.clipboard?.write) throw new Error(this.t('unsupported'));
    await w.navigator.clipboard.write([new w.ClipboardItem({ 'image/png': this.pngBlob() })]); new Notice(this.t('copied'));
  }
  safeBase(): string { return safeName(this.file?.basename ?? 'Cover'); }
}

function objectsContain(objects: FabricObject[], target: FabricObject): boolean { return objects.some(o => o === target || o instanceof Group && objectsContain(o.getObjects(), target)); }
function clearImageIds(object: FabricObject): void { (object as QObject).qcImageId = undefined; if (object instanceof Group) object.getObjects().forEach(clearImageIds); }
function mimeOf(ext: string): string { const e = ext.toLowerCase(); return e === 'webp' ? 'image/webp' : e === 'png' ? 'image/png' : 'image/jpeg'; }
function readDataUrl(win: Window, blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new (win as Window & typeof globalThis).FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}
