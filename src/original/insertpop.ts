import {appendBodyDiv} from '../harness-ui';
/** Category-specific insertion panels, anchored to the creation toolbar. */
import { StaticCanvas, Textbox } from 'fabric';
import { Notice, setIcon } from '../harness-ui';
import { faceFor, isSingleWeight, pillFor, styleText, TEXT_GROUPS, TEXT_PRESETS, type TextPreset } from './textstyles';
import { PATH_SHAPES } from './shapes';
import type { CoverView } from './view';
import { ASSET_CATS, AssetCat, AssetItem, assetSvg, assetThumb, loadAssets, searchAssets } from './assets';
import { DECOR, drawDecor } from './decor';
import { emptyState, iconButton, quietName } from './ui';

export type InsertCategory = 'text' | 'asset' | 'shape';
const STICKER_TAGS = ['火', '爱心', '火箭', '灯泡', '星', '皇冠', '奖杯', '礼物', '对勾', '警告', '钱', '书', '眼睛', '大脑', '笑'];
const LINE_TAGS = ['箭头', '对勾', '星星', '爱心', '火', '灯泡', '书', '电脑', '时间', '搜索', '设置', '用户', '位置', '链接'];
const PAGE = 90;

export function openInsertPopover(view: CoverView, anchor: HTMLElement, category: InsertCategory = 'shape'): void {
  const doc = view.doc; const open = doc.querySelector('.qc-popover.qc-insert'); if (open) { const same = open.getAttribute('data-category') === category; open.dispatchEvent(new view.win.Event('qc-close')); if (same) return; }
  doc.querySelectorAll('.qc-popover').forEach(el => el.dispatchEvent(new view.win.Event('qc-close')));
  const zh = view.zh; const pop = appendBodyDiv('qc-popover qc-insert qc-root-scope'); const r = anchor.getBoundingClientRect(); const width = Math.min(400, view.win.innerWidth - 16); const top = Math.max(8, Math.min(r.bottom + 6, view.win.innerHeight - 180));
  pop.dataset.category = category; pop.setAttribute('role', 'dialog'); const panelName = ({ text: zh ? '文字' : 'Text', asset: zh ? '素材' : 'Assets', shape: zh ? '形状' : 'Shapes' }[category]); quietName(pop, panelName);
  pop.style.width = `${width}px`; pop.style.left = `${Math.max(8, Math.min(r.left, view.win.innerWidth - width - 8))}px`; pop.style.top = `${top}px`; pop.style.height = `${Math.max(0, Math.min(600, view.win.innerHeight - top - 8))}px`;
  const close = (): void => { pop.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', esc, true); };
  const outside = (e: Event): void => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', esc, true); pop.addEventListener('qc-close', close);

  const tabsEl = pop.createDiv('qc-insert-tabs'); const body = pop.createDiv('qc-insert-body qc-assets');
  const draw = (): void => {
    tabsEl.empty(); tabsEl.createEl('strong', { cls: 'qc-insert-title', text: panelName });
    iconButton(tabsEl, 'x', view.t('close'), close, 'qc-insert-x');
    body.empty();
    if (category === 'asset') assetsTab(view, body, close); else if (category === 'text') textTab(view, body, close); else if (category === 'shape') shapeTab(view, body, close);
  };
  draw();
}

function searchBox(parent: HTMLElement, placeholder: string, onSearch: (q: string) => void): HTMLInputElement {
  const box = parent.createDiv('qc-assets-search'); setIcon(box.createSpan({ cls: 'qc-assets-icon' }), 'search');
  const input = box.createEl('input', { type: 'text', cls: 'qc-assets-input', attr: { placeholder, spellcheck: 'false' } }); let composing = false;
  input.addEventListener('compositionstart', () => { composing = true; }); input.addEventListener('compositionend', () => { composing = false; onSearch(input.value); });
  input.addEventListener('input', () => { if (!composing) onSearch(input.value); });
  window.setTimeout(() => input.focus(), 30); return input;
}

/* ---------- stickers and icons ---------- */
/** After adding something the popover closes so the new element is visible and selected; hold Shift to keep adding. */
const done = (e: MouseEvent, close: () => void): void => { if (!e.shiftKey) close(); };
function assetsTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh; let cat: AssetCat = 'sticker'; let query = ''; let shown = PAGE;
  const input = searchBox(body, zh ? '搜索：火箭、爱心、箭头、礼物…' : 'Search: rocket, heart, arrow…', q => { query = q.trim(); shown = PAGE; render(); });
  const tabs = body.createDiv('qc-assets-tabs'); const tags = body.createDiv('qc-assets-tags'); const grid = body.createDiv('qc-assets-grid'); const foot = body.createDiv('qc-hint qc-assets-foot');
  let data: Awaited<ReturnType<typeof loadAssets>> | undefined;
  const insert = async (a: AssetItem, ev: MouseEvent): Promise<void> => { try { await view.addAssetSvg(assetSvg(a, view.palette?.ink ?? '#171717'), { asset: `${a.cat}:${a.id}`, ...(a.cat === 'line' && view.palette ? { tone: 'ink' } : {}) }); done(ev, close); } catch (e) { new Notice(e instanceof Error ? e.message : String(e)); } };
  const render = (): void => {
    tabs.empty(); tags.empty(); grid.empty(); foot.empty();
    for (const c of ASSET_CATS) { const b = tabs.createEl('button', { cls: 'qc-assets-tab', text: zh ? c.zh : c.en, attr: { type: 'button' } }); b.classList.toggle('is-active', c.id === cat); b.addEventListener('click', () => { cat = c.id; shown = PAGE; render(); }); }
    for (const label of cat === 'sticker' ? STICKER_TAGS : LINE_TAGS) { const b = tags.createEl('button', { cls: 'qc-assets-tag', text: label, attr: { type: 'button' } }); b.addEventListener('click', () => { input.value = label; query = label; shown = PAGE; render(); }); }
    if (!data) { emptyState(grid, { icon: 'loader-circle', title: zh ? '正在载入素材库…' : 'Loading the library…' }); return; }
    if (!data.stickers.length) { emptyState(grid, { icon: 'package-x', title: zh ? '素材库文件缺失' : 'Library file missing', hint: zh ? '需要插件目录里的 assets-pack.json.gz。重新安装插件，或把它放到插件文件夹里。' : 'assets-pack.json.gz must sit next to main.js.' }); return; }
    const hits = searchAssets(data, cat, query);
    if (!hits.length) {
      emptyState(grid, { icon: 'search-x', title: zh ? `没有找到“${query}”` : `Nothing for “${query}”`, hint: cat === 'sticker' ? (zh ? '换一个更常见的词，比如「火箭」「爱心」「箭头」「礼物」。' : 'Try a more common word.') : (zh ? '线性图标多是英文名，试试 arrow、heart、star；常用中文词也行。' : 'Try arrow, heart, star.'),
        actions: [...(cat === 'sticker' ? [{ label: zh ? '去线性图标里找' : 'Search line icons', run: () => { cat = 'line'; shown = PAGE; render(); } }] : [{ label: zh ? '去贴纸里找' : 'Search stickers', run: () => { cat = 'sticker'; shown = PAGE; render(); } }]), { label: zh ? '清除搜索' : 'Clear', run: () => { input.value = ''; query = ''; shown = PAGE; render(); }, primary: true }] });
    }
    for (const h of hits.slice(0, shown)) {
      const b = grid.createEl('button', { cls: 'qc-asset', attr: { type: 'button', 'aria-label': h.zh } }); b.createEl('img', { attr: { src: assetThumb(h), alt: h.zh } });
      b.addEventListener('click', e => void insert(h, e));
    }
    if (hits.length > shown) { const more = grid.createEl('button', { cls: 'qc-assets-more', text: zh ? `显示更多（还有 ${hits.length - shown} 个）` : `Show more (${hits.length - shown})`, attr: { type: 'button' } }); more.addEventListener('click', () => { shown += PAGE; render(); }); }
    foot.setText(zh ? `${ASSET_CATS.find(c => c.id === cat)!.license} · 内置离线素材，可免费商用 · 按住 Shift 可连续添加` : `${ASSET_CATS.find(c => c.id === cat)!.license} · bundled, free to use`);
  };
  render();
  void loadAssets(view.app, view.plugin.manifest.dir ?? '').then(d => { data = d; if (body.isConnected) render(); });
}

/* ---------- text, shapes, images ---------- */
const textThumbCache = new Map<string, string>(); let textThumbQueue: Promise<unknown> = Promise.resolve();
/** The preview in the menu is the real style drawn small, so what you see is what lands on the cover. */
function textThumb(view: CoverView, p: TextPreset): Promise<string> {
  const have = (f: string): boolean => view.plugin.fonts.available(view.doc, f); const face = faceFor(p.font, have) ?? view.plugin.settings.defaultFont; const label = view.zh ? p.sample : p.sampleEn;
  const key = `${p.id}|${label}|${face}`; const hit = textThumbCache.get(key); if (hit) return Promise.resolve(hit);
  const job = textThumbQueue.then(async () => {
    await view.plugin.fonts.ensure(view.doc, face).catch(() => false);
    const W = 232, H = 68; const sc = new StaticCanvas(view.doc.createElement('canvas'), { width: W, height: H, renderOnAddRemove: false, enableRetinaScaling: false });
    sc.backgroundColor = p.dark ? '#1f2024' : '#f4f4f5';
    const size = Math.max(16, Math.min(36, Math.round(p.size * 0.3)));
    const obj = p.pill ? pillFor(p, label, size, face) : (() => { const b = new Textbox(label, { fontSize: size, fontFamily: face, fontWeight: p.weight !== 'normal' && !isSingleWeight(face) ? 'bold' : 'normal', fill: p.color ?? '#171717', textAlign: 'center', originX: 'left', originY: 'top', width: 4000 } as ConstructorParameters<typeof Textbox>[1]); b.initDimensions(); b.set({ width: Math.ceil(Math.max(1, ...b.textLines.map((_, i) => b.getLineWidth(i))) + size * 0.3) }); styleText(b, p, size); return b; })();
    obj.initDimensions(); const ox = obj.angle ? 0 : 0; const k = Math.min(1, (W - 24) / Math.max(1, obj.getScaledWidth()), (H - 14) / Math.max(1, obj.getScaledHeight()));
    obj.set({ scaleX: k, scaleY: k, left: (W - obj.getScaledWidth()) / 2 + ox, top: (H - obj.getScaledHeight()) / 2 }); sc.add(obj); sc.renderAll();
    const url = sc.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: false }); await sc.dispose(); textThumbCache.set(key, url); return url;
  });
  textThumbQueue = job.catch(() => undefined); return job;
}
function textTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh;
  for (const g of TEXT_GROUPS) {
    body.createDiv({ text: zh ? g.zh : g.en, cls: 'qc-insert-sub' }); const grid = body.createDiv('qc-text-grid');
    for (const p of TEXT_PRESETS.filter(x => x.group === g.id)) {
      const card = grid.createEl('button', { cls: 'qc-text-card', attr: { type: 'button' } }); const thumb = card.createDiv('qc-text-thumb is-loading'); card.createSpan({ text: zh ? p.zh : p.en, cls: 'qc-text-name' });
      textThumb(view, p).then(url => { thumb.removeClass('is-loading'); thumb.createEl('img', { attr: { src: url, alt: p.zh } }); }, () => thumb.removeClass('is-loading'));
      card.addEventListener('click', e => { void view.action(() => { view.addTextStyle(p); }); done(e, close); });
    }
  }
  body.createDiv({ text: zh ? '添加后双击画布改字；右侧能改字体、颜色、描边和阴影。装了字体包，艺术字会自动用更好看的字体。' : 'Double-click to edit; fonts, colours, stroke and shadow are on the right.', cls: 'qc-hint' });
}
/** 24 × 24 outlines for the extra shapes; filled with the cover's accent colour. Ids and paths live in shapes.ts so the assistant can call them too. */
function shapeTab(view: CoverView, body: HTMLElement, close: () => void): void {
  const zh = view.zh; body.createDiv({ text: zh ? '基础形状' : 'Basic', cls: 'qc-insert-sub' });
  const sg = body.createDiv('qc-shape-grid');
  const kinds: ['rect' | 'rounded' | 'circle' | 'triangle' | 'line' | 'star', string, string][] = [['rect', 'square', 'rectangle'], ['rounded', 'rectangle-horizontal', 'rounded'], ['circle', 'circle', 'circle'], ['triangle', 'triangle', 'triangle'], ['line', 'minus', 'line'], ['star', 'star', 'star']];
  for (const [kind, icon, key] of kinds) { const b = iconButton(sg, icon, view.t(key as 'rectangle'), () => undefined, 'qc-shape-btn'); b.addEventListener('click', e => { void view.action(() => { view.addShape(kind); }); done(e, close); }); }
  body.createDiv({ text: zh ? '更多形状' : 'More shapes', cls: 'qc-insert-sub' });
  const more = body.createDiv('qc-shape-more');
  for (const [id, name, d] of PATH_SHAPES) {
    const b = more.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button' } });
    const svg = b.createSvg('svg', { attr: { viewBox: '0 0 24 24', 'aria-hidden': 'true' } });
    svg.createSvg('path', { attr: { d, fill: 'currentColor' } }); b.createSpan({ text: name });
    b.addEventListener('click', e => { view.addPathShape(d); done(e, close); }); b.dataset.id = id;
  }
  body.createDiv({ text: zh ? '装饰（跟随配色）' : 'Decorations (palette colours)', cls: 'qc-insert-sub' });
  const deco = body.createDiv('qc-shape-more'); const colors = view.palette ?? { ink: '#171717', accent: '#ef4444', sub: '#737373', bg2: '#e5e5e5', accentInk: '#ffffff' };
  for (const k of DECOR) {
    const art = drawDecor(k.id, colors, 'accent'); if (!art) continue;
    const b = deco.createEl('button', { cls: 'qc-shape-card', attr: { type: 'button', 'aria-description': k.use } }); b.createEl('img', { attr: { src: `data:image/svg+xml;utf8,${encodeURIComponent(art.svg)}`, alt: k.zh } }); b.createSpan({ text: k.zh });
    b.addEventListener('click', e => { void view.addDecor([{ kind: k.id, at: 'canvas', x: 0.35, y: 0.3, w: 0.3 }]); done(e, close); });
  }
}
