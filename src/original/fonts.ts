import { App, normalizePath, requestUrl, TFile } from '../harness-ui';
import { LibFont, looksLikeFont, unzipEntry } from './fontlib';
import { BUNDLED_FONTS, FONT_LIBRARY_REPO, FONT_LIBRARY_VERSION } from './fontmanifest';
import { fetchFont, fontMirrors, syncFonts, syncPlan, type SyncIO } from './fontsync';
import { cache } from 'fabric';
import { safeName } from './model';

export type FontSource = 'system' | 'vault' | 'generic' | 'bundled';
export interface FontEntry { family: string; source: FontSource; zh?: string; styles?: number; mood?: string; cjk?: boolean; hint?: string }
/** A font of the default library (scripts/build-font-library.py): downloaded into the plugin folder on first run, loaded when first needed. */
export interface BundledFont { id: string; family: string; en: string; mood: string; roles: string[]; zh: string; hint: string; file: string; bytes: number; sha256: string; cjk: boolean; priority: number; license: string; home: string; coverage?: number }
/** Where the default library stands on this install: how many files are in, whether a download is running, which failed. */
export interface LibraryState { total: number; ready: number; running: boolean; failed: string[] }
export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
const MIME: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

/** Chinese names people actually search for. */
export const ZH_NAMES: Record<string, string> = {
  'PingFang SC': '苹方', 'PingFang TC': '苹方-繁', 'Songti SC': '宋体-简', 'Heiti SC': '黑体-简', 'Kaiti SC': '楷体-简', 'STHeiti': '华文黑体', 'STSong': '华文宋体',
  'STKaiti': '华文楷体', 'STFangsong': '华文仿宋', 'Hiragino Sans GB': '冬青黑体', 'Microsoft YaHei': '微软雅黑', 'SimSun': '宋体', 'SimHei': '黑体', 'KaiTi': '楷体',
  'FangSong': '仿宋', 'DengXian': '等线', 'Noto Sans SC': '思源黑体', 'Noto Serif SC': '思源宋体', 'Source Han Sans SC': '思源黑体', 'Source Han Serif SC': '思源宋体',
  'Yuanti SC': '圆体-简', 'Libian SC': '隶变-简', 'Weibei SC': '魏碑-简', 'Xingkai SC': '行楷-简', 'Hannotate SC': '手札体-简', 'HanziPen SC': '翩翩体-简',
  'Wawati SC': '娃娃体-简', 'Baoli SC': '报隶-简', 'Lantinghei SC': '兰亭黑-简', 'Yapi SC': '雅痞-简', 'Kaiti': '楷体', 'LiSu': '隶书', 'YouYuan': '幼圆',
  'STXihei': '华文细黑', 'STZhongsong': '华文中宋', 'Alibaba PuHuiTi': '阿里巴巴普惠体', 'AlibabaPuHuiTi': '阿里巴巴普惠体', 'MiSans': '小米字体', 'HarmonyOS Sans SC': '鸿蒙黑体',
  'LXGW WenKai': '霞鹜文楷', 'ZCOOL KuaiLe': '站酷快乐体', 'ZCOOL QingKe HuangYou': '站酷庆科黄油体', 'ZCOOL XiaoWei': '站酷小薇体', 'Ma Shan Zheng': '马善政楷书',
  'Zhi Mang Xing': '志莽行书', 'Liu Jian Mao Cao': '刘建毛草', 'Long Cang': '龙藏体',
};
const GENERIC: FontEntry[] = [
  { family: 'sans-serif', source: 'generic', zh: '系统无衬线' },
  { family: 'serif', source: 'generic', zh: '系统衬线' },
  { family: 'monospace', source: 'generic', zh: '系统等宽' },
];
/** Probed when the browser will not list local fonts. */
const CANDIDATES = Object.keys(ZH_NAMES).concat([
  'Helvetica Neue', 'Helvetica', 'Arial', 'Arial Black', 'Georgia', 'Times New Roman', 'Impact', 'Futura', 'Avenir', 'Avenir Next', 'Gill Sans', 'Baskerville', 'Didot',
  'Palatino', 'Optima', 'Menlo', 'Monaco', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', 'Inter', 'SF Pro Display', 'Rockwell', 'Copperplate',
  'Bradley Hand', 'Marker Felt', 'Chalkduster', 'Snell Roundhand', 'Papyrus', 'Hoefler Text', 'American Typewriter', 'Bodoni 72', 'Cooper Black', 'Franklin Gothic Medium',
]);

interface FontData { family: string; fullName: string; style: string }
type Local = (this: Window) => Promise<FontData[]>;
type MutableFonts = FontFaceSet & { add(face: FontFace): void; delete(face: FontFace): boolean };
export type SystemState = 'idle' | 'ok' | 'denied' | 'unsupported';

export class FontService {
  system: FontEntry[] = []; vault: FontEntry[] = []; state: SystemState = 'idle';
  private bytes = new Map<string, { family: string; ext: string; data: ArrayBuffer; mtime: number }>();
  private faces = new WeakMap<Document, Map<string, { face: FontFace; mtime: number }>>();
  private listeners = new Set<() => void>();
  private scan?: Promise<void>;
  bundled: BundledFont[] = BUNDLED_FONTS; private bundledLoaded = new WeakMap<Document, Map<string, Promise<void>>>();
  /** Ids of library files on disk with the expected size. */ private present = new Set<string>();
  private fetching = new Map<string, Promise<boolean>>(); private failedIds = new Set<string>(); private syncing = false;
  constructor(private app: App, private folder: () => string, private dir: () => string = () => '') {}
  /** Finds which library files are already on disk (a zip install ships them, a store install fetches them). */
  async loadBundledIndex(): Promise<void> {
    const adapter = this.app.vault.adapter;
    await Promise.all(this.bundled.map(async b => { try { const st = await adapter.stat(normalizePath(`${this.dir()}/fonts/${b.file}`)); if (st?.size === b.bytes) this.present.add(b.id); } catch { /* not there yet */ } }));
    this.emit();
  }
  libraryState(): LibraryState { return { total: this.bundled.length, ready: this.bundled.filter(b => this.present.has(b.id)).length, running: this.syncing, failed: this.bundled.filter(b => this.failedIds.has(b.id)).map(b => b.family) }; }
  private io(): SyncIO {
    const adapter = this.app.vault.adapter; const dir = this.dir();
    return {
      fetch: async url => { const res = await Promise.race([requestUrl({ url, throw: false }), new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), 60_000))]); if (res.status >= 400) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer; },
      sha256: async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x => x.toString(16).padStart(2, '0')).join(''),
      write: async (path, data) => { const full = normalizePath(`${dir}/${path}`); const folder = full.slice(0, full.lastIndexOf('/')); if (!(await adapter.exists(folder))) await adapter.mkdir(folder); await adapter.writeBinary(full, data); },
    };
  }
  /** One library file, fetched at most once at a time (the background sync and an urgent `ensure` share the same download). */
  private fetchBundled(b: BundledFont): Promise<boolean> {
    if (this.present.has(b.id)) return Promise.resolve(true);
    let p = this.fetching.get(b.id); if (p) return p;
    p = fetchFont(b, fontMirrors(FONT_LIBRARY_REPO, FONT_LIBRARY_VERSION), this.io()).then(() => { this.present.add(b.id); this.failedIds.delete(b.id); this.emit(); return true; }, () => { this.failedIds.add(b.id); this.emit(); return false; }).finally(() => this.fetching.delete(b.id));
    this.fetching.set(b.id, p); return p;
  }
  /**
   * Silently fetches every missing library font, default-template faces first. `onFonts` runs once those are in and again at
   * the end, so open covers re-pair their type as soon as it is possible. Failed files are retried on the next call.
   */
  async syncLibrary(onFonts?: () => void): Promise<void> {
    if (this.syncing) return; const plan = syncPlan(this.bundled, this.present); if (!plan.length) return;
    this.syncing = true; this.failedIds.clear(); this.emit();
    try { await syncFonts({ plan, mirrors: [], io: this.io(), fetchOne: f => this.fetchBundled(f).then(ok => { if (!ok) throw new Error('failed'); }), onReady: () => undefined, onPriorityDone: onFonts }); }
    finally { this.syncing = false; this.emit(); try { onFonts?.(); } catch (e) { console.error('[qiaomu-cover] re-pairing after font sync failed', e); } }
  }
  /** A library face that is not on disk yet but can be fetched: templates may plan with it, `ensure` fetches it on demand. */
  isLibraryFamily(family: string): boolean { return this.bundled.some(b => b.family === family && !this.failedIds.has(b.id)); }
  /** Already usable without downloading: in the vault font folder or shipped with the plugin. */
  hasFont(family: string): boolean { return this.vault.some(v => v.family === family) || this.hasBundled(family); }
  /** A bundled font that is installed but not yet loaded into this document: measuring text with it now would use a fallback face. */
  needsLoad(doc: Document, family: string): boolean { return this.isLibraryFamily(family) && !this.bundledReady.get(doc)?.has(family); }
  private bundledReady = new WeakMap<Document, Set<string>>();
  hasBundled(family: string): boolean { return this.bundled.some(b => b.family === family && this.present.has(b.id)); }
  private loadBundledFace(doc: Document, b: BundledFont): Promise<void> {
    let map = this.bundledLoaded.get(doc); if (!map) { map = new Map(); this.bundledLoaded.set(doc, map); }
    let p = map.get(b.family); if (p) return p;
    p = (async () => {
      const data = await this.app.vault.adapter.readBinary(normalizePath(`${this.dir()}/fonts/${b.file}`)); const url = URL.createObjectURL(new Blob([data], { type: MIME[b.file.split('.').pop() ?? 'woff2'] ?? 'font/woff2' }));
      try { const face = new FontFace(b.family, `url(${url})`, { display: 'block' }); await face.load(); (doc.fonts as MutableFonts).add(face); cache.clearFontCache(b.family); let set = this.bundledReady.get(doc); if (!set) { set = new Set(); this.bundledReady.set(doc, set); } set.add(b.family); } finally { URL.revokeObjectURL(url); }
    })();
    map.set(b.family, p); p.catch(() => map!.delete(b.family)); return p;
  }
  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(); }

  all(): FontEntry[] {
    const seen = new Set<string>(); const out: FontEntry[] = [];
    const bundled: FontEntry[] = this.bundled.filter(b => this.present.has(b.id)).map(b => ({ family: b.family, source: 'bundled' as const, ...(b.cjk ? { zh: b.family } : {}), mood: b.mood, cjk: b.cjk, hint: b.cjk ? b.hint : b.zh }));
    for (const entry of [...bundled, ...this.vault, ...GENERIC, ...this.system]) { const key = entry.family.toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(entry); } }
    return out;
  }
  /** Every face a design may use: what is loaded now plus library faces still downloading (fetched on first use). */
  catalog(): FontEntry[] {
    const now = this.all(); const have = new Set(now.map(e => e.family.toLowerCase()));
    const pending = this.bundled.filter(b => !have.has(b.family.toLowerCase()) && this.isLibraryFamily(b.family)).map((b): FontEntry => ({ family: b.family, source: 'bundled', ...(b.cjk ? { zh: b.family } : {}), mood: b.mood, cjk: b.cjk, hint: b.cjk ? b.hint : b.zh }));
    return [...now.filter(e => e.source === 'bundled'), ...pending, ...now.filter(e => e.source !== 'bundled')];
  }
  find(family: string): FontEntry | undefined { const key = family.toLowerCase(); return this.all().find(e => e.family.toLowerCase() === key); }

  /** Lists installed fonts. Falls back to probing well-known names when the API is missing or refused. */
  scanSystem(doc: Document, force = false): Promise<void> {
    if (this.scan && !force) return this.scan;
    this.scan = (async () => {
      const win = doc.defaultView as (Window & { queryLocalFonts?: Local }) | null;
      if (win?.queryLocalFonts) {
        try {
          const faces = await win.queryLocalFonts();
          const families = new Map<string, number>();
          for (const face of faces) families.set(face.family, (families.get(face.family) ?? 0) + 1);
          this.system = [...families].map(([family, styles]) => ({ family, source: 'system' as const, zh: ZH_NAMES[family], styles }))
            .sort((a, b) => a.family.localeCompare(b.family));
          this.state = 'ok'; this.emit(); return;
        } catch { this.state = 'denied'; }
      } else this.state = 'unsupported';
      this.system = CANDIDATES.filter(name => installed(doc, name)).map(family => ({ family, source: 'system' as const, zh: ZH_NAMES[family] })).sort((a, b) => a.family.localeCompare(b.family));
      this.emit();
    })();
    return this.scan;
  }

  /** Reads font files from the vault folder and registers them with the given document. */
  /** One scan at a time: several installs and file events used to run it side by side and decode each big font twice. */
  private vaultChain: Promise<void> = Promise.resolve();
  loadVault(doc: Document): Promise<void> {
    const run = this.vaultChain.then(() => this.loadVaultNow(doc)); this.vaultChain = run.catch(() => undefined); return run;
  }
  private async loadVaultNow(doc: Document): Promise<void> {
    const prefix = `${normalizePath(this.folder())}/`;
    const files = this.app.vault.getFiles().filter(f => f.path.startsWith(prefix) && FONT_EXTENSIONS.includes(f.extension.toLowerCase()));
    const present = new Set(files.map(f => f.path));
    for (const path of [...this.bytes.keys()]) if (!present.has(path)) this.drop(path);
    for (const file of files) {
      const known = this.bytes.get(file.path);
      if (!known || known.mtime !== file.stat.mtime) {
        try { this.bytes.set(file.path, { family: fontFamilyFromFile(file), ext: file.extension.toLowerCase(), data: await this.app.vault.readBinary(file), mtime: file.stat.mtime }); }
        catch { continue; }
      }
    }
    this.vault = [...this.bytes.values()].map(b => ({ family: b.family, source: 'vault' as const })).filter((e, i, a) => a.findIndex(x => x.family === e.family) === i).sort((a, b) => a.family.localeCompare(b.family));
    await this.register(doc); this.emit();
  }
  private drop(path: string): void {
    const known = this.bytes.get(path); this.bytes.delete(path);
    if (!known) return;
    cache.clearFontCache(known.family);
  }
  /** Adds every loaded vault font to `doc`; safe to call again for popped-out windows. */
  async register(doc: Document): Promise<void> {
    let faces = this.faces.get(doc);
    if (!faces) { faces = new Map(); this.faces.set(doc, faces); }
    for (const [path, entry] of [...faces]) {
      if (this.bytes.get(path)?.mtime !== entry.mtime) { (doc.fonts as MutableFonts).delete(entry.face); faces.delete(path); }
    }
    for (const [path, font] of this.bytes) {
      if (faces.has(path)) continue;
      try {
        // From a blob URL rather than a copied buffer: no 8 MB copy, and the browser decodes the font as a normal resource load.
        const url = URL.createObjectURL(new Blob([font.data]));
        const face = new FontFace(font.family, `url(${url})`, { display: 'block' });
        try { await face.load(); } finally { URL.revokeObjectURL(url); } (doc.fonts as MutableFonts).add(face); faces.set(path, { face, mtime: font.mtime }); cache.clearFontCache(font.family);
        await new Promise(r => window.setTimeout(r, 16)); // big CJK faces parse on the main thread; let the UI breathe between them
      } catch { /* a corrupt file must not block the others */ }
    }
  }

  /** Copies chosen font files into the vault font folder. Returns the families that became available. */
  async importFiles(files: File[], doc: Document): Promise<string[]> {
    const folder = normalizePath(this.folder());
    await ensureFolder(this.app, folder);
    const added: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!FONT_EXTENSIONS.includes(ext)) continue;
      if (file.size > 40 * 1024 * 1024) throw new Error('font-too-large');
      const base = safeName(file.name.replace(/\.[^.]+$/, ''));
      let path = normalizePath(`${folder}/${base}.${ext}`); let i = 1;
      while (this.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${folder}/${base} ${i++}.${ext}`);
      await this.app.vault.createBinary(path, await file.arrayBuffer());
      added.push(base);
    }
    await this.loadVault(doc);
    return added;
  }
  /** True when a font with this family name is already in the vault font folder. */
  hasVault(family: string): boolean { return this.vault.some(v => v.family === family); }
  /** Downloads a library font (trying each mirror in turn), unpacks it if zipped and saves it into the vault font folder. */
  async installLib(font: LibFont, doc: Document, onProgress?: (note: string) => void): Promise<void> {
    let data: ArrayBuffer | undefined; let last: unknown;
    // Mirrors are tried in turn, each with a deadline, so one slow or blocked host can never leave the button spinning.
    for (const [i, url] of font.urls.entries()) {
      try {
        onProgress?.(`${i + 1}/${font.urls.length}`);
        const res = await Promise.race([requestUrl({ url, throw: false }), new Promise<never>((_, rej) => window.setTimeout(() => rej(new Error('timeout')), 40_000))]);
        if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
        data = font.entry ? await unzipEntry(res.arrayBuffer, font.entry) : res.arrayBuffer;
        if (!looksLikeFont(data)) throw new Error('not-a-font'); break;
      } catch (e) { last = e; data = undefined; }
    }
    if (!data) throw last instanceof Error ? last : new Error('download-failed');
    const folder = normalizePath(this.folder()); await ensureFolder(this.app, folder);
    const path = normalizePath(`${folder}/${safeName(font.family)}.${font.ext}`);
    const existing = this.app.vault.getFileByPath(path);
    if (existing) await this.app.vault.modifyBinary(existing, data); else await this.app.vault.createBinary(path, data);
    await this.loadVault(doc);
  }
  /** Saves font bytes into the vault font folder under `family` and loads them. Used by the Google Fonts install. */
  async installBuffer(family: string, ext: 'woff2' | 'ttf' | 'otf', data: ArrayBuffer, doc: Document): Promise<void> {
    const folder = normalizePath(this.folder()); await ensureFolder(this.app, folder);
    const path = normalizePath(`${folder}/${safeName(family)}.${ext}`); const existing = this.app.vault.getFileByPath(path);
    if (existing) await this.app.vault.modifyBinary(existing, data); else await this.app.vault.createBinary(path, data);
    await this.loadVault(doc);
  }
  async remove(family: string, doc: Document): Promise<void> {
    const prefix = `${normalizePath(this.folder())}/`;
    for (const file of this.app.vault.getFiles()) {
      if (file.path.startsWith(prefix) && FONT_EXTENSIONS.includes(file.extension.toLowerCase()) && fontFamilyFromFile(file) === family) await this.app.fileManager.trashFile(file);
    }
    await this.loadVault(doc);
  }
  files(): { family: string; path: string; size: number; ext: string }[] {
    const prefix = `${normalizePath(this.folder())}/`;
    return this.app.vault.getFiles().filter(f => f.path.startsWith(prefix) && FONT_EXTENSIONS.includes(f.extension.toLowerCase()))
      .map(f => ({ family: fontFamilyFromFile(f), path: f.path, size: f.stat.size, ext: f.extension.toLowerCase() }));
  }

  /** Ensures a family is ready to draw. Resolves false when it cannot be found. */
  async ensure(doc: Document, family: string): Promise<boolean> {
    if (!family || GENERIC.some(g => g.family === family)) return true;
    const b = this.bundled.find(x => x.family === family);
    if (b && (this.present.has(b.id) || await this.fetchBundled(b))) { try { await this.loadBundledFace(doc, b); return true; } catch { /* fall through to the other checks */ } }
    try {
      const loaded = await doc.fonts.load(`16px "${family.replace(/"/g, '')}"`, '封面Aa');
      if (loaded.length) return true;
    } catch { /* fall through to a measurement check */ }
    return installed(doc, family);
  }
  available(doc: Document, family: string): boolean {
    if (!family || GENERIC.some(g => g.family === family)) return true;
    return this.vault.some(v => v.family === family) || this.hasBundled(family) || this.system.some(s => s.family === family) || installed(doc, family);
  }
}

export function fontFamilyFromFile(file: TFile): string { return file.basename; }
export function mimeForFont(ext: string): string { return MIME[ext] ?? 'application/octet-stream'; }

async function ensureFolder(app: App, path: string): Promise<void> {
  let current = '';
  for (const part of path.split('/')) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      try { await app.vault.createFolder(current); } catch (e) { if (!app.vault.getAbstractFileByPath(current)) throw e; }
    }
  }
}

/** True when `name` renders differently from the fallback fonts, i.e. it exists on this machine. */
export function installed(doc: Document, name: string): boolean {
  const canvas = doc.createElement('canvas'); const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const sample = 'mmmmmmmmmmlliWW封面设计字体';
  const width = (font: string): number => { ctx.font = `72px ${font}`; return ctx.measureText(sample).width; };
  return ['monospace', 'sans-serif', 'serif'].some(base => width(`"${name}", ${base}`) !== width(base));
}
