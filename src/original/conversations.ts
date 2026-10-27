/** Designer conversations are isolated per canvas; only the active thread reaches a provider. */
export interface SavedChat { role: 'user' | 'assistant'; text: string; applied?: string[]; failed?: boolean; warn?: string[] }
export interface DesignerConversation { id: string; title: string; createdAt: number; updatedAt: number; draft: string; messages: SavedChat[] }
export interface ConversationBook { active: string; sessions: DesignerConversation[] }
const record = (v: unknown): Record<string, unknown> | undefined => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
export function savedMessages(raw: unknown): SavedChat[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedChat[] = [];
  for (const item of raw.slice(-100)) {
    const r = record(item); if (!r || (r.role !== 'user' && r.role !== 'assistant') || typeof r.text !== 'string') continue;
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 2000)) : [];
    const applied = strings(r.applied), warn = strings(r.warn);
    out.push({ role: r.role, text: r.text.slice(0, 8000), ...(applied.length ? { applied } : {}), ...(warn.length ? { warn } : {}), ...(r.failed === true ? { failed: true } : {}) });
  }
  return out;
}
export function newConversation(messages: SavedChat[] = [], now = Date.now(), id = crypto.randomUUID()): DesignerConversation {
  return { id, title: conversationTitle(messages), createdAt: now, updatedAt: now, draft: '', messages };
}
export function conversationTitle(messages: SavedChat[]): string { return messages.find(m => m.role === 'user' && m.text.trim())?.text.replace(/\s+/g, ' ').trim().slice(0, 48) ?? ''; }
export function mergeConversations(raw: unknown): Record<string, ConversationBook> {
  const input = record(raw), out: Record<string, ConversationBook> = Object.create(null) as Record<string, ConversationBook>; if (!input) return out;
  for (const [path, value] of Object.entries(input)) {
    const book = record(value); if (!book || !Array.isArray(book.sessions)) continue;
    const sessions: DesignerConversation[] = []; const ids = new Set<string>();
    for (const item of book.sessions.slice(0, 30)) {
      const r = record(item); if (!r || typeof r.id !== 'string' || !r.id) continue;
      const id = r.id.slice(0, 100); if (ids.has(id)) continue;
      const messages = savedMessages(r.messages); ids.add(id);
      const time = (v: unknown): number => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
      sessions.push({ id, title: typeof r.title === 'string' ? r.title.slice(0, 80) : conversationTitle(messages), createdAt: time(r.createdAt), updatedAt: time(r.updatedAt), draft: typeof r.draft === 'string' ? r.draft.slice(0, 8000) : '', messages });
    }
    if (sessions.length) out[path] = { active: sessions.some(s => s.id === book.active) ? String(book.active) : sessions[0]!.id, sessions };
  }
  return out;
}
/** Failed turns are display history, not instructions. Keep complete recent pairs within a bounded input budget. */
export function conversationContext(messages: SavedChat[]): { role: 'user' | 'assistant'; text: string }[] {
  const pairs: SavedChat[][] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i]!, assistant = messages[i + 1]!;
    if (user.role === 'user' && assistant.role === 'assistant') { if (!assistant.failed && !assistant.warn?.length) pairs.push([user, assistant]); i++; }
  }
  const out: { role: 'user' | 'assistant'; text: string }[] = []; let budget = 6000;
  for (const pair of pairs.slice(-3).reverse()) {
    const p = pair.map(m => ({ role: m.role, text: m.text.slice(0, 1500) })); const size = p.reduce((n, m) => n + m.text.length, 0);
    if (size > budget) break; out.unshift(...p); budget -= size;
  }
  return out;
}
