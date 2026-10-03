import { randomBytes, timingSafeEqual } from 'node:crypto';
import { seal, unseal } from './crypto.ts';
import { GitHub, GitHubError, installationClient, type Environment, type Fetch } from './github.ts';
import { Platform, PlatformError } from './platform.ts';
import { ValidationError, object, requestId } from '../shared/domain.ts';
import { targets } from '../shared/catalog.ts';
import { templateData } from './templates-data.ts';

type Session = { actor: string; userToken: string; expires: number };
type State = { nonce: string; expires: number };
export function createHandler(env: Environment, transport: Fetch = fetch) {
  const pages = new URL(env.PAGES_ORIGIN), api = new URL(env.API_ORIGIN);
  if (pages.origin !== env.PAGES_ORIGIN || api.origin !== env.API_ORIGIN || Buffer.from(env.SESSION_KEY, 'base64url').length !== 32) throw new Error('Invalid origin or SESSION_KEY');
  for (const url of [pages, api]) if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Production requires HTTPS');
  const secure = api.protocol === 'https:' ? '; Secure' : '';
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin'), url = new URL(request.url);
    const headers: Record<string, string> = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' };
    if (origin === pages.origin) Object.assign(headers, { 'Access-Control-Allow-Origin': pages.origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: origin === pages.origin ? 204 : 403, headers });
      if (request.method === 'GET' && url.pathname === '/auth/login') {
        const state = seal({ nonce: randomBytes(24).toString('base64url'), expires: Date.now() + 600000 }, env.SESSION_KEY);
        const login = new URL('https://github.com/login/oauth/authorize');
        login.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID); login.searchParams.set('redirect_uri', `${api.origin}/auth/callback`); login.searchParams.set('state', state);
        return new Response(null, { status: 302, headers: { ...headers, Location: login.href, 'Set-Cookie': `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=600${secure}` } });
      }
      if (request.method === 'GET' && url.pathname === '/auth/callback') {
        const state = url.searchParams.get('state') || '', cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('oauth_state='))?.slice(12) || '';
        if (!state || state.length !== cookie.length || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) throw new PlatformError(401, '登入 state 不一致');
        let decoded: State; try { decoded = unseal<State>(state, env.SESSION_KEY); } catch { throw new PlatformError(401, '登入 state 無效'); }
        if (decoded.expires < Date.now() || !url.searchParams.get('code')) throw new PlatformError(401, '登入已逾時或被取消');
        const response = await transport('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code: url.searchParams.get('code'), redirect_uri: `${api.origin}/auth/callback` }), signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new PlatformError(502, '登入交換失敗');
        const token = await response.json();
        if (!token.access_token) throw new PlatformError(401, 'GitHub 未核准登入');
        const user = new GitHub(token.access_token, transport), profile = await user.call('/user');
        const repository = await user.call(`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`);
        if (!repository.permissions?.push) throw new PlatformError(403, '需要平台 repository 的寫入權限');
        const session = seal({ actor: profile.login, userToken: token.access_token, expires: Date.now() + Math.min(token.expires_in || 3600, 3600) * 1000 }, env.SESSION_KEY);
        const payload = JSON.stringify({ type: 'taiphoon-auth', session, actor: profile.login }).replace(/</g, '\\u003c');
        const nonce = randomBytes(18).toString('base64url');
        return new Response(`<!doctype html><meta charset="utf-8"><title>Taiphoon 登入</title><p>登入成功，可以關閉此視窗。</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage(${payload},${JSON.stringify(pages.origin)});window.close();}</script>`, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`, 'Set-Cookie': `oauth_state=; HttpOnly; SameSite=Lax; Path=/auth; Max-Age=0${secure}` } });
      }
      if (origin !== pages.origin) throw new PlatformError(403, '不允許的網頁來源');
      const bearer = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{1,16384})$/)?.[1];
      let session: Session;
      try { if (!bearer) throw new Error(); session = unseal<Session>(bearer, env.SESSION_KEY); if (session.expires < Date.now()) throw new Error(); } catch { throw new PlatformError(401, '請重新登入 GitHub'); }
      // Recheck the user's permission on every call; an App installation alone is not user authorization.
      const userRepository = await new GitHub(session.userToken, transport).call(`/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`);
      if (!userRepository.permissions?.push) throw new PlatformError(403, '已無平台 repository 寫入權限');
      if (url.pathname === '/session' && request.method === 'GET') return json({ actor: session.actor, repository: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`, targets });
      const template = url.pathname.match(/^\/templates\/(ardupilot|px4|betaflight)$/);
      if (request.method === 'GET' && template) return json({ files: templateData[template[1]] });
      // GitHub App user tokens are bounded by both installation scope and user permissions.
      // No App private key or broader installation token is needed for user operations.
      const platform = new Platform(env, new GitHub(session.userToken, transport), session.actor);
      if (url.pathname === '/requests' && request.method === 'POST') {
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new PlatformError(415, '必須使用 JSON');
        if (Number(request.headers.get('content-length')) > 131072) throw new PlatformError(413, '設定太大');
        const reader = request.body?.getReader(); if (!reader) throw new PlatformError(400, '缺少設定');
        let size = 0; const chunks: Uint8Array[] = [];
        for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 131072) { await reader.cancel(); throw new PlatformError(413, '設定太大'); } chunks.push(value); }
        let body: Record<string, unknown>; try { body = object(JSON.parse(Buffer.concat(chunks).toString())); } catch { throw new PlatformError(400, '無效的 JSON'); }
        if (Object.keys(body).sort().join(',') !== 'config,requestId') throw new PlatformError(400, '不允許的提交欄位');
        return json(await platform.save(requestId(body.requestId), body.config), 201);
      }
      const match = url.pathname.match(/^\/requests\/([^/]+)(\/dispatch|\/status)?$/);
      if (!match) throw new PlatformError(404, '找不到 API');
      const id = requestId(match[1]);
      if (request.method === 'GET' && !match[2]) return json(await platform.saved(id));
      if (request.method === 'GET' && match[2] === '/status') return json(await platform.status(id));
      if (request.method === 'POST' && match[2] === '/dispatch') return json(await platform.dispatch(id));
      throw new PlatformError(405, '不支援的操作');
    } catch (e) {
      if (e instanceof PlatformError) return json({ error: e.message }, e.status);
      if (e instanceof ValidationError) return json({ error: e.message }, 422);
      if (e instanceof GitHubError) return json({ error: e.status === 403 || e.status === 429 ? 'GitHub 權限不足或 API 限流，請稍後重試' : `GitHub API 暫時無法完成操作（${e.status}）` }, 502);
      // Never serialize errors, request headers, GitHub response bodies or credential-bearing URLs.
      return json({ error: '服務暫時無法完成操作，請稍後重試' }, 503);
    }
  };
}
