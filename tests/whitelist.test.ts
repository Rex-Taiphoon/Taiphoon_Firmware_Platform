import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createHandler } from '../server/handler.ts';
import { seal, unseal } from '../server/crypto.ts';
import { configFor, type SavedRequest } from '../shared/domain.ts';
import { env, ID, FakeGitHub } from './fixtures.ts';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const whitelistEnv = { ...env, GITHUB_ALLOWED_USERS: JSON.stringify({ '219089883': 'Rex-Taiphoon', '71856163': 'Qqww4599' }), GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
const sessionFor = (userId = '71856163', actor = 'Qqww4599') => seal({ userId, actor, expires: Date.now() + 60000 }, env.SESSION_KEY);
const headersFor = (token = sessionFor()) => ({ Origin: env.PAGES_ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

test('白名單依 GitHub ID 登入，帳號改名仍有效；session 不保存 GitHub token', async () => {
  const handler = createHandler(whitelistEnv, async input => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'FAKE_IDENTITY_TOKEN' });
    assert.equal(url, 'https://api.github.com/user');
    return Response.json({ id: 71856163, login: 'RenamedUser' });
  });
  const login = await handler(new Request(`${env.API_ORIGIN}/auth/login`));
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
  const response = await handler(new Request(`${env.API_ORIGIN}/auth/callback?state=${state}&code=test`, { headers: { Cookie: `oauth_state=${state}` } }));
  assert.equal(response.status, 200);
  const html = await response.text();
  const session = unseal<any>(html.match(/"session":"([A-Za-z0-9_-]+)"/)![1], env.SESSION_KEY);
  assert.equal(session.userId, '71856163'); assert.equal(session.actor, 'Qqww4599'); assert.equal(session.userToken, undefined);
});

test('非白名單帳號登入回報錯誤給主視窗，不檢查私人 repo 權限', async () => {
  const handler = createHandler(whitelistEnv, async input => String(input).includes('access_token') ? Response.json({ access_token: 'FAKE_TOKEN' }) : Response.json({ id: 123456, login: 'Qqww4599' }));
  const login = await handler(new Request(`${env.API_ORIGIN}/auth/login`));
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
  const result = await handler(new Request(`${env.API_ORIGIN}/auth/callback?state=${state}&code=test`, { headers: { Cookie: `oauth_state=${state}` } }));
  assert.equal(result.status, 403); const html = await result.text();
  assert.match(html, /taiphoon-auth-error/); assert.ok(!html.includes('FAKE_TOKEN'));
});

test('撤銷帳號、偽造 actor、舊 session 與空白名單全部拒絕，不取得 App token', async () => {
  let calls = 0;
  const transport = async () => { calls++; throw Error('Unexpected outbound call'); };
  for (const [config, session, expected] of [
    [whitelistEnv, sessionFor('12345'), 403],
    [whitelistEnv, sessionFor('71856163', 'Rex-Taiphoon'), 403],
    [whitelistEnv, seal({ actor: 'Rex-Taiphoon', userToken: 'FAKE_TOKEN', expires: Date.now() + 60000 }, env.SESSION_KEY), 401],
    [{ ...whitelistEnv, GITHUB_ALLOWED_USERS: '{}' }, sessionFor(), 403],
  ] as const) {
    const response = await createHandler(config, transport)(new Request(`${env.API_ORIGIN}/session`, { headers: headersFor(session) }));
    assert.equal(response.status, expected);
  }
  assert.equal(calls, 0);
  assert.throws(() => createHandler({ ...whitelistEnv, GITHUB_ALLOWED_USERS: 'null' }));
});

test('無 repo 權限的白名單使用者透過 App 保存、編譯、下載；不能存取其他人的工作', async () => {
  const gh = new FakeGitHub(); let assetReads = 0, minted = 0;
  const handler = createHandler(whitelistEnv, async (input, init) => {
    const url = new URL(String(input)); const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname.endsWith('/access_tokens')) {
      minted++; assert.deepEqual(body, { repositories: [env.GITHUB_REPO], permissions: { contents: 'write', actions: 'write' } });
      return Response.json({ token: 'FAKE_INSTALLATION_TOKEN' });
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer FAKE_INSTALLATION_TOKEN');
    assert.notEqual(url.pathname, '/user'); assert.notEqual(url.pathname, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`);
    if (url.pathname.endsWith('/releases/assets/1')) return Response.json(gh.provenance);
    if (url.pathname.endsWith('/releases/assets/2')) return Response.json(gh.publishedConfig);
    if (url.pathname.endsWith('/releases/assets/3')) { assetReads++; return new Response('FIRMWARE'); }
    return Response.json(await gh.call(url.pathname + url.search, init?.method || 'GET', body));
  });
  const headers = headersFor();
  const templates = await handler(new Request(`${env.API_ORIGIN}/templates/ardupilot`, { headers }));
  assert.equal(templates.status, 200); assert.equal(minted, 0);
  const response = await handler(new Request(`${env.API_ORIGIN}/requests`, { method: 'POST', headers, body: JSON.stringify({ requestId: ID, config: configFor('ardupilot') }) }));
  assert.equal(response.status, 201); const saved = await response.json() as SavedRequest;
  assert.equal(saved.actor, 'Qqww4599');
  const dispatch = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}/dispatch`, { method: 'POST', headers }));
  assert.equal((await dispatch.json()).phase, 'queued'); gh.publish(saved);
  const status = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}/status`, { headers }));
  const result = await status.json(); assert.equal(result.phase, 'success');
  assert.equal(result.assets[0].url, `${env.API_ORIGIN}/requests/${ID}/assets/3`);
  const download = await handler(new Request(result.assets[0].url, { headers }));
  assert.equal(download.status, 200); assert.equal(await download.text(), 'FIRMWARE'); assert.equal(assetReads, 1);
  assert.match(download.headers.get('content-disposition')!, /arducopter.apj/);
  assert.equal(download.headers.get('access-control-allow-origin'), env.PAGES_ORIGIN);
  for (const path of ['', '/status', '/dispatch', '/assets/3']) {
    const denied = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}${path}`, { method: path === '/dispatch' ? 'POST' : 'GET', headers: headersFor(sessionFor('219089883', 'Rex-Taiphoon')) }));
    assert.equal(denied.status, 403);
  }
  const arbitrary = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}/assets/9999`, { headers }));
  assert.equal(arbitrary.status, 404); assert.equal(assetReads, 1);
});
