/**
 * Small settings design system. Obsidian's own setting rows inherit whatever the theme does to them (cards, odd baselines);
 * these rows keep one predictable layout: text on the left, the control on the right, both centred, one hairline between.
 * They reuse Obsidian's input components, so keyboard and focus behaviour stay native.
 */
import { ButtonComponent, DropdownComponent, SliderComponent, TextComponent, ToggleComponent, setIcon } from '../harness-ui';

export class Row {
  readonly el: HTMLElement; readonly control: HTMLElement; private nameEl: HTMLElement; private descEl: HTMLElement;
  constructor(parent: HTMLElement, name = '', desc = '') {
    this.el = parent.createDiv('qcs-row'); const info = this.el.createDiv('qcs-info');
    this.nameEl = info.createDiv({ cls: 'qcs-name' }); this.descEl = info.createDiv({ cls: 'qcs-desc' }); this.control = this.el.createDiv('qcs-control');
    this.setName(name); this.setDesc(desc);
  }
  setName(name: string): this { this.nameEl.setText(name); this.nameEl.toggleClass('is-empty', !name); return this; }
  setDesc(desc: string): this { this.descEl.setText(desc); this.descEl.toggleClass('is-empty', !desc); return this; }
  /** Wide control rows put the input under the text instead of beside it (long URLs, textareas). */
  stack(): this { this.el.addClass('is-stacked'); return this; }
  addText(cb: (c: TextComponent) => void): this { cb(new TextComponent(this.control)); return this; }
  addDropdown(cb: (c: DropdownComponent) => void): this { cb(new DropdownComponent(this.control)); return this; }
  addToggle(cb: (c: ToggleComponent) => void): this { cb(new ToggleComponent(this.control)); return this; }
  addSlider(cb: (c: SliderComponent) => void): this { cb(new SliderComponent(this.control)); return this; }
  addButton(cb: (c: ButtonComponent) => void): this { cb(new ButtonComponent(this.control)); return this; }
}

/** A titled group. `step` shows a number so a sequence of decisions reads top to bottom. */
export function section(parent: HTMLElement, title: string, desc?: string, step?: number): HTMLElement {
  const box = parent.createDiv('qcs-section'); const head = box.createDiv('qcs-section-head');
  if (step !== undefined) head.createSpan({ text: String(step), cls: 'qcs-step' });
  const text = head.createDiv('qcs-section-text'); text.createDiv({ text: title, cls: 'qcs-section-title' }); if (desc) text.createDiv({ text: desc, cls: 'qcs-section-desc' });
  return box.createDiv('qcs-section-body');
}

export interface Choice<T extends string> { value: T; title: string; desc: string; icon: string; badge?: string }
/** Big radio cards for a decision with a few clear options. Re-renders its container on pick. */
export function choiceCards<T extends string>(parent: HTMLElement, choices: Choice<T>[], current: T, onPick: (value: T) => void): void {
  const grid = parent.createDiv('qcs-choices'); grid.setAttribute('role', 'radiogroup');
  for (const c of choices) {
    const b = grid.createEl('button', { cls: 'qcs-choice', attr: { type: 'button', role: 'radio', 'aria-checked': String(c.value === current) } });
    b.toggleClass('is-selected', c.value === current);
    const top = b.createDiv('qcs-choice-top'); setIcon(top.createSpan({ cls: 'qcs-choice-icon' }), c.icon);
    if (c.badge) top.createSpan({ text: c.badge, cls: 'qcs-badge' });
    const mark = top.createSpan({ cls: 'qcs-choice-mark' }); if (c.value === current) setIcon(mark, 'check');
    b.createDiv({ text: c.title, cls: 'qcs-choice-title' }); b.createDiv({ text: c.desc, cls: 'qcs-choice-desc' });
    b.addEventListener('click', () => { if (c.value !== current) onPick(c.value); });
  }
}

export type Tone = 'ok' | 'warn' | 'off';
/** One line that answers "is it working?" with a dot, a sentence and an optional action. */
export function statusBar(parent: HTMLElement, tone: Tone, text: string, detail?: string): { el: HTMLElement; action: HTMLElement } {
  const el = parent.createDiv(`qcs-status is-${tone}`); el.createSpan({ cls: 'qcs-dot' });
  const t = el.createDiv('qcs-status-text'); t.createDiv({ text, cls: 'qcs-status-main' }); if (detail) t.createDiv({ text: detail, cls: 'qcs-status-detail' });
  return { el, action: el.createDiv('qcs-status-action') };
}

/** Advanced options stay folded so the common path is never cluttered. */
export function more(parent: HTMLElement, label: string, open = false): HTMLElement {
  const d = parent.createEl('details', { cls: 'qcs-more' }); if (open) d.setAttribute('open', '');
  d.createEl('summary', { text: label }); return d.createDiv('qcs-more-body');
}
