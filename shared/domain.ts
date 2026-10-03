import { targets, targetFor, type FirmwareId } from './catalog.ts';
import { validateFiles } from './file-policy.ts';
export type Config = {
  schemaVersion: 1;
  target: FirmwareId;
  options: Record<string, string | boolean>;
  files?: Record<string, string>;
};
export function configFor(id: FirmwareId): Config { return { schemaVersion: 1, target: id, options: Object.fromEntries(targetFor(id).fields.map(f => [f.key, f.default])) }; }
export const defaultConfig = configFor('ardupilot');
export type Snapshot = {
  requestId: string; actor: string; createdAt: string; sourceRepository: string;
  sourceSha: string; config: Config; definitionRepository?: string; definitionSha?: string;
};
export type SavedRequest = Snapshot & { configSha: string };
export type Phase = 'saved' | 'dispatching' | 'queued' | 'validating' | 'building' | 'publishing' | 'success' | 'failed' | 'cancelled' | 'uncertain';
export type Asset = { name: string; sha256: string; size: number; url?: string };
export type Provenance = {
  schemaVersion: 1; requestId: string; configSha: string; configDigest: string;
  sourceRepository: string; sourceSha: string; workflowSha: string;
  runId: number; runAttempt: number; target: FirmwareId; toolchain: string; assets: Asset[];
  definitionRepository?: string; definitionSha?: string;
  firmwareVersion?: string; buildDate?: string; releaseTag?: string; variant?: string;
};
export type BuildStatus = {
  phase: Phase; message?: string; runId?: number; runAttempt?: number;
  runUrl?: string; releaseUrl?: string; assets?: Asset[]; provenance?: Provenance;
  canRetryDispatch?: boolean;
};
export class ValidationError extends Error {}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('必須是物件');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) throw new ValidationError('設定包含缺失或未允許的欄位');
}
export function validateConfig(value: unknown): Config {
  const c = object(value); keys(c, ['schemaVersion', 'target', 'options', ...(c.files !== undefined ? ['files'] : [])]);
  const target = targets.find(t => t.id === c.target);
  if (c.schemaVersion !== 1 || !target) throw new ValidationError('不支援的設定版本或編譯目標');
  const o = object(c.options); keys(o, target.fields.map(f => f.key));
  const options: Config['options'] = {};
  for (const f of target.fields) {
    const v = o[f.key];
    if (f.kind === 'boolean' ? typeof v !== 'boolean' : !f.choices?.some(choice => choice.value === v)) throw new ValidationError(`${f.label}不在允許範圍`);
    options[f.key] = v as string | boolean;
  }
  let files: Record<string, string> | undefined;
  try { if (c.files !== undefined) files = validateFiles(target.id, c.files); } catch (e) { throw new ValidationError((e as Error).message); }
  const result: Config = { schemaVersion: 1, target: target.id, options, ...(files ? { files } : {}) };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 196608) throw new ValidationError('完整配置快照超過 192 KiB');
  return result;
}
export function requestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new ValidationError('無效的 request ID');
  return value;
}
export function sha(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) throw new ValidationError('必須使用完整 commit SHA');
  return value;
}
export function canonicalConfig(value: unknown): string { return JSON.stringify(validateConfig(value)); }
export function releaseIdentity(saved: Snapshot, runId: number, attempt: number) {
  const t = targetFor(saved.config.target), date = saved.createdAt.slice(0,10).replaceAll('-','');
  const variant = String(saved.config.options.vehicle || saved.config.options.variant || 'Morakot');
  const firmwareVersion = t.vehicleVersions?.[variant] || t.version || t.sourceSha.slice(0,12);
  const version = firmwareVersion.replace(/[^A-Za-z0-9._-]/g,'-');
  return { firmwareVersion, buildDate: saved.createdAt.slice(0,10), variant,
    releaseTag: `${t.id}-${variant}-${version}-${date}-${runId}-${attempt}` };
}
export function verifyProvenance(p: unknown, saved: SavedRequest, run: { id: number; run_attempt: number; head_sha: string }, digest: string): Provenance {
  const m = object(p);
  const identity = releaseIdentity(saved,run.id,run.run_attempt);
  if (Object.entries(identity).some(([key,v]) => m[key] !== v)) throw new ValidationError('韌體版本、日期或 Release 標籤不一致');
  if (m.schemaVersion !== 1 || m.requestId !== saved.requestId || m.configSha !== saved.configSha ||
      m.sourceSha !== saved.sourceSha || m.sourceRepository !== saved.sourceRepository || m.target !== saved.config.target ||
      m.configDigest !== digest || m.runId !== run.id || m.runAttempt !== run.run_attempt || m.workflowSha !== run.head_sha ||
      m.definitionRepository !== saved.definitionRepository || m.definitionSha !== saved.definitionSha ||
      typeof m.toolchain !== 'string' || !m.toolchain.trim() || m.toolchain.length > 512) throw new ValidationError('Release 版本資訊與此次工作不一致');
  if (!Array.isArray(m.assets) || !m.assets.length || m.assets.length > 20) throw new ValidationError('Release 缺少資產資訊');
  const names = new Set<string>();
  for (const item of m.assets) {
    const a = object(item);
    if (typeof a.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(a.name) || names.has(a.name) || ['provenance.json', 'config.json'].includes(a.name) ||
        typeof a.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.size) || (a.size as number) <= 0) throw new ValidationError('無效的資產資訊');
    names.add(a.name);
  }
  return m as unknown as Provenance;
}
export function phaseForRun(run: { status: string; conclusion: string | null }, jobs: { name: string; status: string; conclusion: string | null }[]): Phase {
  if (run.status === 'completed') return run.conclusion === 'success' ? 'publishing' : run.conclusion === 'cancelled' ? 'cancelled' : 'failed';
  if (jobs.some(j => j.name === 'publish' && j.status === 'in_progress')) return 'publishing';
  if (jobs.some(j => j.name === 'build' && j.status === 'in_progress')) return 'building';
  if (jobs.some(j => j.name === 'validate' && j.status === 'in_progress')) return 'validating';
  return 'queued';
}
