import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createHandler } from '../server/handler.ts';
import { seal, unseal } from '../server/crypto.ts';
import { configFor, type SavedRequest } from '../shared/domain.ts';
import { env, ID, FakeGitHub } from './fixtures.ts';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const testEnv = { ...env, GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
test('HTTP handler 經使用者授權與 installation token 完成保存、觸發、狀態、版本核對下載', async () => {
  const gh = new FakeGitHub(); let minted = 0;
  const handler = createHandler(testEnv, async (input, init) => {
    const url = new URL(String(input)); const method = init?.method || 'GET'; const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (/\/app\/installations\/.+\/access_tokens$/.test(url.pathname)) {
      minted++; assert.deepEqual(body.repositories, [env.GITHUB_REPO]); assert.deepEqual(body.permissions, { contents: 'write', actions: 'write' }); return Response.json({ token: 'FAKE_INSTALLATION_TOKEN' });
    }
    if (url.pathname === `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`) return Response.json({ permissions: { push: true } });
    if (url.pathname.endsWith('/releases/assets/1')) return Response.json(gh.provenance);
    if (url.pathname.endsWith('/releases/assets/2')) return Response.json(gh.publishedConfig);
    return Response.json(await gh.call(url.pathname + url.search, method, body));
  });
  const session = seal({ actor: 'Rex-Taiphoon', userToken: 'FAKE_USER_TOKEN', expires: Date.now() + 60000 }, env.SESSION_KEY);
  const headers = { Origin: env.PAGES_ORIGIN, Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' };
  const savedResponse = await handler(new Request(`${env.API_ORIGIN}/requests`, { method: 'POST', headers, body: JSON.stringify({ requestId: ID, config: configFor('ardupilot') }) }));
  assert.equal(savedResponse.status, 201); const saved = await savedResponse.json() as SavedRequest;
  const dispatched = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}/dispatch`, { method: 'POST', headers })); assert.equal((await dispatched.json()).phase, 'queued');
  assert.deepEqual(gh.dispatchInputs, { request_id: ID, config_sha: saved.configSha, publish_release: 'true' });
  gh.publish(saved);
  const status = await handler(new Request(`${env.API_ORIGIN}/requests/${ID}/status`, { headers }));
  const result = await status.json(); assert.equal(result.phase, 'success'); assert.equal(result.provenance.configSha, saved.configSha);
  assert.equal(status.headers.get('access-control-allow-origin'), env.PAGES_ORIGIN);
  assert.ok(!JSON.stringify(result).includes('FAKE_')); assert.equal(minted, 3);
});
test('OAuth 完成後只傳加密平台 session，GitHub token 不會送入 HTML', async () => {
  const handler = createHandler(env, async input => {
    const url = String(input);
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: 'FAKE_OAUTH_TOKEN', expires_in: 3600 });
    if (url.endsWith('/user')) return Response.json({ login: 'Rex-Taiphoon' });
    return Response.json({ permissions: { push: true } });
  });
  const login = await handler(new Request(`${env.API_ORIGIN}/auth/login`));
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
  const response = await handler(new Request(`${env.API_ORIGIN}/auth/callback?state=${state}&code=FAKE_CODE`, { headers: { Cookie: `oauth_state=${state}` } }));
  assert.equal(response.status, 200); const html = await response.text();
  assert.ok(!html.includes('FAKE_OAUTH_TOKEN')); assert.ok(!html.includes('FAKE_CLIENT_SECRET')); assert.ok(!html.includes('FAKE_CODE'));
  const session = html.match(/"session":"([A-Za-z0-9_-]+)"/)![1];
  assert.equal(unseal<any>(session, env.SESSION_KEY).userToken, 'FAKE_OAUTH_TOKEN');
  assert.ok(html.includes(JSON.stringify(env.PAGES_ORIGIN))); assert.match(response.headers.get('content-security-policy')!, /nonce-/);
});
