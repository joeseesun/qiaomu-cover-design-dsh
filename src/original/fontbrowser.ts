import {appendBodyDiv} from '../harness-ui';
import { Notice, setIcon } from '../harness-ui';
import type { CoverView } from './view';
import { FontEntry, ZH_NAMES } from './fonts';
import { FONT_LIBRARY, type LibFont } from './fontlib';
import { fetchGoogleFont, fetchGoogleInstall, gfUrls, GFont, loadGoogleIndex, lookOfCategory } from './googlefonts';
import { FontLibraryModal } from './modals';
import { emptyState, iconButton, textButton } from './ui';

export interface FontBrowserOptions { current?: string; onPick: (family: string) => void | Promise<void>; popover?: boolean; /** Which script tab opens first: Chinese when the text has Chinese in it. */ script?: Script }
export const FONT_SITES: [string, string, string][] = [
  ['Google Fonts', 'https://fonts.google.com', 'fontsGoogle'],
  ['站酷字库', 'https://www.zcool.com.cn/special/zcoolfonts/', 'fontsZcool'],
  ['阿里巴巴普惠体', 'https://www.alibabafonts.com', 'fontsAlibaba'],
];

type Script = 'zh' | 'en' | 'all';
type Look = 'all' | 'sans' | 'serif' | 'brush' | 'display';
interface Row { family: string; source: FontEntry['source'] | 'library' | 'google'; gf?: GFont; zh?: string; script: 'zh' | 'en' | 'both'; look: Look; hint?: string; lib?: LibFont; /** A library face still downloading. */ pending?: boolean }
const LOOK_ZH: Record<Look, string> = { all: '全部', sans: '黑体', serif: '宋体 / 衬线', brush: '手写 / 书法', display: '展示' };
const LOOK_EN: Record<Look, string> = { all: 'All', sans: 'Sans', serif: 'Serif', brush: 'Script', display: 'Display' };
const hasHan = (s: string): boolean => /[㐀-鿿]/.test(s);
/** Systems fonts have no category metadata, so the name has to say it. */
function lookOf(family: string, mood?: string): Look {
  if (mood === 'sans' || mood === 'serif' || mood === 'brush' || mood === 'display') return mood;
  const f = family.toLowerCase();
  if (/kai|楷|script|hand|brush|行|隶|魏碑|libian|weibei|xingkai|marker|cursive|noteworthy|zapfino|snell|bradley/.test(f)) return 'brush';
  if (/song|宋|serif(?!.*sans)|ming|明|mincho|times|georgia|palatino|baskerville|didot|bodoni|garamond|cambria|hoefler|fang|仿/.test(f) && !/sans/.test(f)) return 'serif';
  if (/hei|黑|sans|gothic|arial|helvetica|verdana|tahoma|segoe|inter|yahei|pingfang|苹方|avenir|futura|gill|optima|mono|menlo|courier/.test(f)) return 'sans';
  return 'display';
}
function scriptOf(family: string, mood?: string, cjk?: boolean): 'zh' | 'en' {
  if (cjk !== undefined) return cjk ? 'zh' : 'en'; if (mood === 'latin') return 'en';
  return ZH_NAMES[family] || hasHan(family) || /\bSC\b|CJK|PingFang|Songti|Heiti|Kaiti|Hiragino Sans GB|YaHei|SimSun|SimHei|Fang|Ming|STH|STS|STK|Source Han|MiSans|HarmonyOS|Alibaba|PuHui/i.test(family) ? 'zh' : 'en';
}

/**
 * The font picker, built the way Figma and Canva do it: one search box, a script switch (Chinese / English), a few look filters, and a
 * list grouped by where the font comes from. Every row previews itself in its own face; fonts you do not have yet install from the
 * same row with one click.
 */
export function renderFontBrowser(view: CoverView, host: HTMLElement, o: FontBrowserOptions): void {
  host.empty(); host.addClass('qc-fonts', 'qcf'); const plugin = view.plugin; const fonts = plugin.fonts; const zh = view.zh;
  let script: Script = o.script ?? 'zh'; let look: Look = 'all'; let query = ''; const busy = new Set<string>(); let google: GFont[] = []; const previewed = new Set<string>();
  const top = host.createDiv('qcf-top');
  const box = top.createDiv('qcf-search'); setIcon(box.createSpan({ cls: 'qcf-search-icon' }), 'search');
  const search = box.createEl('input', { type: 'text', attr: { placeholder: zh ? '搜索字体名称…' : 'Search fonts…', spellcheck: 'false' } });
  const scriptBar = top.createDiv('qcf-script'); const looks = top.createDiv('qcf-looks'); const list = host.createDiv('qcf-list'); const foot = host.createDiv('qcf-foot');
  const file = host.ownerDocument.createElement('input'); file.type = 'file'; file.multiple = true; file.accept = '.ttf,.otf,.woff,.woff2'; file.addEventListener('change', () => void importFonts(Array.from(file.files ?? [])));
  textButton(foot, zh ? '导入字体文件' : 'Import', () => file.click(), 'qc-btn-sm', 'upload');
  textButton(foot, zh ? '字体库' : 'Library', () => new FontLibraryModal(plugin, view.doc, () => render()).open(), 'qc-btn-sm', 'library');
  async function importFonts(files: File[]): Promise<void> { if (!files.length) return; try { const added = await fonts.importFiles(files, view.doc); new Notice(added.length ? view.t('fontsImported', { names: added.join(', ') }) : view.t('fontsNone')); } catch (e) { plugin.report(e); } file.value = ''; }
  host.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); host.addClass('is-drop'); } });
  host.addEventListener('dragleave', () => host.removeClass('is-drop')); host.addEventListener('drop', e => { e.preventDefault(); host.removeClass('is-drop'); void importFonts(Array.from(e.dataTransfer?.files ?? [])); });

  /** Everything the user could pick, once, with script and look worked out. */
  function collect(): Row[] {
    const rows: Row[] = []; const have = new Set<string>();
    for (const e of fonts.catalog()) {
      const lib = FONT_LIBRARY.find(l => l.family === e.family); have.add(e.family);
      const mood = e.mood ?? lib?.mood; const sc = e.source === 'generic' ? 'both' : scriptOf(e.family, mood, e.cjk ?? (lib ? lib.mood !== 'latin' : undefined));
      rows.push({ family: e.family, source: e.source, ...(e.source === 'bundled' && !fonts.hasBundled(e.family) ? { pending: true } : {}), ...(e.zh ? { zh: e.zh } : lib ? { zh: lib.family } : {}), script: sc, look: e.source === 'generic' ? (e.family === 'serif' ? 'serif' : 'sans') : lookOf(e.family, mood), ...(e.hint ?? lib?.hint ? { hint: e.hint ?? lib?.hint } : {}) });
    }
    for (const l of FONT_LIBRARY) if (!have.has(l.family) && !fonts.hasFont(l.family) && !fonts.isLibraryFamily(l.family)) rows.push({ family: l.family, source: 'library', zh: l.family, script: l.mood === 'latin' ? 'en' : 'zh', look: lookOf(l.family, l.mood), hint: l.hint, lib: l });
    return rows;
  }
  const label = (r: Row): { name: string; sub: string } => { const g = fonts.find(r.family); const zhName = r.zh ?? g?.zh; return zhName && zhName !== r.family && zh ? { name: zhName, sub: r.family } : { name: r.family, sub: r.hint ?? '' }; };
  const obs = new view.win.IntersectionObserver(entries => { for (const en of entries) if (en.isIntersecting) { const f = (en.target as HTMLElement).dataset.family; if (f) void fonts.ensure(view.doc, f); obs.unobserve(en.target); } }, { root: list, rootMargin: '120px' });
  const SECTION: Record<string, [string, string]> = { recent: ['最近使用', 'Recent'], fav: ['收藏', 'Favourites'], bundled: ['内置字体', 'Built in'], vault: ['我的字体', 'My fonts'], library: ['可下载（点一下安装）', 'Download'], system: ['系统字体', 'System'], generic: ['系统默认', 'Defaults'] };

  function row(parent: HTMLElement, r: Row, fav: Set<string>): void {
    const el = parent.createDiv({ cls: 'qcf-row', attr: { role: 'button', tabindex: '0' } }); el.classList.toggle('is-active', o.current === r.family); el.dataset.family = r.family;
    const sample = el.createSpan({ cls: 'qcf-sample', text: r.script === 'en' || (script === 'en') ? 'Aa Cover' : r.script === 'both' ? 'Aa 封面' : '封面设计' });
    if (r.source === 'google') { sample.style.fontFamily = `"__gf_${r.gf!.id}", sans-serif`; if (!previewed.has(r.gf!.id)) { previewed.add(r.gf!.id); void previewGoogle(r.gf!).then(() => { sample.style.fontFamily = `"__gf_${r.gf!.id}", sans-serif`; }); } }
    else if (r.source === 'library') sample.addClass('is-off'); else if (r.pending) sample.addClass('is-off'); else { sample.style.fontFamily = `"${r.family.replace(/"/g, '')}", sans-serif`; if (r.source === 'bundled') obs.observe(el); }
    const meta = el.createDiv('qcf-meta'); const l = label(r); meta.createSpan({ text: l.name, cls: 'qcf-name' }); if (l.sub) meta.createSpan({ text: l.sub, cls: 'qcf-sub' });
    const end = el.createDiv('qcf-end');
    if (r.source === 'google') { const b = end.createEl('button', { cls: 'qcf-dl', attr: { type: 'button' } }); setIcon(b.createSpan(), busy.has(r.family) ? 'loader-circle' : 'download'); b.createSpan({ text: busy.has(r.family) ? (zh ? '安装中…' : 'Installing…') : (zh ? '安装' : 'Install') }); }
    else if (r.source === 'library') { const b = end.createEl('button', { cls: 'qcf-dl', attr: { type: 'button' } }); setIcon(b.createSpan(), busy.has(r.family) ? 'loader-circle' : 'download'); b.createSpan({ text: busy.has(r.family) ? (zh ? '安装中…' : 'Installing…') : `${r.lib!.mb < 1 ? Math.round(r.lib!.mb * 1000) + ' KB' : r.lib!.mb + ' MB'}` }); }
    else if (r.pending) end.createSpan({ cls: 'qcf-sub', text: zh ? '准备中' : 'Getting ready' });
    else {
      if (o.current === r.family) setIcon(end.createSpan({ cls: 'qcf-check' }), 'check');
      const star = end.createEl('button', { cls: 'qcf-star', attr: { type: 'button', 'aria-label': zh ? '收藏' : 'Favourite' } }); setIcon(star, 'star'); star.classList.toggle('is-on', fav.has(r.family));
      star.addEventListener('click', ev => { ev.stopPropagation(); const set = new Set(plugin.settings.favFonts); if (set.has(r.family)) set.delete(r.family); else set.add(r.family); plugin.settings.favFonts = [...set]; void plugin.saveSettings(); star.classList.toggle('is-on', set.has(r.family)); });
    }
    const pick = (): void => {
      if (r.source === 'google') {
        if (busy.has(r.family)) return; busy.add(r.family); render();
        void fetchGoogleInstall(r.gf!).then(f => fonts.installBuffer(r.family, f.ext, f.buf, view.doc)).then(() => { new Notice(view.t('fontLibDone', { name: r.family })); busy.delete(r.family); return o.onPick(r.family); }).catch(e => { busy.delete(r.family); new Notice(view.t('fontLibFail', { name: r.family, message: e instanceof Error ? e.message : String(e) })); }).finally(() => { if (host.isConnected) render(); });
        return;
      }
      if (r.source === 'library') {
        if (busy.has(r.family)) return; busy.add(r.family); render();
        void fonts.installLib(r.lib!, view.doc).then(() => { new Notice(view.t('fontLibDone', { name: r.family })); busy.delete(r.family); return o.onPick(r.family); }).catch(e => { busy.delete(r.family); new Notice(view.t('fontLibFail', { name: r.family, message: e instanceof Error ? e.message : String(e) })); }).finally(() => { if (host.isConnected) render(); });
        return;
      }
      void o.onPick(r.family); if (o.popover) host.dispatchEvent(new CustomEvent('qc-close', { bubbles: true })); else render();
    };
    el.addEventListener('click', pick); el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
  }

  function render(): void {
    // script switch, with counts
    const rows = collect(); const inScript = (r: Row): boolean => script === 'all' || r.script === 'both' || r.script === script;
    scriptBar.empty(); for (const [id, name] of [['zh', zh ? '中文字体' : 'Chinese'], ['en', zh ? '英文字体' : 'Latin'], ['all', zh ? '全部' : 'All']] as const) { const n = rows.filter(r => id === 'all' || r.script === 'both' || r.script === id).length; const b = scriptBar.createEl('button', { cls: `qcf-seg${script === id ? ' is-active' : ''}`, attr: { type: 'button' } }); b.createSpan({ text: name }); b.createSpan({ text: String(n), cls: 'qcf-count' }); b.addEventListener('click', () => { script = id; render(); }); }
    looks.empty(); for (const id of Object.keys(LOOK_ZH) as Look[]) { const b = looks.createEl('button', { cls: `qcf-chip${look === id ? ' is-active' : ''}`, attr: { type: 'button' }, text: zh ? LOOK_ZH[id] : LOOK_EN[id] }); b.addEventListener('click', () => { look = id; render(); }); }
    list.empty(); const q = query.toLowerCase(); const fav = new Set(plugin.settings.favFonts);
    const ok = (r: Row): boolean => inScript(r) && (look === 'all' || r.look === look) && (!q || r.family.toLowerCase().includes(q) || (r.zh ?? '').includes(query) || (r.hint ?? '').includes(query));
    const pool = rows.filter(ok); let shown = 0;
    // The default library downloads silently on first run; say so quietly, and offer a retry for anything that failed.
    const lib = fonts.libraryState();
    if (lib.running) list.createDiv({ cls: 'qcf-more', text: zh ? `正在后台准备默认字库 ${lib.ready}/${lib.total}，不影响使用；用到的字体会优先下载。` : `Preparing the font library in the background (${lib.ready}/${lib.total}).` });
    else if (lib.failed.length) { const n = list.createDiv('qcf-more'); n.createSpan({ text: zh ? `${lib.failed.length} 款默认字体没下载成功（${lib.failed.slice(0, 3).join('、')}${lib.failed.length > 3 ? '…' : ''}）。` : `${lib.failed.length} library fonts did not download. ` }); const b = n.createEl('a', { text: zh ? '重试' : 'Retry', href: '#' }); b.addEventListener('click', ev => { ev.preventDefault(); void fonts.syncLibrary(() => plugin.repairOpenCovers()); }); }
    const section = (id: string, items: Row[], limit = 80): void => { if (!items.length) return; shown += items.length; const [a, b] = SECTION[id]!; const h = list.createDiv({ cls: 'qcf-head', text: `${zh ? a : b}` }); h.createSpan({ text: String(items.length), cls: 'qcf-count' }); const body = list.createDiv('qcf-group'); for (const r of items.slice(0, limit)) row(body, r, fav); if (items.length > limit) body.createDiv({ text: zh ? `还有 ${items.length - limit} 款，用搜索缩小范围` : `${items.length - limit} more; search to narrow`, cls: 'qcf-more' }); };
    if (q || look !== 'all') {
      section('bundled', pool.filter(r => r.source === 'bundled')); section('vault', pool.filter(r => r.source === 'vault')); section('library', pool.filter(r => r.source === 'library')); section('system', pool.filter(r => r.source === 'system' || r.source === 'generic'));
    } else {
      const recent = plugin.settings.recentFonts.map(f => pool.find(r => r.family === f)).filter((r): r is Row => !!r).slice(0, 5);
      section('recent', recent); section('fav', pool.filter(r => fav.has(r.family) && !recent.includes(r)));
      const used = new Set([...recent, ...pool.filter(r => fav.has(r.family))].map(r => r.family)); const rest = pool.filter(r => !used.has(r.family));
      section('bundled', rest.filter(r => r.source === 'bundled')); section('vault', rest.filter(r => r.source === 'vault')); section('library', rest.filter(r => r.source === 'library')); section('generic', rest.filter(r => r.source === 'generic')); section('system', rest.filter(r => r.source === 'system'), 60);
    }
    // Google Fonts: online, searched by name, only for Latin text.
    if (q.length >= 2 && script !== 'zh') {
      const mine = new Set(rows.map(r => r.family.toLowerCase()));
      const gh = google.filter(g => !mine.has(g.family.toLowerCase()) && g.family.toLowerCase().includes(q) && (look === 'all' || lookOfCategory(g.category) === look)).slice(0, 24);
      if (gh.length) { shown += gh.length; const h = list.createDiv({ cls: 'qcf-head', text: zh ? 'Google Fonts（联网，点一下安装）' : 'Google Fonts (online)' }); h.createSpan({ text: String(gh.length), cls: 'qcf-count' }); const body = list.createDiv('qcf-group'); for (const g of gh) row(body, { family: g.family, source: 'google', gf: g, script: 'en', look: lookOfCategory(g.category), hint: g.category }, fav); }
      else if (!google.length) list.createDiv({ text: zh ? '正在连接 Google Fonts…（需要网络）' : 'Connecting to Google Fonts…', cls: 'qcf-more' });
    } else if (script !== 'zh' && !q) list.createDiv({ text: zh ? '想要更多英文字体？在上面搜索，会同时搜 Google Fonts 的 2000 多款（联网）。' : 'Search above to also find 2,000+ Google Fonts (online).', cls: 'qcf-more' });
    if (!shown) emptyState(list, { icon: 'search-x', title: query ? (zh ? `没有找到“${query}”` : `Nothing for “${query}”`) : (zh ? '这一类还没有字体' : 'No fonts here yet'), hint: zh ? '换个关键词，或切到“全部”。也可以导入字体文件，或在字体库里下载。' : 'Try another word, or import a font file.', actions: [{ label: zh ? '清除筛选' : 'Clear filters', run: () => { query = ''; search.value = ''; look = 'all'; script = 'all'; render(); }, primary: true }] });
    if (fonts.state === 'idle' && !q) list.createDiv({ text: zh ? '正在读取系统字体…' : 'Reading system fonts…', cls: 'qcf-more' });
  }
  search.addEventListener('input', () => { if ((search as HTMLInputElement & { isComposing?: boolean }).isComposing) return; query = search.value.trim(); render(); });
  search.addEventListener('compositionend', () => { query = search.value.trim(); render(); });
  /** A throwaway preview face so a Google font can be seen in its own letters before it is installed. */
  async function previewGoogle(g: GFont): Promise<void> {
    try { const buf = await fetchGoogleFont(g); const url = URL.createObjectURL(new Blob([buf], { type: 'font/woff2' })); try { const face = new FontFace(`__gf_${g.id}`, `url(${url})`); await face.load(); (view.doc.fonts as FontFaceSet & { add(f: FontFace): void }).add(face); } finally { URL.revokeObjectURL(url); } } catch { /* offline: the row just shows the fallback face */ }
  }
  void gfUrls; void loadGoogleIndex().then(list => { google = list; if (host.isConnected) render(); });
  const off = fonts.onChange(() => { if (!host.isConnected) { off(); obs.disconnect(); return; } render(); });
  render(); void fonts.scanSystem(view.doc).then(() => { if (host.isConnected) render(); });
  if (o.popover) window.setTimeout(() => search.focus(), 30);
}

/** Floating font picker anchored to a button. Closes on outside click or Escape. */
export function openFontPopover(view: CoverView, anchor: HTMLElement, current: string, onPick: (family: string) => void | Promise<void>, script: Script = 'zh'): void {
  const doc = view.doc; doc.querySelectorAll('.qc-popover').forEach(el => el.remove());
  const pop = appendBodyDiv('qc-popover qc-root-scope');
  const r = anchor.getBoundingClientRect(); const width = 360; const win = view.win;
  pop.style.width = `${width}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, win.innerWidth - width - 8))}px`;
  const room = win.innerHeight - r.bottom - 12; const up = room < 360 && r.top > room;
  pop.style.height = `${Math.max(320, Math.min(560, (up ? r.top : room) - 12))}px`; pop.addClass('qcf-pop');
  if (up) pop.style.bottom = `${win.innerHeight - r.top + 6}px`; else pop.style.top = `${r.bottom + 6}px`;
  const close = (): void => { pop.remove(); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('keydown', esc, true); };
  const outside = (e: Event): void => { if (!pop.contains(e.target as Node) && !anchor.contains(e.target as Node)) close(); };
  const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  doc.addEventListener('pointerdown', outside, true); doc.addEventListener('keydown', esc, true);
  pop.addEventListener('qc-close', close);
  renderFontBrowser(view, pop, { current, onPick, popover: true, script });
  iconButton(pop.querySelector('.qcf-top') as HTMLElement, 'x', view.t('close'), close, 'qcf-close');
}
