import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seal, unseal } from '../server/crypto.ts';
import { createHandler } from '../server/handler.ts';
import { configFor, validateConfig, requestId, sha } from '../shared/domain.ts';
import { plan, setDefine, setPx4, amendAm32 } from '../scripts/adapter.ts';
import { env, ID } from './fixtures.ts';

test('拒絕 shell 字串、任意目標、額外欄位與錯誤型別', () => {
  const c = configFor('ardupilot');
  for (const value of [{ ...c, target: '$(id)' }, { ...c, shell: 'rm -rf /' }, { ...c, options: { ...c.options, vehicle: 'copter; id' } }, { ...c, options: { ...c.options, osdType2: 5 } }, { ...configFor('px4'), options: { dds: 'true', osd: true } }]) assert.throws(() => validateConfig(value));
  assert.throws(() => requestId('../other')); assert.throws(() => sha('main'));
  assert.throws(() => plan({ ...c, options: { ...c.options, vehicle: '$(id)' } }, '/definition'));
});
test('每個已接入目標使用固定命令與實際 MORAKOT 目標', () => {
  assert.equal(plan(configFor('ardupilot'), '/defs')[1].args[0], 'copter');
  assert.ok(plan(configFor('px4'), '/defs')[1].args.includes('morakot_v6_default'));
  assert.ok(plan(configFor('betaflight'), '/defs')[1].args.includes('CONFIG=MORAKOT'));
  assert.ok(plan(configFor('am32'), '/defs')[1].args.includes('MORAKOT_4IN1_ESC_60A_G071'));
  assert.throws(() => plan(configFor('inav'), '/defs'), /韌體版本/);
});
test('設定修改保留 C 前處理指令邊界，且不修改其他 ESC 硬體', () => {
  assert.equal(setDefine('#ifndef USE_GPS\n\n#define USE_GPS\n#endif\n', 'USE_GPS', false), '#ifndef USE_GPS\n\n// platform: USE_GPS disabled\n#endif\n');
  assert.throws(() => setDefine('#define USE_OTHER\n', 'USE_GPS', true), /找不到/);
  assert.equal(setPx4('CONFIG_MODULES_UXRCE_DDS_CLIENT=y\n', 'CONFIG_MODULES_UXRCE_DDS_CLIENT', false), '# CONFIG_MODULES_UXRCE_DDS_CLIENT is not set\n');
  const text = '#define AM32_ESC_G071\n#ifdef MORAKOT_4IN1_ESC_60A_G071\n#define USE_SERIAL_TELEMETRY\n#endif\n#ifdef OTHER_ESC\n#define USE_SERIAL_TELEMETRY\n#endif\n';
  const result = amendAm32(text, 'G071', false);
  assert.ok(!result.includes('#define AM32_ESC_G071')); assert.ok(result.includes('#ifdef OTHER_ESC\n#define USE_SERIAL_TELEMETRY\n#endif'));
});
test('session 加密且篡改會被拒絕', () => {
  const token = seal({ userToken: 'FAKE_GITHUB_TOKEN', actor: 'Rex-Taiphoon' }, env.SESSION_KEY);
  assert.ok(!token.includes('FAKE_GITHUB_TOKEN')); assert.equal(unseal<any>(token, env.SESSION_KEY).userToken, 'FAKE_GITHUB_TOKEN');
  const bytes = Buffer.from(token, 'base64url'); bytes[20] ^= 1; assert.throws(() => unseal(bytes.toString('base64url'), env.SESSION_KEY));
});
test('禁止外站來源、未登入、逾期 session；不呼叫 GitHub', async () => {
  let calls = 0; const handler = createHandler(env, async () => { calls++; throw new Error('FAKE_PRIVATE_KEY'); });
  assert.equal((await handler(new Request(`${env.API_ORIGIN}/requests`, { method: 'POST', headers: { Origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await handler(new Request(`${env.API_ORIGIN}/session`, { headers: { Origin: env.PAGES_ORIGIN } }))).status, 401);
  const expired = seal({ actor: 'Rex-Taiphoon', userToken: 'FAKE_TOKEN', expires: Date.now() - 1 }, env.SESSION_KEY);
  assert.equal((await handler(new Request(`${env.API_ORIGIN}/session`, { headers: { Origin: env.PAGES_ORIGIN, Authorization: `Bearer ${expired}` } }))).status, 401);
  assert.equal(calls, 0);
});
test('session 不代表使用者仍有寫入權限；每次檢查 repository 權限', async () => {
  const handler = createHandler(env, async () => Response.json({ permissions: { push: false } }));
  const token = seal({ actor: 'Rex-Taiphoon', userToken: 'FAKE_TOKEN', expires: Date.now() + 60000 }, env.SESSION_KEY);
  const result = await handler(new Request(`${env.API_ORIGIN}/session`, { headers: { Origin: env.PAGES_ORIGIN, Authorization: `Bearer ${token}` } }));
  assert.equal(result.status, 403); assert.ok(!(await result.text()).includes('FAKE_TOKEN'));
});
test('OAuth state 必須綁定 cookie 且未過期', async () => {
  let calls = 0; const handler = createHandler(env, async () => { calls++; throw new Error('Should not call'); });
  const login = await handler(new Request(`${env.API_ORIGIN}/auth/login`)); assert.equal(login.status, 302);
  const state = new URL(login.headers.get('location')!).searchParams.get('state')!;
  assert.match(login.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/); assert.match(login.headers.get('set-cookie')!, /Secure/);
  const bad = await handler(new Request(`${env.API_ORIGIN}/auth/callback?state=${state}&code=test`, { headers: { Cookie: 'oauth_state=other' } })); assert.equal(bad.status, 401);
  const expired = seal({ nonce: 'test', expires: Date.now() - 1 }, env.SESSION_KEY);
  assert.equal((await handler(new Request(`${env.API_ORIGIN}/auth/callback?state=${expired}&code=test`, { headers: { Cookie: `oauth_state=${expired}` } }))).status, 401); assert.equal(calls, 0);
});
test('伺服器錯誤不可洩漏憑證或原始 GitHub 回應', async () => {
  const handler = createHandler(env, async () => { throw new Error('FAKE_TOKEN FAKE_PRIVATE_KEY FAKE_CLIENT_SECRET'); });
  const session = seal({ actor: 'Rex-Taiphoon', userToken: 'FAKE_TOKEN', expires: Date.now() + 60000 }, env.SESSION_KEY);
  const result = await handler(new Request(`${env.API_ORIGIN}/session`, { headers: { Origin: env.PAGES_ORIGIN, Authorization: `Bearer ${session}` } }));
  assert.equal(result.status, 503); const text = await result.text(); assert.ok(!text.includes('FAKE_'));
  assert.equal(result.headers.get('cache-control'), 'no-store');
});
test('正式環境僅接受 HTTPS 與有效 session key', () => {
  assert.throws(() => createHandler({ ...env, API_ORIGIN: 'http://api.example.com' }));
  assert.throws(() => createHandler({ ...env, SESSION_KEY: 'short' }));
});
