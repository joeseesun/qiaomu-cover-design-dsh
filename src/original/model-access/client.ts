import type { ApiConnection } from './types';
import type { SecretStore } from './services/provider-auth';
import { accessToken } from './services/provider-auth';
import { apiBaseUrl, apiProtocol, permitsEmptyKey } from './services/api-providers';
import { apiFetch, apiStatusError } from './services/api-transport';
import { accountObject as object } from './services/account-json';
import { chatgptBody, completeChatGPTStream } from './services/chatgpt-transport';

export interface ListedModel { id: string; name?: string; efforts?: string[] }
export function listedModels(raw: unknown, chatgpt = false): ListedModel[] {
  const body = object(raw), entries = chatgpt ? body.models ?? body.data : body.data;
  if (!Array.isArray(entries)) throw new Error('Invalid model list');
  const found = new Map<string, ListedModel>();
  for (const value of entries) {
    if (!value || typeof value !== 'object') continue;
    const item = object(value), id = chatgpt ? item.slug ?? item.id : item.id;
    if (typeof id !== 'string' || !id.trim() || (chatgpt && item.visibility !== 'list')) continue;
    const name = item.display_name ?? item.name;
    const levels = item.supported_reasoning_levels ?? item.reasoning_efforts;
    const efforts = Array.isArray(levels) ? levels.map(v => typeof v === 'string' ? v : v && typeof v === 'object' ? object(v).effort : null).filter((v): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,32}$/i.test(v)) : [];
    found.set(id, { id, name: typeof name === 'string' ? name : undefined, efforts });
  }
  return [...found.values()];
}
export async function connectionToken(connection: ApiConnection, raw: string, store: SecretStore): Promise<string> {
  const key = await accessToken(connection, raw, store);
  if (!key && !permitsEmptyKey(connection) && connection.provider !== 'custom') throw new Error('API key required');
  return key;
}
export async function discoverModels(connection: ApiConnection, raw: string, store: SecretStore, signal?: AbortSignal): Promise<ListedModel[]> {
  const key = await connectionToken(connection, raw, store);
  const response = await apiFetch(`${apiBaseUrl(connection)}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
  if (!response.ok) throw apiStatusError(response.status);
  return listedModels(await response.json() as unknown, connection.provider === 'chatgpt');
}
export interface TextMessage { role: string; content: string }
/** Text-only SIWC integration. No sampling parameters, server storage or paid POST replay. */
export async function completeChatGPT(connection: ApiConnection, store: SecretStore, messages: TextMessage[], options: { signal?: AbortSignal; effort?: string; onDelta?: (delta: string, answer: string) => void } = {}): Promise<string> {
  if (connection.provider !== 'chatgpt' || apiProtocol(connection) !== 'openai-responses') throw new Error('Invalid ChatGPT connection');
  const key = await connectionToken(connection, '', store);
  const response = await apiFetch(`${apiBaseUrl(connection)}/responses`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: options.signal,
    body: chatgptBody(JSON.stringify({ model: connection.model, input: messages, ...(options.effort ? { reasoning: { effort: options.effort } } : {}) })),
  });
  if (!response.ok) throw apiStatusError(response.status);
  const reader = completeChatGPTStream(response).body?.getReader();
  if (!reader) throw new Error('Empty response');
  const decoder = new TextDecoder(); let buffer = '', answer = '';
  const line = (value: string) => {
    if (!value.startsWith('data:')) return;
    const raw = value.slice(5).trim(); if (!raw || raw === '[DONE]') return;
    const event = object(JSON.parse(raw) as unknown);
    if (['error', 'response.failed', 'response.incomplete'].includes(String(event.type))) throw new Error('Response failed or incomplete');
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') { answer += event.delta; options.onDelta?.(event.delta, answer); }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; for (const item of lines) line(item);
      if (done) { if (buffer) line(buffer); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!answer.trim()) throw new Error('No text returned');
  return answer;
}
