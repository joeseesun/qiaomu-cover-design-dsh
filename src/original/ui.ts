import {appendBodyDiv} from '../harness-ui';
import { setIcon } from '../harness-ui';
import { hexToHsv, hsvToHex } from './color-picker-math';

type Opts = DomElementInfo | string;
let nameId = 0;
/** Accessible naming without a hover tooltip, for already explained fields and regions. */
export function quietName(el: HTMLElement, label: string, parent = el): void {
  const name = parent.createSpan({ text: label, cls: 'qc-sr-only', attr: { id: `qc-name-${++nameId}` } });
  el.setAttribute('aria-labelledby', name.id);
}
/** Icon-only actions use the host tooltip through aria-label; never add a second native title. */
export function iconButton(parent: HTMLElement, icon: string, label: string, onClick: (event: MouseEvent) => void, cls = ''): HTMLButtonElement {
  const b = parent.createEl('button', { cls: `qc-icon-btn ${cls}`.trim(), attr: { type: 'button', 'aria-label': label } });
  setIcon(b, icon); b.createSpan({ text: label, cls: 'qc-sr-only' });
  b.addEventListener('click', onClick); return b;
}
export function textButton(parent: HTMLElement, label: string, onClick: (event: MouseEvent) => void, cls = '', icon?: string): HTMLButtonElement {
  const b = parent.createEl('button', { cls: `qc-btn ${cls}`.trim(), attr: { type: 'button' } });
  if (icon) setIcon(b.createSpan({ cls: 'qc-btn-icon' }), icon);
  b.createSpan({ text: label }); b.addEventListener('click', onClick); return b;
}
export function group(parent: HTMLElement, title: string, o: { open?: boolean; hint?: string } = {}): HTMLElement {
  const d = parent.createEl('details', { cls: 'qc-group' }); d.open = o.open !== false;
  const s = d.createEl('summary'); s.createSpan({ text: title, cls: 'qc-group-title' });
  const chevron = s.createSpan({ cls: 'qc-chevron' }); setIcon(chevron, 'chevron-down');
  if (o.hint) d.createDiv({ text: o.hint, cls: 'qc-hint' });
  return d.createDiv('qc-group-body');
}
export function field(parent: HTMLElement, label: string, cls = ''): { wrap: HTMLElement; body: HTMLElement } {
  const wrap = parent.createDiv({ cls: `qc-field ${cls}`.trim() });
  wrap.createSpan({ text: label, cls: 'qc-label' });
  return { wrap, body: wrap.createDiv('qc-control') };
}
export function segmented<T extends string>(parent: HTMLElement, options: { value: T; label?: string; icon?: string; disabled?: boolean }[], value: T, onChange: (v: T) => void, cls = ''): HTMLElement {
  const seg = parent.createDiv({ cls: `qc-seg ${cls}`.trim(), attr: { role: 'group' } });
  for (const o of options) {
    const b = seg.createEl('button', { cls: 'qc-seg-btn', attr: { type: 'button' } });
    if (o.icon) setIcon(b, o.icon);
    if (o.label) b.createSpan({ text: o.label, cls: o.icon ? 'qc-sr-only' : '' });
    b.disabled = Boolean(o.disabled);
    b.classList.toggle('is-active', o.value === value); b.setAttribute('aria-pressed', String(o.value === value));
    b.addEventListener('click', () => {
      for (const sibling of Array.from(seg.children)) { sibling.classList.remove('is-active'); sibling.setAttribute('aria-pressed', 'false'); }
      b.classList.add('is-active'); b.setAttribute('aria-pressed', 'true'); onChange(o.value);
    });
  }
  return seg;
}
export function toggleButton(parent: HTMLElement, icon: string, label: string, active: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = iconButton(parent, icon, label, () => { const next = !b.classList.contains('is-active'); b.classList.toggle('is-active', next); b.setAttribute('aria-pressed', String(next)); onChange(next); }, 'qc-toggle');
  b.classList.toggle('is-active', active); b.setAttribute('aria-pressed', String(active)); return b;
}
export function slider(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, format: (v: number) => string = v => String(v)): HTMLElement {
  const { wrap, body } = field(parent, label, 'qc-slider');
  const out = wrap.createSpan({ text: format(value), cls: 'qc-value' });
  const input = body.createEl('input', { type: 'range', attr: { min: String(min), max: String(max), step: String(step) } }); input.value = String(value);
  input.addEventListener('input', () => { const v = Number(input.value); out.setText(format(v)); onInput(v); });
  return wrap;
}
/** Number box with a unit. Ignores half-typed values and IME composition. */
export function numberBox(parent: HTMLElement, label: string, value: number, onChange: (v: number) => void, o: { min?: number; max?: number; step?: number; unit?: string } = {}): HTMLInputElement {
  const { wrap, body } = field(parent, label, 'qc-num');
  const input = body.createEl('input', { type: 'number', attr: { step: String(o.step ?? 1) } }); input.value = String(Math.round(value * 100) / 100);
  if (o.min !== undefined) input.min = String(o.min); if (o.max !== undefined) input.max = String(o.max);
  if (o.unit) wrap.createSpan({ text: o.unit, cls: 'qc-unit' });
  input.addEventListener('input', () => {
    if (input.value === '' || input.value === '-') return;
    const v = Number(input.value); if (!Number.isFinite(v)) return;
    if ((o.min !== undefined && v < o.min) || (o.max !== undefined && v > o.max)) return;
    onChange(v);
  });
  return input;
}
export const PALETTE = ['#111111', '#ffffff', '#737373', '#e11d2e', '#f97316', '#ffe04b', '#16a34a', '#14b8a6', '#2563eb', '#7c3aed', '#fb7185', '#f4efe4'];
export interface ColorOptions { recent?: string[]; none?: boolean; zh?: boolean; onCommit?: (color: string) => void; onStart?: () => void; onEnd?: () => void; doc?: Document }
/** A square swatch opens the full picker; sampling is an action inside it. */
export function colorControl(parent: HTMLElement, label: string, value: string, onChange: (color: string) => void, o: ColorOptions = {}): HTMLElement {
  const doc = o.doc ?? parent.ownerDocument, win = doc.defaultView! as Window & typeof globalThis;
  const words = o.zh ? { picker: '打开色盘', sample: '吸取屏幕颜色', none: '无颜色', close: '关闭色盘', area: '饱和度与亮度，左右键调饱和度，上下键调亮度', hue: '色相' } : { picker: 'Open color picker', sample: 'Sample screen color', none: 'No color', close: 'Close color picker', area: 'Saturation and brightness. Left/right adjusts saturation; up/down adjusts brightness.', hue: 'Hue' };
  const { wrap, body } = field(parent, label, 'qc-color');
  const top = body.createDiv('qc-color-top');
  let current = /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  const trigger = top.createEl('button', { cls: 'qc-swatch qc-color-trigger', attr: { type: 'button', 'aria-label': `${label}: ${words.picker}`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' } });
  const text = top.createEl('input', { type: 'text', cls: 'qc-hex', attr: { maxlength: '7', spellcheck: 'false', placeholder: o.none ? '—' : '#000000' } }); text.value = current; quietName(text, `${label} HEX`, wrap);
  const colors = [...new Set([...(o.recent ?? []).slice(0, 6), ...PALETTE].filter(c => /^#[\da-f]{6}$/i.test(c)).map(c => c.toLowerCase()))];
  const swatches = body.createDiv('qc-swatches');
  let syncPopup: (() => void) | undefined;
  const sync = (): void => { trigger.style.setProperty('--c', current); trigger.classList.toggle('is-none', !current); for (const s of Array.from(swatches.children)) s.setAttribute('aria-pressed', String(s.getAttribute('data-color') === current)); syncPopup?.(); };
  const apply = (c: string, commit = true): void => { current = c.toLowerCase(); text.value = current; sync(); onChange(current); if (commit) o.onCommit?.(current); };
  const addSwatch = (c: string): void => { const s = swatches.createEl('button', { cls: `qc-swatch${c ? '' : ' is-none'}`, attr: { type: 'button', 'data-color': c } }); s.createSpan({ text: c || words.none, cls: 'qc-sr-only' }); s.style.setProperty('--c', c); s.addEventListener('click', () => apply(c)); };
  if (o.none) addSwatch(''); colors.forEach(addSwatch); sync();
  text.addEventListener('input', () => { const v = text.value.trim(); if (/^#?[\da-f]{6}$/i.test(v)) apply(v.startsWith('#') ? v : `#${v}`); });
  trigger.addEventListener('click', () => {
    const existing = doc.querySelector('.qc-color-popover');
    const own = trigger.getAttribute('aria-expanded') === 'true'; existing?.dispatchEvent(new win.Event('qc-close')); if (own) return;
    const pop = appendBodyDiv({ cls: 'qc-popover qc-color-popover', attr: { role: 'dialog' } }); quietName(pop, `${label}: ${words.picker}`);
    trigger.setAttribute('aria-expanded', 'true'); o.onStart?.();
    let closed = false, sampling = false, pointer: number | undefined, [h, s, v] = hexToHsv(current || '#2563eb');
    const heading = pop.createDiv('qc-color-heading'); heading.createSpan({ text: label });
    const close = (focus = false): void => { if (closed) return; closed = true; observer.disconnect(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', key); win.removeEventListener('resize', position); doc.removeEventListener('scroll', position, true); syncPopup = undefined; pop.remove(); trigger.setAttribute('aria-expanded', 'false'); o.onEnd?.(); if (focus && trigger.isConnected) trigger.focus(); };
    iconButton(heading, 'x', words.close, () => close(true));
    const area = pop.createDiv({ cls: 'qc-color-area', attr: { tabindex: '0', role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': '100' } }); quietName(area, words.area);
    const marker = area.createSpan('qc-color-marker');
    const hue = pop.createEl('input', { type: 'range', cls: 'qc-color-hue', attr: { min: '0', max: '359', step: '1' } }); quietName(hue, words.hue, pop);
    const row = pop.createDiv('qc-color-value-row'); row.createSpan({ text: 'HEX', cls: 'qc-label' });
    const hex = row.createEl('input', { type: 'text', cls: 'qc-hex', attr: { maxlength: '7', spellcheck: 'false' } }); quietName(hex, 'HEX', pop);
    const refresh = (): void => { area.style.setProperty('--hue', `hsl(${h} 100% 50%)`); marker.style.left = `${s * 100}%`; marker.style.top = `${(1 - v) * 100}%`; hue.value = String(Math.round(h)); hex.value = current; area.setAttribute('aria-valuenow', String(Math.round(v * 100))); area.setAttribute('aria-valuetext', `${Math.round(s * 100)}% / ${Math.round(v * 100)}% ${current}`); };
    syncPopup = () => { if (current) { const next = hexToHsv(current); if (next[1] && next[2]) h = next[0]; s = next[1]; v = next[2]; } refresh(); }; refresh();
    const point = (e: PointerEvent): void => { const r = area.getBoundingClientRect(); s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); v = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); apply(hsvToHex(h, s, v), false); };
    area.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); area.focus(); pointer = e.pointerId; try { area.setPointerCapture(pointer); } catch { /* Synthetic fixture has no active pointer. */ } point(e); });
    area.addEventListener('pointermove', e => { if (pointer === e.pointerId) point(e); });
    const finish = (): void => { if (pointer !== undefined) { pointer = undefined; o.onCommit?.(current); } };
    area.addEventListener('pointerup', finish); area.addEventListener('pointercancel', finish); area.addEventListener('lostpointercapture', finish);
    area.addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); const step = e.shiftKey ? 0.1 : 0.01; s = Math.max(0, Math.min(1, s + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0))); v = Math.max(0, Math.min(1, v + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0))); apply(hsvToHex(h, s, v)); });
    hue.addEventListener('input', () => { h = Number(hue.value); apply(hsvToHex(h, s, v), false); }); hue.addEventListener('change', () => o.onCommit?.(current));
    hex.addEventListener('input', () => { const c = hex.value.trim(); if (/^#?[\da-f]{6}$/i.test(c)) apply(c.startsWith('#') ? c : `#${c}`); });
    const Eye = (win as Window & { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (Eye) iconButton(row, 'pipette', words.sample, () => { sampling = true; pop.addClass('qc-color-sampling'); void new Eye().open().then(r => { if (!closed && wrap.isConnected) apply(r.sRGBHex); }).catch(() => undefined).finally(() => { sampling = false; if (!closed) { pop.removeClass('qc-color-sampling'); hex.focus(); } }); });
    if (o.none) textButton(pop, words.none, () => apply(''), 'qc-color-none qc-btn-sm', 'ban');
    const position = (): void => { if (!wrap.isConnected) { close(); return; } const r = trigger.getBoundingClientRect(), size = pop.getBoundingClientRect(); pop.style.left = `${Math.max(8, Math.min(r.left, win.innerWidth - size.width - 8))}px`; pop.style.top = `${Math.max(8, Math.min(r.bottom + 8, win.innerHeight - size.height - 8))}px`; };
    const outside = (e: PointerEvent): void => { if (!sampling && !pop.contains(e.target as Node) && !wrap.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape' && !sampling) { e.preventDefault(); e.stopPropagation(); close(true); } };
    const observer = new win.MutationObserver(() => { if (!wrap.isConnected) close(); }); observer.observe(doc.body, { childList: true, subtree: true });
    pop.addEventListener('qc-close', () => close()); doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', key); win.addEventListener('resize', position); doc.addEventListener('scroll', position, true); position(); hex.focus();
  });
  return wrap;
}
export function div(parent: HTMLElement, cls: Opts): HTMLDivElement { return parent.createDiv(cls); }
/** Enter commits unless an input method is composing. */
export function onEnter(el: HTMLElement, fn: (event: KeyboardEvent) => void, allowShift = false): void {
  el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && (allowShift || !e.shiftKey)) fn(e); });
}
export function bytes(n: number): string { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`; }

/** One consistent empty state: an icon, what happened, what to do next, and buttons for the likely next step. Spans a whole grid row. */
export function emptyState(parent: HTMLElement, o: { icon: string; title: string; hint?: string; actions?: { label: string; run: () => void; primary?: boolean }[] }): HTMLElement {
  const box = parent.createDiv('qc-empty'); setIcon(box.createDiv('qc-empty-glyph'), o.icon);
  box.createDiv({ text: o.title, cls: 'qc-empty-title' }); if (o.hint) box.createDiv({ text: o.hint, cls: 'qc-empty-hint' });
  if (o.actions?.length) { const row = box.createDiv('qc-empty-actions'); for (const a of o.actions) textButton(row, a.label, a.run, `qc-btn-sm${a.primary ? ' qc-primary' : ''}`); }
  return box;
}
