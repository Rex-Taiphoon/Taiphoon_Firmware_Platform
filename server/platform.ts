import { createHash } from 'node:crypto';
import { canonicalConfig, requestId, sha, validateConfig, phaseForRun, verifyProvenance, releaseIdentity, ValidationError, type SavedRequest, type Snapshot, type BuildStatus } from '../shared/domain.ts';
import { targetFor } from '../shared/catalog.ts';
import { GitHub, GitHubError, type Environment } from './github.ts';

type DispatchRecord = { actor: string; configSha: string; status: 'pending' | 'accepted' | 'rejected' | 'uncertain'; runId?: number };
export class PlatformError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export class Platform {
  private repository: string;
  private env: Environment; private github: Pick<GitHub, 'call' | 'manifest'>; private actor: string;
  constructor(env: Environment, github: Pick<GitHub, 'call' | 'manifest'>, actor: string) { this.env = env; this.github = github; this.actor = actor; this.repository = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`; }
  private path(path: string): string { return `/repos/${this.repository}/${path}`; }
  private async file(path: string): Promise<{ value: any; blob: string } | undefined> {
    try {
      const f = await this.github.call(this.path(`contents/${path}?ref=${encodeURIComponent(this.env.GITHUB_CONFIG_BRANCH)}`));
      if (f.encoding !== 'base64' || f.size > 524288) throw new PlatformError(422, '無效的設定記錄');
      return { value: JSON.parse(Buffer.from(f.content, 'base64').toString()), blob: f.sha };
    } catch (e) { if (e instanceof GitHubError && e.status === 404) return undefined; throw e; }
  }
  private async write(path: string, value: unknown, blob?: string) {
    return this.github.call(this.path(`contents/${path}`), 'PUT', { message: `platform: ${path}`, branch: this.env.GITHUB_CONFIG_BRANCH, content: Buffer.from(JSON.stringify(value, null, 2) + '\n').toString('base64'), ...(blob ? { sha: blob } : {}) });
  }
  async saved(id: string): Promise<SavedRequest> {
    requestId(id);
    const file = await this.file(`requests/${id}.json`);
    if (!file) throw new PlatformError(404, '找不到此次設定');
    const s = file.value as Snapshot;
    if (s.actor !== this.actor) throw new PlatformError(403, '此工作屬於其他使用者');
    if (s.requestId !== id) throw new ValidationError('設定記錄 ID 不一致');
    validateConfig(s.config); sha(s.sourceSha);
    const target = targetFor(s.config.target);
    if (s.sourceRepository !== target.repository || s.sourceSha !== target.sourceSha || s.definitionRepository !== target.definition?.repository || s.definitionSha !== target.definition?.sha) throw new ValidationError('設定來源不在受控目標中');
    const commits = await this.github.call(this.path(`commits?path=requests/${id}.json&sha=${encodeURIComponent(this.env.GITHUB_CONFIG_BRANCH)}&per_page=1`));
    return { ...s, configSha: sha(commits[0]?.sha) };
  }
  async save(id: string, value: unknown): Promise<SavedRequest> {
    requestId(id); const config = validateConfig(value); const target = targetFor(config.target);
    if (!target.available) throw new PlatformError(422, target.note);
    const existing = await this.file(`requests/${id}.json`);
    if (existing) {
      if (existing.value.actor !== this.actor || canonicalConfig(existing.value.config) !== canonicalConfig(config)) throw new PlatformError(409, '此 request ID 已保存其他設定，請建立新的工作');
      return this.saved(id);
    }
    const snapshot: Snapshot = { requestId: id, actor: this.actor, createdAt: new Date().toISOString(), sourceRepository: target.repository, sourceSha: target.sourceSha, config,
      ...(target.definition ? { definitionRepository: target.definition.repository, definitionSha: target.definition.sha } : {}) };
    try {
      const result = await this.write(`requests/${id}.json`, snapshot);
      return { ...snapshot, configSha: sha(result.commit.sha) };
    } catch (e) {
      if (e instanceof GitHubError && [409, 422].includes(e.status)) {
        const saved = await this.saved(id);
        if (canonicalConfig(saved.config) === canonicalConfig(config)) return saved;
        throw new PlatformError(409, '設定保存衝突，請重新讀取');
      }
      throw e;
    }
  }
  private async findRun(id: string, workflow: string, record?: DispatchRecord) {
    if (record?.runId) {
      const run = await this.github.call(this.path(`actions/runs/${record.runId}`));
      if (run.display_title !== `Firmware ${id}` || run.path !== `.github/workflows/${workflow}`) throw new ValidationError('Actions 工作與請求不一致');
      return run;
    }
    for (let page = 1; page <= 5; page++) {
      const result = await this.github.call(this.path(`actions/workflows/${encodeURIComponent(workflow)}/runs?event=workflow_dispatch&per_page=100&page=${page}`));
      const run = result.workflow_runs.find((r: any) => r.display_title === `Firmware ${id}`);
      if (run) return run;
      if (result.workflow_runs.length < 100) break;
    }
  }
  async dispatch(id: string): Promise<BuildStatus> {
    const saved = await this.saved(id);
    const workflow = targetFor(saved.config.target).workflow || this.env.GITHUB_WORKFLOW_FILE;
    const location = `dispatches/${id}.json`, prior = await this.file(location);
    if (prior && prior.value.configSha !== saved.configSha) throw new PlatformError(409, '已保存的設定版本被變更，請建立新工作');
    if (prior && prior.value.status !== 'rejected') return this.status(id);
    const record: DispatchRecord = { actor: this.actor, configSha: saved.configSha, status: 'pending' };
    let lock: any;
    try { lock = await this.write(location, record, prior?.blob); }
    catch (e) { if (e instanceof GitHubError && [409, 422].includes(e.status)) return this.status(id); throw e; }
    try {
      const result = await this.github.call(this.path(`actions/workflows/${encodeURIComponent(workflow)}/dispatches`), 'POST', {
        ref: this.env.GITHUB_WORKFLOW_REF, inputs: { request_id: id, config_sha: saved.configSha, publish_release: 'true' },
      });
      const runId = result?.workflow_run_id;
      await this.write(location, { ...record, status: runId ? 'accepted' : 'uncertain', ...(runId ? { runId } : {}) }, lock.content.sha);
      return { phase: runId ? 'queued' : 'uncertain', ...(runId ? { runId, runUrl: `https://github.com/${this.repository}/actions/runs/${runId}` } : {}), message: runId ? undefined : '已送出，等待辨識 Actions 工作；不會自動重送' };
    } catch (e) {
      const rejected = e instanceof GitHubError && [400, 401, 403, 404, 422].includes(e.status);
      // A timeout or storage failure may follow a successful dispatch. Never repeat it automatically.
      try { await this.write(location, { ...record, status: rejected ? 'rejected' : 'uncertain' }, lock.content.sha); } catch { /* Keep pending lock; status still reconciles by request ID. */ }
      return { phase: rejected ? 'failed' : 'uncertain', canRetryDispatch: rejected, message: rejected ? 'GitHub 拒絕觸發；檢查權限與 workflow 設定後可重試' : '送出結果尚未確定；正在以 request ID 查詢，請勿重複建立工作' };
    }
  }
  async status(id: string): Promise<BuildStatus> {
    const saved = await this.saved(id), file = await this.file(`dispatches/${id}.json`);
    if (!file) return { phase: 'saved' };
    const record = file.value as DispatchRecord;
    if (record.actor !== this.actor || record.configSha !== saved.configSha) throw new PlatformError(409, '工作設定版本不一致');
    const run = await this.findRun(id, targetFor(saved.config.target).workflow || this.env.GITHUB_WORKFLOW_FILE, record);
    if (!run) return { phase: record.status === 'rejected' ? 'failed' : 'uncertain', canRetryDispatch: record.status === 'rejected', message: record.status === 'rejected' ? '尚未觸發，可修正設定後重試' : '等待 GitHub 回報工作；不會自動重送' };
    if (!record.runId) {
      // Persist reconciliation so older jobs remain findable beyond the bounded run search.
      try { await this.write(`dispatches/${id}.json`, { ...record, status: 'accepted', runId: run.id }, file.blob); } catch { /* Another poll may have stored it already. */ }
    }
    const jobs = await this.github.call(this.path(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`));
    const status: BuildStatus = { phase: phaseForRun(run, jobs.jobs), runId: run.id, runAttempt: run.run_attempt, runUrl: `https://github.com/${this.repository}/actions/runs/${run.id}` };
    if (run.status !== 'completed' || run.conclusion !== 'success') return status;
    try {
      const tag = releaseIdentity(saved,run.id,run.run_attempt).releaseTag;
      const release = await this.github.call(this.path(`releases/tags/${tag}`));
      if (release.draft) return { ...status, phase: 'failed', message: 'Release 尚未完成發布' };
      const manifestAsset = release.assets.find((a: any) => a.name === 'provenance.json');
      const configAsset = release.assets.find((a: any) => a.name === 'config.json');
      if (!manifestAsset || manifestAsset.size > 65536 || !configAsset || configAsset.size > 196608) throw new ValidationError('Release 缺少版本資訊或設定快照');
      const digest = createHash('sha256').update(canonicalConfig(saved.config)).digest('hex');
      const manifest = verifyProvenance(await this.github.manifest(this.repository, manifestAsset.id), saved, run, digest);
      if (canonicalConfig(await this.github.manifest(this.repository, configAsset.id, 196608)) !== canonicalConfig(saved.config)) throw new ValidationError('Release 設定快照內容不一致');
      const assets = manifest.assets.map(a => {
        const actual = release.assets.find((r: any) => r.name === a.name);
        if (!actual || actual.size !== a.size || (actual.digest && actual.digest !== `sha256:${a.sha256}`)) throw new ValidationError('Release 資產缺失或雜湊不符');
        return { ...a, url: `https://github.com/${this.repository}/releases/download/${tag}/${encodeURIComponent(a.name)}` };
      });
      return { ...status, phase: 'success', provenance: manifest, assets, releaseUrl: `https://github.com/${this.repository}/releases/tag/${tag}` };
    } catch (e) {
      if (e instanceof ValidationError || e instanceof GitHubError && e.status === 404) return { ...status, phase: 'failed', message: e instanceof ValidationError ? e.message : '工作完成但找不到對應 Release' };
      throw e;
    }
  }
}
