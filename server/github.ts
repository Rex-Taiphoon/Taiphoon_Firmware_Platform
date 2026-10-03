import { appJwt } from './crypto.ts';
export type Fetch = typeof fetch;
export class GitHubError extends Error {
  status: number;
  constructor(status: number) { super(`GitHub API 回應 ${status}`); this.status = status; }
}
export class GitHub {
  private token: string; private transport: Fetch;
  constructor(token: string, transport: Fetch = fetch) {
    this.token = token;
    // Workers' native fetch rejects a GitHub instance as its this receiver.
    this.transport = (input, init) => transport(input, init);
  }
  async call<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
    const response = await this.transport(`https://api.github.com${path}`, {
      method, headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Taiphoon-Firmware-Platform', 'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new GitHubError(response.status);
    return response.status === 204 ? undefined as T : await response.json() as T;
  }
  async manifest(repository: string, id: number, maxBytes = 65536): Promise<unknown> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 196608) throw new Error('Invalid manifest limit');
    const r = await this.transport(`https://api.github.com/repos/${repository}/releases/assets/${id}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/octet-stream', 'User-Agent': 'Taiphoon-Firmware-Platform', 'X-GitHub-Api-Version': '2026-03-10' }, signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new GitHubError(r.status);
    // Bound streamed data too; Content-Length is not trusted.
    const reader = r.body!.getReader(); let text = ''; let size = 0; const decoder = new TextDecoder();
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new Error('Manifest too large'); } text += decoder.decode(value, { stream: true }); }
    return JSON.parse(text + decoder.decode());
  }
}
export type Environment = {
  PAGES_ORIGIN: string; API_ORIGIN: string; GITHUB_OWNER: string; GITHUB_REPO: string;
  GITHUB_CONFIG_BRANCH: string; GITHUB_WORKFLOW_REF: string; GITHUB_WORKFLOW_FILE: string;
  GITHUB_APP_CLIENT_ID: string; GITHUB_APP_CLIENT_SECRET: string; SESSION_KEY: string;
  GITHUB_APP_ID?: string; GITHUB_APP_INSTALLATION_ID?: string; GITHUB_APP_PRIVATE_KEY?: string;
};
export async function installationClient(env: Environment, transport: Fetch): Promise<GitHub> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.GITHUB_APP_INSTALLATION_ID) throw new Error('Installation credentials not configured');
  const app = new GitHub(appJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY), transport);
  const result = await app.call(`/app/installations/${env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, 'POST', {
    repositories: [env.GITHUB_REPO],
    permissions: { contents: 'write', actions: 'write' },
  });
  return new GitHub(result.token, transport);
}
