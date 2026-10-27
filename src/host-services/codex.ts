/**
 * Desktop-only bridge to the local Codex CLI (`codex app-server`, JSON-RPC over stdio). It lets the AI designer use the
 * user's ChatGPT/Codex login for both layout planning and Codex's built-in image generation, so no API key is needed.
 * Same mechanism as the qiaomu-codex-imagegen skill. Node modules are loaded lazily so mobile never touches them.
 */
import type { ChildProcessWithoutNullStreams } from 'child_process';

type Req = (id: string) => unknown;
import {createRequire} from 'node:module';
const hostRequire=createRequire(import.meta.url);
const nodeRequire=():Req=>hostRequire;

/** GUI apps get a minimal PATH, so look in the usual install places before falling back to a login shell. */
export function findCodex(custom: string): string {
  const req = nodeRequire(); const fs = req('fs') as typeof import('fs'); const os = req('os') as typeof import('os'); const path = req('path') as typeof import('path');
  const home = os.homedir(); const expand = (p: string): string => p.replace(/^~(?=\/|\\|$)/, home);
  const candidates = [custom.trim() && expand(custom.trim()), path.join(home, '.local/bin/codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex', path.join(home, '.codex/bin/codex'), path.join(home, '.npm-global/bin/codex'), path.join(home, '.bun/bin/codex')].filter((x): x is string => !!x);
  for (const c of candidates) { try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ } }
  try {
    const cp = req('child_process') as typeof import('child_process');
    const out = cp.execFileSync(process.env.SHELL || '/bin/zsh', ['-lc', 'command -v codex'], { encoding: 'utf8', timeout: 5000 }).trim().split('\n').pop() ?? '';
    if (out && fs.existsSync(out)) return out;
  } catch { /* not found */ }
  throw new Error('codex-missing');
}

class Rpc {
  private child: ChildProcessWithoutNullStreams; private nextId = 1; private buffer = ''; private err = ''; closed = false;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private notes = new Set<(method: string, params: Record<string, unknown>) => void>();
  private closers = new Set<(e: Error) => void>();
  listen(fn: (method: string, params: Record<string, unknown>) => void): () => void { this.notes.add(fn); return () => this.notes.delete(fn); }
  whenClosed(fn: (e: Error) => void): () => void { this.closers.add(fn); return () => this.closers.delete(fn); }
  constructor(bin: string, cwd: string) {
    const cp = nodeRequire()('child_process') as typeof import('child_process');
    this.child = cp.spawn(bin, ['app-server', '--listen', 'stdio://'], { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk; const lines = this.buffer.split(/\r?\n/); this.buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) this.handle(line);
    });
    this.child.stderr.on('data', (c: Buffer) => { this.err = (this.err + c.toString()).slice(-600); });
    this.child.on('error', e => this.fail(new Error(`cannot start codex: ${e.message}`)));
    this.child.on('exit', code => this.fail(new Error(`codex exited (${code})${this.err ? `: ${this.err.trim()}` : ''}`)));
  }
  private fail(e: Error): void { this.closed = true; for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(e); } this.pending.clear(); for (const f of [...this.closers]) f(e); }
  private write(m: unknown): void { if (!this.closed) this.child.stdin.write(`${JSON.stringify(m)}\n`); }
  private handle(line: string): void {
    let msg: { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message?: string } };
    try { msg = JSON.parse(line) as typeof msg; } catch { return; }
    if (msg.id !== undefined && !msg.method && (msg.result !== undefined || msg.error)) {
      const p = this.pending.get(msg.id); if (!p) return; this.pending.delete(msg.id); clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || 'codex request failed')); else p.resolve(msg.result); return;
    }
    if (msg.method && msg.id !== undefined) { this.write({ id: msg.id, error: { code: -32601, message: 'not supported' } }); return; } // never approve anything
    if (msg.method) for (const f of [...this.notes]) f(msg.method, msg.params ?? {});
  }
  request(method: string, params: unknown, ms = 30000): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new Error('codex is not running'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, ms);
      this.pending.set(id, { resolve: v => resolve(v as Record<string, unknown>), reject, timer }); this.write({ id, method, params });
    });
  }
  notify(method: string): void { this.write({ method, params: {} }); }
  stop(): void { this.closed = true; try { this.child.kill('SIGTERM'); } catch { /* gone */ } }
}

export interface CodexOptions { bin: string; model?: string; timeoutSec?: number }
interface Item { type?: string; text?: string; status?: string; savedPath?: string; result?: string; failure?: { message?: string } }

/**
 * One long-lived `codex app-server` shared by every request. Starting the process and handshaking costs seconds, so it
 * is paid once; each request then only opens an ephemeral thread. The process is restarted if it dies and stopped after
 * a few idle minutes or when the plugin unloads.
 */
const IDLE_MS = 10 * 60 * 1000;
let shared: { bin: string; rpc: Rpc; ready: Promise<void>; busy: number; idle?: ReturnType<typeof setTimeout> } | undefined;
function session(bin: string): NonNullable<typeof shared> {
  if (shared && (shared.rpc.closed || shared.bin !== bin)) shutdownCodex();
  if (shared) return shared;
  const os = nodeRequire()('os') as typeof import('os');
  const rpc = new Rpc(bin, os.tmpdir());
  const ready = (async () => {
    await rpc.request('initialize', { clientInfo: { name: 'qiaomu_cover_design', title: 'Qiaomu Design', version: '0.2.4' } }, 20000);
    rpc.notify('initialized');
  })();
  const entry = { bin, rpc, ready, busy: 0 } as NonNullable<typeof shared>;
  ready.catch(() => { if (shared === entry) shutdownCodex(); });
  shared = entry; return entry;
}
export function shutdownCodex(): void { if (shared) { clearTimeout(shared.idle); shared.rpc.stop(); shared = undefined; } }
/** Starts the process ahead of the first request so the designer feels instant. Failures surface on the real request. */
export function warmCodex(bin: string): void { try { void session(bin).ready.catch(() => undefined); } catch { /* reported later */ } }

/** Runs one turn on a fresh thread and returns the finished items. `write` allows the image tool to save into `cwd`. */
async function runTurn(o: CodexOptions, instructions: string, text: string, cwd: string, write: boolean, references: string[] = []): Promise<{ items: Item[]; error?: string }> {
  const sess = session(o.bin); const { rpc } = sess; clearTimeout(sess.idle); sess.busy++;
  const items: Item[] = []; let error: string | undefined; let threadId = '';
  let offClose: (() => void) | undefined;
  let finish!: (v?: string) => void; const done = new Promise<string | undefined>((res, rej) => { finish = res; offClose = rpc.whenClosed(rej); });
  const offNote = rpc.listen((method, params) => {
    if (!threadId || params.threadId !== threadId) return;
    if (method === 'item/completed') items.push((params.item ?? {}) as Item);
    else if (method === 'turn/completed') finish();
    else if (method === 'error' && params.error) error = (params.error as { message?: string }).message ?? JSON.stringify(params.error);
  });
  const ms = Math.max(30, o.timeoutSec ?? 300) * 1000; const timer = setTimeout(() => finish('timeout'), ms);
  try {
    await sess.ready;
    const thread = await rpc.request('thread/start', { cwd, approvalPolicy: 'never', sandbox: write ? 'workspace-write' : 'read-only', ephemeral: true, serviceName: 'qiaomu_cover_design', ...(o.model ? { model: o.model } : {}), developerInstructions: instructions });
    threadId = (thread.thread as { id?: string } | undefined)?.id ?? ''; if (!threadId) throw new Error('codex did not return a thread id');
    await rpc.request('turn/start', { threadId, cwd, approvalPolicy: 'never', sandboxPolicy: write ? { type: 'workspaceWrite', writableRoots: [cwd], networkAccess: false } : { type: 'readOnly' }, ...(o.model ? { model: o.model } : {}), input: [{ type: 'text', text, text_elements: [] }, ...references.map(url => ({ type: 'image', url }))] });
    if ((await done) === 'timeout') throw new Error(`codex timed out after ${ms / 1000}s`);
  } finally {
    clearTimeout(timer); offNote(); offClose?.();
    if (--sess.busy <= 0 && shared === sess) sess.idle = setTimeout(shutdownCodex, IDLE_MS);
  }
  return { items, error };
}

const PLAN_GUARD = '\n\n你是纯文本助手：不要运行命令、读写文件或联网，直接按上面的格式回答。';
/** Asks Codex for a text reply (used for layout planning). */
export async function codexText(o: CodexOptions, system: string, user: string): Promise<string> {
  const os = nodeRequire()('os') as typeof import('os');
  const { items, error } = await runTurn(o, system + PLAN_GUARD, user, os.tmpdir(), false);
  const reply = [...items].reverse().find(i => i.type === 'agentMessage' && i.text)?.text;
  if (!reply) throw new Error(error || 'empty-reply'); return reply;
}

const RELAY = "You are an image-generation relay. Call the built-in image generation tool exactly once for the user's request, then reply with one short sentence. Do not run shell commands, write code, browse, or ask questions.";
/** Generates one picture with Codex's built-in image tool and returns its bytes. */
export async function codexImage(o: CodexOptions, prompt: string, references: string[] = []): Promise<{ data: ArrayBuffer; type: string }> {
  const req = nodeRequire(); const fs = req('fs') as typeof import('fs'); const os = req('os') as typeof import('os'); const path = req('path') as typeof import('path');
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'qc-codex-'));
  try {
    const { items, error } = await runTurn({ ...o, timeoutSec: o.timeoutSec ?? 600 }, RELAY, `${references.length ? 'Edit the provided reference image(s) according to this instruction' : 'Generate this image'}:\n${prompt}`, dir, true, references);
    const img = items.find(i => i.type === 'imageGeneration');
    if (img?.failure) throw new Error(img.failure.message || 'image generation failed');
    let buf: Buffer | undefined;
    if (typeof img?.savedPath === 'string' && img.savedPath) {
      let p = img.savedPath.replace(/^file:\/\//, ''); try { p = decodeURIComponent(p); } catch { /* keep */ }
      try { buf = await fs.promises.readFile(p); } catch { /* fall back to inline data */ }
    }
    if (!buf && typeof img?.result === 'string' && img.result) buf = Buffer.from(img.result.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buf) throw new Error(error || items.find(i => i.type === 'agentMessage')?.text || 'empty-image');
    const type = buf[0] === 0xff ? 'image/jpeg' : buf.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : 'image/png';
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, type };
  } finally { void fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined); }
}

export interface CodexInfo { path: string; version?: string }
/** Looks for the Codex CLI and asks it for its version, so settings can say "found" or "not found" instead of guessing. */
export async function detectCodex(custom: string): Promise<CodexInfo> {
  const path = findCodex(custom); const cp = nodeRequire()('child_process') as typeof import('child_process');
  const version = await new Promise<string | undefined>(resolve => { cp.execFile(path, ['--version'], { timeout: 6000 }, (err, out) => resolve(err ? undefined : String(out).trim().replace(/^codex(-cli)?\s*/i, ''))); });
  return { path, version };
}

/** Account state comes from the CLI, which owns OAuth credentials and refreshes them. */
async function accountRequest(custom: string, method: string, params: unknown): Promise<Record<string, unknown>> {
  const sess = session(findCodex(custom)); clearTimeout(sess.idle); sess.busy++;
  try { await sess.ready; return await sess.rpc.request(method, params); }
  finally { if (--sess.busy <= 0 && shared === sess) sess.idle = setTimeout(shutdownCodex, IDLE_MS); }
}
export async function codexAccount(custom: string): Promise<{ signedIn: boolean; label: string }> {
  const reply = await accountRequest(custom, 'account/read', { refreshToken: false });
  const account = reply.account as { type?: string; email?: string } | null;
  return { signedIn: !!account, label: account?.type === 'chatgpt' ? account.email || 'ChatGPT' : account?.type === 'apiKey' ? 'API key' : '' };
}
export async function codexModels(custom: string): Promise<{ id: string; name?: string }[]> {
  const reply = await accountRequest(custom, 'model/list', { limit: 100 });
  return ((reply.data ?? []) as { model: string; displayName?: string; hidden?: boolean }[]).filter(m => !m.hidden).map(m => ({ id: m.model, name: m.displayName }));
}
const loginCancels = new Set<() => void>();
export function cancelCodexLogins(): void { for (const cancel of loginCancels) cancel(); }
/** A separate process keeps cancelling a login from interrupting an active design turn. */
export async function startCodexLogin(custom: string): Promise<import('./authflow').LoginHandle<void>> {
  const os = nodeRequire()('os') as typeof import('os'); const rpc = new Rpc(findCodex(custom), os.tmpdir());
  let loginId = ''; let settled = false; let timer: ReturnType<typeof setTimeout> | undefined;
  let resolve!: () => void; let reject!: (e: Error) => void;
  const result = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; }); void result.catch(() => undefined);
  const clean = (): void => { clearTimeout(timer); offNote(); offClose(); loginCancels.delete(cancel); rpc.stop(); };
  const finish = (error?: string): void => { if (settled) return; settled = true; clean(); if (error) reject(new Error(error)); else resolve(); };
  const cancel = (): void => { if (settled) return; if (loginId) void rpc.request('account/login/cancel', { loginId }, 1000).catch(() => undefined); finish('login-cancelled'); };
  const offNote = rpc.listen((method, params) => { if (method === 'account/login/completed' && params.loginId === loginId) finish(params.success ? undefined : 'login-failed'); });
  const offClose = rpc.whenClosed(() => finish('login-process-closed'));
  loginCancels.add(cancel);
  try {
    await rpc.request('initialize', { clientInfo: { name: 'qiaomu_cover_design', title: 'Qiaomu Cover Design', version: '0.2.1' } }); rpc.notify('initialized');
    const started = await rpc.request('account/login/start', { type: 'chatgpt' });
    loginId = String(started.loginId ?? ''); const url = String(started.authUrl ?? '');
    if (!loginId || !url.startsWith('https://auth.openai.com/')) throw new Error('login-invalid-url');
    timer = setTimeout(() => finish('login-timeout'), 5 * 60_000);
    return { url, result, cancel };
  } catch (error) { finish('login-failed'); throw error; }
}
