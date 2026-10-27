import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { accountUrl, cancelKeyLogins, startKeyLogin } from '../../src/original/authflow';
const require = createRequire(import.meta.url);

test('OAuth keeps callbacks on loopback and exchanges a code with its matching PKCE verifier only once', async () => {
  let calls = 0; let verifier = '';
  const login = await startKeyLogin('openrouter', { require, exchange: async (url, raw) => {
    calls++; assert.equal(url, 'https://openrouter.ai/api/v1/auth/keys'); const body = JSON.parse(raw);
    verifier = body.code_verifier; assert.equal(body.code, 'fixture-code'); assert.equal(body.code_challenge_method, 'S256');
    return { key: 'fixture-key' };
  } });
  try {
    const auth = new URL(login.url); const callback = new URL(auth.searchParams.get('callback_url')!);
    assert.equal(callback.hostname, '127.0.0.1'); assert.equal(auth.origin, 'https://openrouter.ai');
    const bad = new URL(callback); bad.searchParams.set('code', 'fixture-code'); bad.searchParams.set('state', 'wrong');
    assert.equal((await fetch(bad)).status, 400); assert.equal(calls, 0);
    const foreign = new URL('/callback/another-request', callback); assert.equal((await fetch(foreign)).status, 404);
    callback.searchParams.set('code', 'fixture-code'); callback.searchParams.set('state', auth.searchParams.get('state')!);
    assert.equal((await fetch(callback)).status, 200);
    assert.deepEqual(await login.result, { key: 'fixture-key' }); assert.equal(calls, 1);
    assert.equal(createHash('sha256').update(verifier).digest('base64url'), auth.searchParams.get('code_challenge'));
    await assert.rejects(fetch(callback));
  } finally { login.cancel(); }
});

test('cancelled and timed-out logins reject and release their local listener', async () => {
  const runtime = { require, exchange: async () => { throw Error('must not exchange'); } };
  const cancelled = await startKeyLogin('openrouter', runtime);
  cancelled.cancel(); await assert.rejects(cancelled.result, /login-cancelled/);
  const timeout = await startKeyLogin('openrouter', runtime, 20);
  await assert.rejects(timeout.result, /login-timeout/);
  const pending = await startKeyLogin('openrouter', runtime); cancelKeyLogins(); await assert.rejects(pending.result, /login-cancelled/);
});

test('TokenDance supports its PKCE callback without state, with a unique unguessable path', async () => {
  const login = await startKeyLogin('tokendance', { require, exchange: async (url) => { assert.equal(url, 'https://tokendance.space/portal/api/v1/auth/keys'); return { key: 'fixture-key' }; } });
  try {
    const url = new URL(login.url); const callback = new URL(url.searchParams.get('callback_url')!);
    assert.match(callback.pathname, /^\/callback\/[a-f0-9]{48}$/); assert.equal(url.origin, 'https://tokendance.space');
    callback.searchParams.set('code', 'one-time-code'); await fetch(callback); assert.equal((await login.result).key, 'fixture-key');
  } finally { login.cancel(); }
});

test('late exchanges cannot complete cancelled logins, errors never include authorization codes', async () => {
  let complete!: (v: unknown) => void;
  const login = await startKeyLogin('openrouter', { require, exchange: () => new Promise(resolve => { complete = resolve; }) });
  const auth = new URL(login.url); const callback = new URL(auth.searchParams.get('callback_url')!);
  callback.searchParams.set('state', auth.searchParams.get('state')!); callback.searchParams.set('code', 'private-code');
  await fetch(callback); login.cancel(); complete({ key: 'late-private-key' });
  await assert.rejects(login.result, /^Error: login-cancelled$/);
  assert.ok(!accountUrl('openrouter', 'http://127.0.0.1/callback', 'challenge', 'state').includes('private'));
});

test('provider denial without state ends the pending login instead of leaving it waiting', async () => {
  const login=await startKeyLogin('openrouter',{require,exchange:async()=>{throw Error('no exchange on denial');}});
  const callback=new URL(new URL(login.url).searchParams.get('callback_url')!);callback.searchParams.set('error','access_denied');
  assert.equal((await fetch(callback)).status,200);await assert.rejects(login.result,/login-denied/);
});
