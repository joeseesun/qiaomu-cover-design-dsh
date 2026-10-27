/** OAuth PKCE for services that exchange authorization for a scoped API key. No browser cookies are read. */
export type KeyAccount = 'openrouter' | 'tokendance';
export interface LoginHandle<T> { url: string; result: Promise<T>; cancel(): void }
export interface KeyLoginResult { key: string }
const SERVICES = {
  openrouter: { authorize: 'https://openrouter.ai/auth', exchange: 'https://openrouter.ai/api/v1/auth/keys' },
  tokendance: { authorize: 'https://tokendance.space/auth', exchange: 'https://tokendance.space/portal/api/v1/auth/keys' },
};
type Require = (id: string) => unknown;
export interface AuthRuntime { require: Require; exchange(url: string, body: string): Promise<unknown> }
const pending = new Set<() => void>();
export function cancelKeyLogins(): void { for (const cancel of pending) cancel(); }
export function accountUrl(kind: KeyAccount, callback: string, challenge: string, state: string): string {
  const params = new URLSearchParams({ callback_url: callback, code_challenge: challenge, code_challenge_method: 'S256', state });
  if (kind === 'openrouter') params.set('key_label', 'Qiaomu Cover Design');
  else { params.set('key_name', 'Qiaomu Cover Design'); params.set('app_url', 'https://github.com/joeseesun/qiaomu-cover-design'); }
  return `${SERVICES[kind].authorize}?${params}`;
}
export async function startKeyLogin(kind: KeyAccount, runtime: AuthRuntime, timeoutMs = 5 * 60_000): Promise<LoginHandle<KeyLoginResult>> {
  const http = runtime.require('http') as typeof import('http');
  const crypto = runtime.require('crypto') as typeof import('crypto');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(24).toString('base64url');
  // A random callback path also binds providers that do not echo the optional state parameter.
  const path = `/callback/${crypto.randomBytes(24).toString('hex')}`;
  let settled = false; let claimed = false;
  let resolve!: (v: KeyLoginResult) => void; let reject!: (e: Error) => void;
  const result = new Promise<KeyLoginResult>((ok, fail) => { resolve = ok; reject = fail; });
  // UI attaches immediately after the listener is ready; cancellation before that is also handled.
  void result.catch(() => undefined);
  const close = (): void => { clearTimeout(timer); server.close(); pending.delete(cancel); };
  const fail = (message: string): void => { if (settled) return; settled = true; close(); reject(new Error(message)); };
  const cancel = (): void => fail('login-cancelled');
  let origin = '';
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const back = new URL(req.url ?? '/', origin || 'http://127.0.0.1');
    if (req.method !== 'GET' || back.pathname !== path || req.headers.host !== new URL(origin).host) { res.writeHead(404); res.end('Not found'); return; }
    if (back.searchParams.has('error')) { res.end('Authorization cancelled. You can return to Obsidian.'); fail('login-denied'); return; }
    const returnedState = back.searchParams.get('state');
    if ((kind === 'openrouter' && returnedState !== state) || (returnedState !== null && returnedState !== state)) { res.writeHead(400); res.end('Invalid login state. Return to Obsidian and try again.'); return; }
    const code = back.searchParams.get('code');
    if (!code || code.length > 4096 || claimed || settled) { res.writeHead(400); res.end('Invalid callback'); return; }
    claimed = true;
    res.end('Authorization received. You can return to Obsidian. 授权已收到，请返回 Obsidian。');
    server.close();
    void runtime.exchange(SERVICES[kind].exchange, JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' })).then(data => {
      if (settled) return;
      const key = (data as { key?: unknown })?.key;
      if (typeof key !== 'string' || !key.trim()) { fail('login-empty-key'); return; }
      settled = true; close(); resolve({ key });
    }).catch(() => fail('login-exchange-failed'));
  });
  await new Promise<void>((ok, failListen) => {
    server.once('error', failListen);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', failListen); ok(); });
  });
  server.on('error', () => fail('login-listener-failed'));
  const address = server.address();
  if (!address || typeof address === 'string') { server.close(); throw new Error('login-listener-failed'); }
  origin = `http://127.0.0.1:${address.port}`;
  pending.add(cancel); const timer = setTimeout(() => fail('login-timeout'), timeoutMs);
  return { url: accountUrl(kind, `${origin}${path}`, challenge, state), result, cancel };
}
