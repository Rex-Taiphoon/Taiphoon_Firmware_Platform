import { createHash } from 'node:crypto';
import { configFor, canonicalConfig, releaseIdentity, type SavedRequest, type Provenance } from '../shared/domain.ts';
import { targetFor } from '../shared/catalog.ts';
import type { Environment } from '../server/github.ts';
import { GitHubError } from '../server/github.ts';

export const ID = '12345678-1234-4123-8123-123456789abc';
export const ID2 = '12345678-1234-4123-8123-123456789abd';
export const env: Environment = {
  PAGES_ORIGIN: 'https://rex-taiphoon.github.io', API_ORIGIN: 'https://api.example.com',
  GITHUB_OWNER: 'Rex-Taiphoon', GITHUB_REPO: 'Taiphoon_Firmware_Platform', GITHUB_CONFIG_BRANCH: 'main', GITHUB_WORKFLOW_REF: 'main', GITHUB_WORKFLOW_FILE: 'firmware.yml',
  GITHUB_APP_ID: '123', GITHUB_APP_CLIENT_ID: 'test-client', GITHUB_APP_CLIENT_SECRET: 'FAKE_CLIENT_SECRET', GITHUB_APP_INSTALLATION_ID: '123', GITHUB_APP_PRIVATE_KEY: '', SESSION_KEY: Buffer.alloc(32, 7).toString('base64url'),
};
export function savedFixture(): SavedRequest {
  const t = targetFor('ardupilot');
  return { requestId: ID, actor: 'Rex-Taiphoon', createdAt: '2026-10-03T00:00:00Z', config: configFor('ardupilot'), configSha: 'a'.repeat(40), sourceRepository: t.repository, sourceSha: t.sourceSha };
}
export function manifestFor(saved: SavedRequest, run = { id: 71, run_attempt: 1, head_sha: 'b'.repeat(40) }): Provenance {
  return { ...releaseIdentity(saved,run.id,run.run_attempt), schemaVersion: 1, requestId: saved.requestId, configSha: saved.configSha, sourceRepository: saved.sourceRepository, sourceSha: saved.sourceSha, definitionSha: saved.definitionSha, definitionRepository: saved.definitionRepository,
    configDigest: createHash('sha256').update(canonicalConfig(saved.config)).digest('hex'), workflowSha: run.head_sha, runId: run.id, runAttempt: run.run_attempt, target: saved.config.target, toolchain: 'Test compiler (MOCK ONLY)', assets: [{ name: 'arducopter.apj', sha256: 'f'.repeat(64), size: 100 }] };
}
export class FakeGitHub {
  files = new Map<string, { value: any; blob: string; commit: string }>(); counter = 1;
  dispatchCount = 0; timeoutAfterAccept = false; rejectDispatch = false;
  dispatchInputs: any;
  run: any = { id: 71, run_attempt: 1, head_sha: 'b'.repeat(40), display_title: `Firmware ${ID}`, path: '.github/workflows/ardupilot.yml', status: 'queued', conclusion: null };
  runs: any[] = []; jobs: any[] = []; release: any; provenance: any; publishedConfig: any;
  async call<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
    const url = new URL(path, 'https://api.github.com'); let result: any;
    const fileMatch = url.pathname.match(/\/contents\/(.+)$/);
    if (fileMatch) {
      const filePath = fileMatch[1]; const old = this.files.get(filePath);
      if (method === 'GET') { if (!old) throw new GitHubError(404); result = { encoding: 'base64', size: JSON.stringify(old.value).length, content: Buffer.from(JSON.stringify(old.value)).toString('base64'), sha: old.blob }; }
      else {
        if (old ? body.sha !== old.blob : Boolean(body.sha)) throw new GitHubError(409);
        if (old && !body.sha) throw new GitHubError(422);
        const next = { value: JSON.parse(Buffer.from(body.content, 'base64').toString()), blob: (this.counter++).toString(16).padStart(40, '0'), commit: (this.counter++).toString(16).padStart(40, '0') };
        this.files.set(filePath, next); result = { commit: { sha: next.commit }, content: { sha: next.blob } };
      }
    } else if (url.pathname.endsWith('/commits')) {
      const file = this.files.get(url.searchParams.get('path')!); result = file ? [{ sha: file.commit }] : [];
    } else if (url.pathname.endsWith('/dispatches')) {
      this.dispatchInputs = structuredClone(body.inputs);
      this.dispatchCount++; if (this.rejectDispatch) throw new GitHubError(403);
      this.run = { ...this.run, display_title: `Firmware ${body.inputs.request_id}` }; this.runs = [this.run];
      if (this.timeoutAfterAccept) throw new Error('Network timeout'); result = { workflow_run_id: this.run.id };
    } else if (/\/workflows\/[^/]+\/runs$/.test(url.pathname)) result = { workflow_runs: this.runs };
    else if (/\/runs\/\d+$/.test(url.pathname)) result = this.run;
    else if (url.pathname.endsWith('/jobs')) result = { jobs: this.jobs };
    else if (url.pathname.includes('/releases/tags/')) { if (!this.release) throw new GitHubError(404); result = this.release; }
    else throw new Error(`Unhandled mock route: ${method} ${path}`);
    return structuredClone(result) as T;
  }
  async manifest(_repository: string, id: number) { return structuredClone(id === 2 ? this.publishedConfig : this.provenance); }
  publish(saved: SavedRequest) {
    this.run.status = 'completed'; this.run.conclusion = 'success'; this.runs = [this.run];
    this.release = { draft: false, assets: [{ id: 1, name: 'provenance.json', size: 2000 }, { id: 2, name: 'config.json', size: 100 }, { id: 3, name: 'arducopter.apj', size: 100, digest: `sha256:${'f'.repeat(64)}` }] };
    this.provenance = manifestFor(saved, this.run);
    this.publishedConfig = structuredClone(saved.config);
  }
}
