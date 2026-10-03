import { targets, targetFor, displayVersion, type FirmwareId } from './catalog.ts';
import { validateFiles } from './file-policy.ts';
export type Config = {
  schemaVersion: 1 | 2;
  target: FirmwareId;
  profileId?: string;
  options: Record<string, string | boolean>;
  files?: Record<string, string>;
};
export function configFor(id: FirmwareId, profileId?: string): Config { return { schemaVersion: profileId ? 2 : 1, target: id, ...(profileId ? {profileId} : {}), options: Object.fromEntries(targetFor(id,profileId).fields.map(f => [f.key, f.default])) }; }
export const defaultConfig = configFor('ardupilot');
export type Snapshot = {
  requestId: string; actor: string; createdAt: string; sourceRepository: string;
  sourceSha: string; config: Config; definitionRepository?: string; definitionSha?: string;
  profileDigest?: string; recipeRef?: string; recipeSha?: string;
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
  profileId?: string; profileDigest?: string; recipeSha?: string; buildNumber?: number; buildStartedAt?: string;
  displayFirmwareVersion?: string;
};
export type BuildStatus = {
  phase: Phase; message?: string; runId?: number; runAttempt?: number;
  runUrl?: string; releaseUrl?: string; assets?: Asset[]; provenance?: Provenance;
  canRetryDispatch?: boolean; releaseName?: string;
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
  const c = object(value); keys(c, ['schemaVersion', 'target', 'options', ...(c.schemaVersion===2 ? ['profileId'] : []), ...(c.files !== undefined ? ['files'] : [])]);
  if (![1,2].includes(Number(c.schemaVersion)) || typeof c.schemaVersion !== 'number' || !targets.some(t=>t.id===c.target) || (c.schemaVersion===2 && typeof c.profileId!=='string')) throw new ValidationError('不支援的設定版本或編譯目標');
  let target;try{target=targetFor(c.target,c.schemaVersion===2 ? c.profileId as string : undefined);}catch{throw new ValidationError('不支援的編譯版本設定');}
  const o = object(c.options); keys(o, target.fields.map(f => f.key));
  const options: Config['options'] = {};
  for (const f of target.fields) {
    const v = o[f.key];
    if (f.kind === 'boolean' ? typeof v !== 'boolean' : !f.choices?.some(choice => choice.value === v)) throw new ValidationError(`${f.label}不在允許範圍`);
    options[f.key] = v as string | boolean;
  }
  let files: Record<string, string> | undefined;
  try { if (c.files !== undefined) files = validateFiles(target.id, c.files, target.profileId); } catch (e) { throw new ValidationError((e as Error).message); }
  const result: Config = { schemaVersion: c.schemaVersion as 1|2, target: target.id, ...(target.profileId ? {profileId:target.profileId} : {}), options, ...(files ? { files } : {}) };
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
export type RunIdentity = { id:number; run_attempt:number; head_sha:string; run_number?:number; created_at?:string;run_started_at?:string };
export function releaseIdentity(saved: Snapshot, runId: number, attempt: number, run?: Pick<RunIdentity,'run_number'|'created_at'|'run_started_at'>) {
  const t = targetFor(saved.config.target,saved.config.profileId), date = saved.createdAt.slice(0,10).replaceAll('-','');
  const variant = String(saved.config.options.vehicle || saved.config.options.variant || (saved.config.options.buildTarget==='bootloader'?'bootloader':'Morakot'));
  const firmwareVersion = t.vehicleVersions?.[variant] || t.version || t.sourceSha.slice(0,12);
  const version = firmwareVersion.replace(/[^A-Za-z0-9._-]/g,'-');
  if (saved.config.schemaVersion===2) {
    if (!run?.created_at || !Number.isSafeInteger(run.run_number) || run.run_number!<=0 || !Number.isFinite(Date.parse(run.created_at))) throw new ValidationError('新版工作缺少編譯日期或流水號');
    const started=run.run_started_at || run.created_at;
    if(!Number.isFinite(Date.parse(started)))throw new ValidationError('工作開始時間無效');
    const taiwanDate=new Date(Date.parse(started)+8*3600000).toISOString().slice(0,10);
    const oldNaming=['platform-build-v2-1','platform-build-v2-2','platform-build-v2-3'].includes(saved.recipeRef || '');
    const separated=!['platform-build-v2-1','platform-build-v2-2','platform-build-v2-3','platform-build-v2-4'].includes(saved.recipeRef || '');
    const readable=displayVersion(t,variant);
    return {firmwareVersion, variant, profileId:t.profileId, profileDigest:saved.profileDigest, recipeSha:saved.recipeSha,
      ...(!oldNaming ? {displayFirmwareVersion:readable} : {}),
      buildDate:taiwanDate, buildStartedAt:started, buildNumber:run.run_number,
      releaseTag:`${t.name}${separated?'-':''}${oldNaming?version:readable}-Morakot${variant==='bootloader'?'-Bootloader':''}-${taiwanDate.replaceAll('-','')}-${run.run_number}${attempt>1?'-r'+attempt:''}`};
  }
  return { firmwareVersion, buildDate: saved.createdAt.slice(0,10), variant,
    releaseTag: `${t.id}-${variant}-${version}-${date}-${runId}-${attempt}` };
}
export function verifyProvenance(p: unknown, saved: SavedRequest, run: RunIdentity, digest: string): Provenance {
  const m = object(p);
  const identity = releaseIdentity(saved,run.id,run.run_attempt,run);
  if(saved.config.schemaVersion===2 && run.head_sha!==saved.recipeSha)throw new ValidationError('工作流程版本不一致');
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
