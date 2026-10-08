import { validateConfig, requestId, type Config, type SavedRequest, type BuildStatus } from '../shared/domain.ts';
import { targetFor } from '../shared/catalog.ts';

export const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const demoAllowed = import.meta.env.DEV;
export class Client {
  session = ''; actor = '';
  demo: boolean;
  constructor(demo = false) { this.demo = demo; }
  private records = new Map<string, { saved: SavedRequest; started?: number; assetUrl?: string }>();
  async call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!apiUrl) throw new Error('尚未設定無伺服器 API，請先完成服務設定');
    const r = await fetch(`${apiUrl}${path}`, { method, headers: { Authorization: `Bearer ${this.session}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000), cache: 'no-store' });
    const result = await r.json();
    if (!r.ok) { if (r.status === 401) { this.session = ''; this.actor = ''; } throw new Error(result.error || 'API 操作失敗'); }
    return result as T;
  }
  async save(id: string, config: Config): Promise<SavedRequest> {
    requestId(id); validateConfig(config);
    if (!this.demo) return this.call('/requests', 'POST', { requestId: id, config });
    if (!demoAllowed) throw new Error('正式網站不可使用示範模式');
    const prior = this.records.get(id);
    if (prior) { if (JSON.stringify(prior.saved.config) !== JSON.stringify(config)) throw new Error('設定衝突'); return prior.saved; }
    const t = targetFor(config.target,config.profileId);
    const saved: SavedRequest = { requestId: id, actor: 'local-demo', createdAt: new Date().toISOString(), config: structuredClone(config), configSha: 'd'.repeat(40), sourceRepository: t.repository, sourceSha: t.sourceSha, ...(t.definition ? { definitionRepository: t.definition.repository, definitionSha: t.definition.sha } : {}) };
    this.records.set(id, { saved }); return saved;
  }
  async saved(id: string): Promise<SavedRequest> { return this.call(`/requests/${requestId(id)}`); }
  async download(url: string, name: string): Promise<void> {
    const destination = new URL(url);
    const api = new URL(apiUrl);
    if (destination.origin !== api.origin || !/^\/requests\/[a-f0-9-]+\/assets\/[1-9]\d*$/.test(destination.pathname) || destination.search || destination.hash) throw new Error('無效的下載網址');
    const response = await fetch(destination, { headers: { Authorization: `Bearer ${this.session}` }, cache: 'no-store', signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      if (response.status === 401) { this.session = ''; this.actor = ''; }
      throw new Error((await response.json()).error || '韌體下載失敗');
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = blobUrl; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
  async dispatch(id: string): Promise<BuildStatus> {
    if (!this.demo) return this.call(`/requests/${requestId(id)}/dispatch`, 'POST');
    const r = this.records.get(id); if (!r) throw new Error('請先保存設定'); r.started ??= Date.now(); return this.status(id);
  }
  async status(id: string): Promise<BuildStatus> {
    if (!this.demo) return this.call(`/requests/${requestId(id)}/status`);
    const r = this.records.get(id); if (!r) throw new Error('示範記錄已清除');
    if (!r.started) return { phase: 'saved' };
    const elapsed = Date.now() - r.started;
    if (elapsed < 6000) return { phase: elapsed < 1000 ? 'queued' : elapsed < 2200 ? 'validating' : elapsed < 4500 ? 'building' : 'publishing' };
    if (!r.assetUrl) r.assetUrl = URL.createObjectURL(new Blob([JSON.stringify({ warning: 'LOCAL FLOW DEMO — NOT FLASHABLE FIRMWARE', ...r.saved }, null, 2)], { type: 'application/json' }));
    return { phase: 'success', message: '本機流程示範完成；下載內容是設定記錄，不能刷寫', assets: [{ name: 'demo-settings.json', size: 0, sha256: '', url: r.assetUrl }] };
  }
  dispose() { for (const r of this.records.values()) if (r.assetUrl) URL.revokeObjectURL(r.assetUrl); this.records.clear(); this.session = ''; this.actor = ''; }
}
