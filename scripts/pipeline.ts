import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync, lstatSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { GitHub, GitHubError } from '../server/github.ts';
import { validateConfig, canonicalConfig, requestId, sha, verifyProvenance, type Snapshot, type SavedRequest, type Provenance } from '../shared/domain.ts';
import { targetFor } from '../shared/catalog.ts';
import { plan, applySettings } from './adapter.ts';
import { gitSafetyEnvironment } from './container.ts';

const mode = process.argv[2];
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('此腳本僅供經確認的 GitHub Actions 工作執行；本地請使用測試');
if (mode === 'publish' && process.env.PUBLISH_RELEASE !== 'true') throw new Error('未確認發布 Release；編譯驗證只保留 Actions artifact');
const id = requestId(process.env.REQUEST_ID), configSha = sha(process.env.CONFIG_SHA);
const repository = process.env.GITHUB_REPOSITORY!;
const source = resolve('work/source'), definition = resolve('work/definition');
const github = new GitHub(process.env.GITHUB_TOKEN || '');
function digest(path: string) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
async function snapshot(): Promise<SavedRequest> {
  const file = await github.call(`/repos/${repository}/contents/requests/${id}.json?ref=${configSha}`);
  if (file.encoding !== 'base64' || file.size > 32768) throw new Error('無效的設定快照');
  const s = JSON.parse(Buffer.from(file.content, 'base64').toString()) as Snapshot;
  const c = validateConfig(s.config), target = targetFor(c.target);
  if (!target.available || s.requestId !== id || s.sourceRepository !== target.repository || s.sourceSha !== target.sourceSha || s.definitionRepository !== target.definition?.repository || s.definitionSha !== target.definition?.sha) throw new Error('設定與受控來源不一致');
  return { ...s, config: c, configSha };
}
function run(executable: string, args: string[], cwd: string, capture = false): string {
  const result = spawnSync(executable, args, { cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', shell: false, timeout: 3300000 });
  if (result.error || result.status !== 0) throw new Error(`建置步驟失敗：${executable}`);
  return result.stdout || '';
}
function verifyCheckout(path: string, expected: string) { if (run('git', ['rev-parse', 'HEAD'], path, true).trim() !== expected) throw new Error('checkout 版本不符'); }

if (mode === 'prepare') {
  const s = await snapshot(); mkdirSync('work', { recursive: true }); writeFileSync('work/snapshot.json', JSON.stringify(s));
  const output = { source_repository: s.sourceRepository, source_sha: s.sourceSha, definition_repository: s.definitionRepository || s.sourceRepository, definition_sha: s.definitionSha || s.sourceSha };
  for (const [key, value] of Object.entries(output)) appendFileSync(process.env.GITHUB_OUTPUT!, `${key}=${value}\n`);
} else if (mode === 'build') {
  const s = JSON.parse(readFileSync('work/snapshot.json', 'utf8')) as SavedRequest;
  if (s.configSha !== configSha || s.requestId !== id) throw new Error('設定版本不一致');
  const c = validateConfig(s.config); const target = targetFor(c.target);
  if (s.sourceSha !== target.sourceSha || s.sourceRepository !== target.repository) throw new Error('非受控原始碼');
  verifyCheckout(source, s.sourceSha); if (s.definitionSha) verifyCheckout(definition, s.definitionSha);
  applySettings(c, source, definition);
  let toolchain = '';
  if (c.target === 'ardupilot') {
    const image = 'ardupilot/ardupilot-dev-chibios:v0.2.0';
    run('docker', ['pull', image], process.cwd());
    const imageDigest = run('docker', ['inspect', '--format={{index .RepoDigests 0}}', image], process.cwd(), true).trim();
    const imageEnvironment: string[] = JSON.parse(run('docker', ['inspect', '--format={{json .Config.Env}}', image], process.cwd(), true));
    const imagePath = imageEnvironment.find(value => value.startsWith('PATH='))?.slice(5) || '/usr/local/bin:/usr/bin:/bin';
    // Include recursively checked-out submodules; trusting /source alone does not cover ChibiOS.
    const submodules = run('git', ['submodule', 'foreach', '--quiet', '--recursive', 'pwd'], source, true).trim().split(/\r?\n/).filter(Boolean);
    const gitEnvironment = gitSafetyEnvironment(source, submodules).flatMap(value => ['-e', value]);
    // Preserve the official image's user, HOME and Python environment.
    const dockerArgs = ['run', '--rm', '-e', `PATH=/opt/gcc-arm-none-eabi-10/bin:${imagePath}`, ...gitEnvironment, '-v', `${source}:/source`, '-w', '/source', image];
    toolchain = run('docker', [...dockerArgs, 'arm-none-eabi-gcc', '--version'], process.cwd(), true).split('\n')[0] + `; ${imageDigest}`;
    for (const command of plan(c, '/definition')) run('docker', [...dockerArgs, command.executable, ...command.args], process.cwd());
  } else {
    for (const command of plan(c, definition)) run(command.executable, command.args, source);
    const compilers = readdirSync(source, { recursive: true }).map(String).filter(p => basename(p) === 'arm-none-eabi-gcc');
    const compiler = compilers.length ? join(source, compilers[0]) : 'arm-none-eabi-gcc';
    toolchain = run(compiler, ['--version'], source, true).split('\n')[0];
  }
  mkdirSync('output', { recursive: true });
  const directory = c.target === 'ardupilot' ? join(source, 'build/Morakot/bin') : c.target === 'px4' ? join(source, 'build/taiphoon_morakot_default') : c.target === 'betaflight' ? join(source, 'obj') : join(source, 'obj');
  const files = readdirSync(directory).filter(name => c.target === 'ardupilot' ? /\.(apj|bin)$/.test(name) : c.target === 'px4' ? name === 'taiphoon_morakot_default.px4' : c.target === 'betaflight' ? /MORAKOT.*\.(hex|bin)$/.test(name) : name.includes(`MORAKOT_4IN1_ESC_60A_${c.options.variant}_`) && /\.(hex|bin)$/.test(name));
  if (!files.length) throw new Error('編譯成功但找不到目標產物');
  for (const name of files) { if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(name) || !lstatSync(join(directory, name)).isFile()) throw new Error('無效產物'); copyFileSync(join(directory, name), join('output', name)); }
  const assets = files.map(name => ({ name, size: statSync(join('output', name)).size, sha256: digest(join('output', name)) }));
  const manifest: Provenance = { schemaVersion: 1, requestId: id, configSha, sourceRepository: s.sourceRepository, sourceSha: s.sourceSha,
    ...(s.definitionSha ? { definitionRepository: s.definitionRepository, definitionSha: s.definitionSha } : {}),
    configDigest: createHash('sha256').update(canonicalConfig(c)).digest('hex'), workflowSha: sha(process.env.GITHUB_SHA), runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), target: c.target, toolchain, assets };
  writeFileSync('output/config.json', canonicalConfig(c) + '\n'); writeFileSync('output/provenance.json', JSON.stringify(manifest, null, 2) + '\n');
} else if (mode === 'publish') {
  const s = await snapshot();
  const runInfo = await github.call(`/repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  const actualRun = { id: Number(process.env.GITHUB_RUN_ID), run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT), head_sha: sha(process.env.GITHUB_SHA) };
  if (runInfo.id !== actualRun.id || runInfo.run_attempt !== actualRun.run_attempt || runInfo.head_sha !== actualRun.head_sha || runInfo.display_title !== `Firmware ${id}`) throw new Error('工作版本不一致');
  const manifest = verifyProvenance(JSON.parse(readFileSync('output/provenance.json', 'utf8')), s, actualRun, createHash('sha256').update(canonicalConfig(s.config)).digest('hex'));
  if (canonicalConfig(JSON.parse(readFileSync('output/config.json', 'utf8'))) !== canonicalConfig(s.config)) throw new Error('設定快照不一致');
  const expected = [...manifest.assets.map(a => a.name), 'provenance.json', 'config.json'].sort();
  if (readdirSync('output').sort().join(',') !== expected.join(',')) throw new Error('產物包含未允許的檔案');
  for (const name of expected) if (!lstatSync(join('output', name)).isFile() || statSync(join('output', name)).size > 104857600) throw new Error('無效產物或大小超出限制');
  for (const asset of manifest.assets) if (digest(join('output', asset.name)) !== asset.sha256 || statSync(join('output', asset.name)).size !== asset.size) throw new Error('產物雜湊或大小不符');
  const tag = `build-${actualRun.id}-${actualRun.run_attempt}`;
  let existing: any; try { existing = await github.call(`/repos/${repository}/releases/tags/${tag}`); } catch (e) { if (!(e instanceof GitHubError && e.status === 404)) throw e; }
  if (existing) throw new Error('此 Release 已存在，不覆寫既有結果');
  const release = await github.call(`/repos/${repository}/releases`, 'POST', { tag_name: tag, target_commitish: actualRun.head_sha, name: `${targetFor(s.config.target).name} · ${id}`, draft: true, make_latest: 'false', body: `設定版本：${configSha}\n原始碼版本：${s.sourceRepository}@${s.sourceSha}\nActions：https://github.com/${repository}/actions/runs/${actualRun.id}\n完整版本與 SHA-256：provenance.json` });
  for (const name of expected) {
    const response = await fetch(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/octet-stream', 'X-GitHub-Api-Version': '2026-03-10' }, body: readFileSync(join('output', name)), signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`發布資產失敗（${response.status}）；保留 draft 供排查`);
  }
  await github.call(`/repos/${repository}/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'false' });
} else throw new Error('未知的流程階段');
