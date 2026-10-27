import { SEEDREAM_MODELS, type SeedreamFamily } from './seedream';
/**
 * Pure helpers for the model-backed designer: provider presets, JSON extraction and validation of whatever a model
 * returns. Nothing here touches Obsidian or fabric, so it can be unit tested in plain Node.
 */
export { sanitizeOps } from './capabilities';
export type { Catalog } from './valid';

export interface AiConfig {
  chatAlias?: string; imageAlias?: string; chatEffort?: string; chatEfforts?: string[];
  /** Master switch: off keeps the plugin fully offline whatever else is filled in. */
  enabled: boolean;
  preset: string; protocol: 'openai' | 'anthropic' | 'codex' | 'openai-responses'; codexBin: string; codexModel: string; imageEngine: ImageEngine; baseUrl: string; apiKey: string; model: string;
  imageFamily?: SeedreamFamily;
  imageOn: boolean; imageBaseUrl: string; imageKey: string; imageModel: string; imageSize: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  /** Saved layout (chat) models and picture models. The flat fields above always hold the active ones, so the rest of the code never has to look here. */
  chats: ChatProfile[]; chatId: string; images: ImageProfile[]; imageId: string;
}
export type ImageEngine = 'api' | 'codex' | 'ark' | 'gemini' | 'openrouter';
export type ChatSnap = Pick<AiConfig, 'chatEffort' | 'chatEfforts' | 'chatAlias' | 'preset' | 'protocol' | 'baseUrl' | 'apiKey' | 'model' | 'codexBin' | 'codexModel'>;
export type ImageSnap = Pick<AiConfig, 'imageAlias' | 'imageOn' | 'imageEngine' | 'imageBaseUrl' | 'imageKey' | 'imageModel' | 'imageSize' | 'imageFamily'>;
export interface ChatProfile { id: string; snap: ChatSnap }
export interface ImageProfile { id: string; snap: ImageSnap }
export interface ProviderPreset { id: string; name: string; protocol: 'openai' | 'anthropic' | 'codex' | 'openai-responses'; baseUrl: string; model: string; imageModel?: string; imageBaseUrl?: string }

/** Starting points only. Every field stays editable because model names change faster than a plugin ships. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'codex', name: 'Codex CLI (ChatGPT login, no key)', protocol: 'codex', baseUrl: '', model: '' },
  { id: 'openai', name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', imageModel: 'gpt-image-1' },
  { id: 'anthropic', name: 'Anthropic Claude', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
  { id: 'moonshot', name: 'Kimi · Moonshot', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-latest' },
  { id: 'zhipu', name: '智谱 GLM', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', imageModel: 'cogview-4' },
  { id: 'siliconflow', name: 'SiliconFlow', protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct', imageModel: 'black-forest-labs/FLUX.1-schnell' },
  { id: 'doubao', name: '豆包 · 火山方舟', protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-250615' },
  { id: 'gemini', name: 'Google Gemini', protocol: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { id: 'qwen', name: '通义千问 · 百炼', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini' },
  { id: 'ollama', name: 'Ollama (local)', protocol: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:14b' },
  { id: 'custom', name: 'Custom (OpenAI-compatible)', protocol: 'openai', baseUrl: '', model: '' },
];
/** Picture engines. Model names change fast, so the values are starting points and stay editable. */
export const IMAGE_ENGINES: { id: ImageEngine; zh: string; en: string; baseUrl: string; model: string; hint: string }[] = [
  { id: 'codex', zh: 'Codex CLI（ChatGPT 账号，免密钥）', en: 'Codex CLI (ChatGPT login)', baseUrl: '', model: '', hint: '' },
  { id: 'ark', zh: '豆包 Seedream（火山方舟）', en: 'Doubao Seedream (Volcengine Ark)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seedream-5-0-pro-260628', hint: 'ark.cn-beijing.volces.com' },
  { id: 'gemini', zh: 'Google Gemini 生图（Nano Banana）', en: 'Google Gemini image', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash-image', hint: 'aistudio.google.com' },
  { id: 'openrouter', zh: 'OpenRouter 中转', en: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.5-flash-image', hint: 'openrouter.ai' },
  { id: 'api', zh: 'OpenAI 兼容接口（OpenAI / 自定义中转）', en: 'OpenAI-compatible / custom', baseUrl: 'https://api.openai.com/v1', model: 'gpt-image-1', hint: '/images/generations' },
];
export const AI_DEFAULTS: AiConfig = { enabled: true, preset: 'openai', protocol: 'openai', codexBin: '', codexModel: '', imageEngine: 'api', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4.1-mini', imageOn: false, imageBaseUrl: '', imageKey: '', imageModel: 'gpt-image-1', imageSize: 'auto', chats: [], chatId: '', images: [], imageId: '' };

export function mergeAi(raw: unknown): AiConfig {
  const base: AiConfig = { ...AI_DEFAULTS, chats: [], images: [] }; if (!raw || typeof raw !== 'object') { ensureProfiles(base); return base; }
  const r = raw as Record<string, unknown>;
  for (const key of ['preset', 'codexBin', 'codexModel', 'baseUrl', 'apiKey', 'model', 'imageBaseUrl', 'imageKey', 'imageModel'] as const) if (typeof r[key] === 'string') base[key] = r[key] as string;
  if (r.protocol === 'openai' || r.protocol === 'anthropic' || r.protocol === 'codex' || r.protocol === 'openai-responses') base.protocol = r.protocol;
  if (r.imageEngine === 'api' || r.imageEngine === 'codex' || r.imageEngine === 'ark' || r.imageEngine === 'gemini' || r.imageEngine === 'openrouter') base.imageEngine = r.imageEngine;
  for (const key of ['chatAlias', 'imageAlias'] as const) if (typeof r[key] === 'string') base[key] = (r[key] as string).trim().slice(0, 80);
  const families = ['3.0', '4.0', '4.5', '5.0-lite', '5.0-pro', '5.0-flash'];
  if (typeof r.imageFamily === 'string' && families.includes(r.imageFamily)) base.imageFamily = r.imageFamily as SeedreamFamily;
  if (typeof r.enabled === 'boolean') base.enabled = r.enabled;
  if (typeof r.imageOn === 'boolean') base.imageOn = r.imageOn;
  if (r.imageSize === 'auto' || r.imageSize === '1024x1024' || r.imageSize === '1536x1024' || r.imageSize === '1024x1536') base.imageSize = r.imageSize;
  const chatSnap = (o: unknown): ChatSnap | undefined => { if (!o || typeof o !== 'object') return undefined; const q = o as Record<string, unknown>; const str = (k: string): string => typeof q[k] === 'string' ? q[k] as string : ''; const protocol = q.protocol === 'anthropic' || q.protocol === 'codex' || q.protocol === 'openai-responses' ? q.protocol : 'openai'; return { chatEffort: str('chatEffort') || undefined, chatEfforts: Array.isArray(q.chatEfforts) ? q.chatEfforts.filter((v): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,32}$/i.test(v)) : undefined, ...(str('chatAlias') ? { chatAlias: str('chatAlias').trim().slice(0,80) } : {}), preset: str('preset') || 'custom', protocol, baseUrl: str('baseUrl'), apiKey: str('apiKey'), model: str('model'), codexBin: str('codexBin'), codexModel: str('codexModel') }; };
  const imageSnap = (o: unknown): ImageSnap | undefined => { if (!o || typeof o !== 'object') return undefined; const q = o as Record<string, unknown>; const str = (k: string): string => typeof q[k] === 'string' ? q[k] as string : ''; const e = q.imageEngine; const sizes = ['auto', '1024x1024', '1536x1024', '1024x1536']; return { ...(str('imageAlias') ? { imageAlias: str('imageAlias').trim().slice(0,80) } : {}), ...(families.includes(str('imageFamily')) ? { imageFamily: str('imageFamily') as SeedreamFamily } : {}), imageOn: q.imageOn === true, imageEngine: e === 'codex' || e === 'ark' || e === 'gemini' || e === 'openrouter' ? e : 'api', imageBaseUrl: str('imageBaseUrl'), imageKey: str('imageKey'), imageModel: str('imageModel'), imageSize: (sizes.includes(str('imageSize')) ? str('imageSize') : 'auto') as AiConfig['imageSize'] }; };
  if (Array.isArray(r.chats)) for (const x of r.chats.slice(0, 100)) { const o = x as { id?: unknown; snap?: unknown }; const snap = chatSnap(o?.snap); if (snap && typeof o.id === 'string') base.chats.push({ id: o.id, snap }); }
  if (Array.isArray(r.images)) for (const x of r.images.slice(0, 100)) { const o = x as { id?: unknown; snap?: unknown }; const snap = imageSnap(o?.snap); if (snap && typeof o.id === 'string') base.images.push({ id: o.id, snap }); }
  if (typeof r.chatId === 'string') base.chatId = r.chatId; if (typeof r.imageId === 'string') base.imageId = r.imageId;
  // Older Codex image settings inherited the API image default, which is not a Codex text model.
  if (base.imageEngine === 'codex' && base.imageModel === 'gpt-image-1') base.imageModel = '';
  for (const p of base.images) if (p.snap.imageEngine === 'codex' && p.snap.imageModel === 'gpt-image-1') p.snap.imageModel = '';
  if (typeof r.chatEffort === 'string') base.chatEffort = r.chatEffort;
  if (Array.isArray(r.chatEfforts)) base.chatEfforts = r.chatEfforts.filter((v): v is string => typeof v === 'string');
  ensureProfiles(base);
  return base;
}
const CHAT_KEYS = ['preset', 'protocol', 'baseUrl', 'apiKey', 'model', 'codexBin', 'codexModel'] as const;
const IMAGE_KEYS = ['imageFamily', 'imageOn', 'imageEngine', 'imageBaseUrl', 'imageKey', 'imageModel', 'imageSize'] as const;
export const pickChat = (c: AiConfig): ChatSnap => ({ chatEffort: c.chatEffort, chatEfforts: c.chatEfforts, ...(c.chatAlias ? { chatAlias: c.chatAlias } : {}), preset: c.preset, protocol: c.protocol, baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model, codexBin: c.codexBin, codexModel: c.codexModel });
export const pickImage = (c: AiConfig): ImageSnap => ({ ...(c.imageAlias ? { imageAlias: c.imageAlias } : {}), imageOn: c.imageOn, imageEngine: c.imageEngine, imageBaseUrl: c.imageBaseUrl, imageKey: c.imageKey, imageModel: c.imageModel, imageSize: c.imageSize, ...(c.imageFamily ? { imageFamily: c.imageFamily } : {}) });
/** First run and old settings files: the flat fields become the first saved models, so nothing the user configured is lost. */
export function ensureProfiles(c: AiConfig): void {
  if (!c.chats.length && (c.apiKey || c.protocol === 'codex' || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(c.baseUrl))) { c.chats.push({ id: 'chat-1', snap: pickChat(c) }); c.chatId = 'chat-1'; }
  if (!c.images.length && (c.imageKey || c.imageOn || c.imageEngine === 'codex')) { c.images.push({ id: 'image-1', snap: pickImage(c) }); c.imageId = 'image-1'; }
  if (!c.chats.some(x => x.id === c.chatId)) { c.chatId = c.chats[0]?.id ?? ''; if (c.chats[0]) { c.chatAlias = c.chats[0].snap.chatAlias; Object.assign(c, c.chats[0].snap); } }
  if (!c.images.some(x => x.id === c.imageId)) { c.imageId = c.images[0]?.id ?? ''; if (c.images[0]) { c.imageAlias = c.images[0].snap.imageAlias; c.imageFamily = c.images[0].snap.imageFamily; Object.assign(c, c.images[0].snap); } }
}
/** Writes the flat (active) fields back into the active saved models. Call before saving settings. */
export function syncProfiles(c: AiConfig): void {
  const a = c.chats.find(x => x.id === c.chatId); if (a) a.snap = pickChat(c);
  const b = c.images.find(x => x.id === c.imageId); if (b) b.snap = pickImage(c);
}
let nextId = 0; const fresh = (prefix: string): string => `${prefix}-${Date.now().toString(36)}${(nextId++).toString(36)}`;
export function switchChat(c: AiConfig, id: string): boolean { syncProfiles(c); const p = c.chats.find(x => x.id === id); if (!p) return false; c.chatId = id; c.chatAlias = p.snap.chatAlias; Object.assign(c, { chatEffort: undefined, chatEfforts: undefined }, p.snap); return true; }
export function switchImage(c: AiConfig, id: string): boolean { syncProfiles(c); const p = c.images.find(x => x.id === id); if (!p) return false; c.imageId = id; c.imageAlias = p.snap.imageAlias; c.imageFamily = p.snap.imageFamily; Object.assign(c, { chatEffort: undefined, chatEfforts: undefined }, p.snap); return true; }
/** A new saved model starts as a copy of the active one, which becomes active so it can be edited at once. */
export function addChat(c: AiConfig): string { syncProfiles(c); const id = fresh('chat'); c.chats.push({ id, snap: { ...pickChat(c), apiKey: '' } }); c.chatId = id; c.apiKey = ''; return id; }
export function addImage(c: AiConfig): string { syncProfiles(c); const id = fresh('image'); c.images.push({ id, snap: { ...pickImage(c), imageKey: '' } }); c.imageId = id; c.imageKey = ''; return id; }
/** Callers may append without changing the active model. Editing replaces the saved one in place. */
export function saveChat(c: AiConfig, snap: ChatSnap, editId?: string, activate = true): string {
  syncProfiles(c); const id = editId ?? fresh('chat'); const at = c.chats.find(x => x.id === id);
  if (at) at.snap = snap; else c.chats.push({ id, snap });
  if ((!editId && activate) || editId === c.chatId) { c.chatId = id; c.chatAlias = snap.chatAlias; Object.assign(c, snap); } return id;
}
export function saveImage(c: AiConfig, snap: ImageSnap, editId?: string, activate = true): string {
  syncProfiles(c); const id = editId ?? fresh('image'); const at = c.images.find(x => x.id === id);
  if (at) at.snap = snap; else c.images.push({ id, snap });
  if ((!editId && activate) || editId === c.imageId) { c.imageId = id; c.imageAlias = snap.imageAlias; c.imageFamily = snap.imageFamily; Object.assign(c, snap); } return id;
}
export function removeChat(c: AiConfig, id: string): void {
  syncProfiles(c); c.chats = c.chats.filter(x => x.id !== id);
  if (c.chatId === id) { c.chatId = c.chats[0]?.id ?? ''; c.chatAlias = c.chats[0]?.snap.chatAlias; Object.assign(c, c.chats[0]?.snap ?? pickChat(AI_DEFAULTS)); }
}
export function removeImage(c: AiConfig, id: string): void {
  syncProfiles(c); c.images = c.images.filter(x => x.id !== id);
  if (c.imageId === id) { c.imageId = c.images[0]?.id ?? ''; c.imageAlias = c.images[0]?.snap.imageAlias; c.imageFamily = c.images[0]?.snap.imageFamily; Object.assign(c, c.images[0]?.snap ?? pickImage(AI_DEFAULTS)); }
}
/** Short names for menus and chips. */
export function chatLabel(s: ChatSnap): string { return s.chatAlias?.trim() || (s.protocol === 'codex' ? s.codexModel.trim() || 'Codex CLI' : s.model.trim() || s.preset); }
export function imageLabel(s: ImageSnap): string {
  if (s.imageAlias?.trim()) return s.imageAlias.trim(); if (s.imageEngine === 'codex') return s.imageModel || 'Codex CLI';
  const seedream = s.imageEngine === 'ark' && SEEDREAM_MODELS.find(m => m.id === s.imageModel); if (seedream) return seedream.name;
  if (s.imageEngine === 'api' && /^jimeng-\d\.\d$/.test(s.imageModel)) return `Jimeng ${s.imageModel.slice(7)}`;
  const e = IMAGE_ENGINES.find(x => x.id === s.imageEngine); return s.imageModel.trim() || (e ? e.zh.split('（')[0]! : s.imageEngine);
}
void CHAT_KEYS; void IMAGE_KEYS;
export function aiReady(c: AiConfig): boolean {
  if (!c.enabled) return false;
  if (c.protocol === 'codex') return true;
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(c.baseUrl);
  return !!c.baseUrl.trim() && !!c.model.trim() && (!!c.apiKey.trim() || local);
}
export function imageReady(c: AiConfig): boolean {
  if (!c.enabled) return false;
  if (!c.imageOn) return false;
  if (c.imageEngine === 'codex') return true;
  if (!c.imageModel.trim()) return false;
  if (c.imageEngine === 'ark' || c.imageEngine === 'gemini' || c.imageEngine === 'openrouter') return !!c.imageKey.trim();
  const base = c.imageBaseUrl.trim() || (c.protocol === 'openai' ? c.baseUrl.trim() : '');
  const key = c.imageKey.trim() || (c.imageBaseUrl.trim() ? '' : c.apiKey.trim());
  return !!base && (!!key || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(base));
}
/** Resolve legacy image profiles that intentionally inherit the layout service connection. */
export function imageConnection(c: Pick<AiConfig, 'protocol' | 'baseUrl' | 'apiKey'>, snap: ImageSnap): ImageSnap {
  if (snap.imageEngine !== 'api' || snap.imageBaseUrl) return { ...snap };
  return { ...snap, imageBaseUrl: c.protocol === 'openai' ? c.baseUrl : '', imageKey: snap.imageKey || c.apiKey };
}
/** A model is already configured only for the same connection; aliases/options do not change its identity. */
export function sameChatModel(a: ChatSnap, b: ChatSnap): boolean {
  if (a.protocol !== b.protocol) return false;
  if (a.protocol === 'codex') return a.codexModel === b.codexModel && a.codexBin.trim() === b.codexBin.trim();
  return trimBase(a.baseUrl) === trimBase(b.baseUrl) && a.apiKey === b.apiKey && a.model === b.model;
}
export function sameImageModel(c: AiConfig, a: ImageSnap, b: ImageSnap): boolean {
  const left = imageConnection(c, a), right = imageConnection(c, b);
  return left.imageEngine === right.imageEngine && trimBase(left.imageBaseUrl) === trimBase(right.imageBaseUrl) && left.imageKey === right.imageKey && left.imageModel === right.imageModel;
}
/** An explicit image request opts into its selected profile without changing the designer's defaults. */
export function directImageConfig(c: AiConfig, id: string): AiConfig | undefined {
  const profile = c.images.find(p => p.id === id);
  if (!profile && id !== c.imageId) return undefined;
  const snap = id === c.imageId ? pickImage(c) : profile!.snap;
  return { ...c, ...snap, imageAlias: snap.imageAlias, imageFamily: snap.imageFamily, imageOn: true, chats: c.chats.map(p => ({ ...p, snap: { ...p.snap } })), images: c.images.map(p => ({ ...p, snap: { ...p.snap } })) };
}
export function trimBase(url: string): string { return url.trim().replace(/\/+$/, ''); }

/** Nearest size the common image endpoints accept for a canvas aspect ratio. */
export function pickImageSize(width: number, height: number, forced: AiConfig['imageSize'] = 'auto'): '1024x1024' | '1536x1024' | '1024x1536' {
  if (forced !== 'auto') return forced;
  const r = width / height; return r > 1.2 ? '1536x1024' : r < 0.83 ? '1024x1536' : '1024x1024';
}

/** Seedream wants an explicit WxH (at least 1024 × 1024 in total pixels, aspect between 1:16 and 16:1); aim for about 2K. */
export function pickArkSize(width: number, height: number): string {
  const area = 2048 * 2048; const r = Math.min(16, Math.max(1 / 16, width / height)); const w = Math.round(Math.sqrt(area * r) / 8) * 8; const h = Math.round(Math.sqrt(area / r) / 8) * 8; return `${w}x${h}`;
}
/** The aspect ratios Gemini and OpenRouter image models accept, nearest to the canvas. */
export function pickAspect(width: number, height: number): string {
  const options: [string, number][] = [['1:1', 1], ['3:4', 3 / 4], ['4:3', 4 / 3], ['9:16', 9 / 16], ['16:9', 16 / 9], ['2:3', 2 / 3], ['3:2', 3 / 2], ['21:9', 21 / 9]]; const r = width / height;
  return options.reduce((best, o) => Math.abs(Math.log(o[1] / r)) < Math.abs(Math.log(best[1] / r)) ? o : best)[0];
}

/** Pulls the first JSON object out of a reply that may be wrapped in prose or a Markdown fence. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text); const source = fenced ? fenced[1]! : text;
  const start = source.indexOf('{'); if (start < 0) throw new Error('no-json');
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i]!;
    if (inString) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) return JSON.parse(source.slice(start, i + 1));
  }
  throw new Error('no-json');
}
