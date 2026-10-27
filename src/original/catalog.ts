import { API_PROVIDERS } from './model-access/services/api-providers';
import { SEEDREAM_MODELS } from './seedream';
/** Where models come from: the cards in the "add model" dialog. Names and ids are starting points; the dialog always lets you type your own. */
import type { KeyAccount } from './authflow';
import type { ChatSnap, ImageEngine, ImageSnap } from './aiparse';

export type Group = 'account' | 'provider' | 'local' | 'custom' | 'plan';
export interface PopularModel { id: string; name?: string; efforts?: string[] }
export interface ChatSource { id: string; name: string; group: Group; sub: string; protocol: ChatSnap['protocol']; baseUrl: string; keyUrl?: string; keyless?: boolean; login?: KeyAccount | 'codex' | 'chatgpt'; models: PopularModel[] }
export interface ImageSource { id: string; name: string; group: Group; sub: string; engine: ImageEngine; baseUrl: string; keyUrl?: string; keyless?: boolean; login?: KeyAccount | 'codex' | 'chatgpt'; models: PopularModel[] }

export const CHAT_SOURCES: ChatSource[] = [
  { id: 'chatgpt', name: 'ChatGPT', group: 'account', sub: 'Continue with ChatGPT', protocol: 'openai-responses', baseUrl: 'https://api.openai.com/v1', login: 'chatgpt', models: [] },
  { id: 'magpie', name: 'Magpie', group: 'local', sub: 'Claude Codex Copilot Kimi Qoder ZCode WorkBuddy Trae MiniMax MiMo', protocol: 'openai', baseUrl: 'http://127.0.0.1:3425/v1', keyless: true, models: [] },
  ...Object.entries(API_PROVIDERS).filter(([, preset]) => preset.group === 'plan').map(([id, preset]): ChatSource => ({ id, name: preset.label, group: 'plan', sub: 'Coding / Token Plan', protocol: 'openai', baseUrl: preset.baseUrl, keyUrl: preset.website, models: [] })),
  { id: 'codex', name: 'Codex CLI', group: 'account', sub: 'ChatGPT 账号，免密钥', protocol: 'codex', baseUrl: '', keyless: true, login: 'codex', models: [] },
  { id: 'tokendance', name: '词元跳动', group: 'account', sub: 'TokenDance · tokendance.space', login: 'tokendance', protocol: 'openai', baseUrl: 'https://tokendance.space/gateway/v1', keyUrl: 'https://tokendance.space/keys', models: [] },
  { id: 'deepseek', name: 'DeepSeek', group: 'provider', sub: 'api.deepseek.com', protocol: 'openai', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', models: [{ id: 'deepseek-flash' }] },
  { id: 'openai', name: 'OpenAI', group: 'provider', sub: 'api.openai.com', protocol: 'openai', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', models: [{ id: 'gpt-4.1-mini' }, { id: 'gpt-4.1' }, { id: 'o4-mini' }] },
  { id: 'anthropic', name: 'Anthropic Claude', group: 'provider', sub: 'api.anthropic.com', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys', models: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-haiku-5-5' }, { id: 'claude-opus-5-5' }] },
  { id: 'gemini', name: 'Google Gemini', group: 'provider', sub: 'generativelanguage.googleapis.com', protocol: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', models: [{ id: 'gemini-2.5-flash' }, { id: 'gemini-2.5-pro' }] },
  { id: 'doubao', name: '豆包 · 火山方舟', group: 'provider', sub: 'ark.cn-beijing.volces.com', protocol: 'openai', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', models: [{ id: 'doubao-seed-1-6-250615' }] },
  { id: 'moonshot', name: 'Kimi · Moonshot', group: 'provider', sub: 'api.moonshot.cn', protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', keyUrl: 'https://platform.moonshot.cn/console/api-keys', models: [{ id: 'kimi-latest' }, { id: 'moonshot-v1-8k' }] },
  { id: 'zhipu', name: '智谱 GLM', group: 'provider', sub: 'open.bigmodel.cn', protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: [{ id: 'glm-4-plus' }, { id: 'glm-4-flash' }] },
  { id: 'qwen', name: '通义千问 · 百炼', group: 'provider', sub: 'dashscope.aliyuncs.com', protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1', models: [{ id: 'qwen-plus' }, { id: 'qwen-max' }] },
  { id: 'siliconflow', name: 'SiliconFlow', group: 'provider', sub: 'api.siliconflow.cn', protocol: 'openai', baseUrl: 'https://api.siliconflow.cn/v1', keyUrl: 'https://cloud.siliconflow.cn/account/ak', models: [{ id: 'Qwen/Qwen2.5-72B-Instruct' }, { id: 'deepseek-ai/DeepSeek-V3' }] },
  { id: 'openrouter', name: 'OpenRouter', group: 'account', login: 'openrouter', sub: 'openrouter.ai · 中转', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', models: [{ id: 'google/gemini-2.5-flash' }, { id: 'deepseek/deepseek-flash' }, { id: 'openai/gpt-4.1-mini' }] },
  { id: 'ollama', name: 'Ollama', group: 'local', sub: '本机 localhost:11434', protocol: 'openai', baseUrl: 'http://localhost:11434/v1', keyless: true, models: [{ id: 'qwen2.5:14b' }] },
  { id: 'custom', name: '自定义', group: 'custom', sub: 'OpenAI 兼容接口 / 自建中转', protocol: 'openai', baseUrl: '', models: [] },
];
export const IMAGE_SOURCES: ImageSource[] = [
  { id: 'codex', name: 'Codex CLI', group: 'account', sub: 'ChatGPT 账号，免密钥', engine: 'codex', baseUrl: '', keyless: true, login: 'codex', models: [] },
  { id: 'ark', name: '豆包 Seedream', group: 'provider', sub: '火山方舟 · ark.cn-beijing.volces.com', engine: 'ark', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', keyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey', models: SEEDREAM_MODELS },
  { id: 'gemini', name: 'Google Gemini 生图', group: 'provider', sub: 'Nano Banana · generativelanguage.googleapis.com', engine: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey', models: [{ id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' }] },
  { id: 'openrouter', name: 'OpenRouter', group: 'account', login: 'openrouter', sub: 'openrouter.ai · 中转', engine: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', models: [{ id: 'google/gemini-2.5-flash-image' }, { id: 'bytedance-seed/seedream-4.5' }] },
  { id: 'openai', name: 'OpenAI', group: 'provider', sub: 'api.openai.com', engine: 'api', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', models: [{ id: 'gpt-image-1' }] },
  { id: 'zhipu', name: '智谱 CogView', group: 'provider', sub: 'open.bigmodel.cn', engine: 'api', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: [{ id: 'cogview-4' }] },
  { id: 'siliconflow', name: 'SiliconFlow', group: 'provider', sub: 'FLUX 等 · api.siliconflow.cn', engine: 'api', baseUrl: 'https://api.siliconflow.cn/v1', keyUrl: 'https://cloud.siliconflow.cn/account/ak', models: [{ id: 'black-forest-labs/FLUX.1-schnell' }] },
  { id: 'custom', name: '自定义', group: 'custom', sub: 'OpenAI 兼容 /images/generations', engine: 'api', baseUrl: '', models: [] },
];
export const GROUPS: { id: Group; zh: string; en: string }[] = [{ id: 'plan', zh: 'Coding 套餐', en: 'Coding plans' }, { id: 'account', zh: '支持账号登录', en: 'Sign in with an account' }, { id: 'provider', zh: 'API 服务商', en: 'API providers' }, { id: 'local', zh: '本地', en: 'Local' }, { id: 'custom', zh: '自定义', en: 'Custom' }];

export function chatSnapFrom(s: ChatSource, o: { key: string; baseUrl: string; model: string; codexBin?: string }): ChatSnap {
  return { preset: s.id === 'codex' ? 'codex' : s.id, protocol: s.protocol, baseUrl: o.baseUrl, apiKey: o.key, model: o.model, codexBin: o.codexBin ?? '', codexModel: s.id === 'codex' ? o.model : '' };
}
export function imageSnapFrom(s: ImageSource, o: { key: string; baseUrl: string; model: string }): ImageSnap {
  return { imageOn: true, imageEngine: s.engine, imageBaseUrl: s.engine === 'api' && !o.baseUrl ? '' : o.baseUrl, imageKey: o.key, imageModel: o.model, imageSize: 'auto' };
}
/** Which card a saved model came from, so editing opens the right form. */
export function chatSourceOf(s: ChatSnap): ChatSource { return CHAT_SOURCES.find(x => x.id === s.preset) ?? CHAT_SOURCES.find(x => x.id === 'custom')!; }
export function imageSourceOf(s: ImageSnap): ImageSource { return IMAGE_SOURCES.find(x => x.engine === s.imageEngine && (x.baseUrl === s.imageBaseUrl || (x.engine !== 'api' && x.id !== 'custom'))) ?? IMAGE_SOURCES.find(x => x.id === 'custom')!; }
