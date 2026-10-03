import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync, lstatSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { GitHub, GitHubError } from '../server/github.ts';
import { validateConfig, canonicalConfig, requestId, sha, verifyProvenance, releaseIdentity, type Snapshot, type SavedRequest, type Provenance } from '../shared/domain.ts';
import { targetFor } from '../shared/catalog.ts';
import { plan, applySettings } from './adapter.ts';
import { gitSafetyEnvironment } from './container.ts';
import { verifyPx4, verifyArduPilot, verifyPx4Bootloader } from './packages.ts';
import { checkSnapshot } from '../server/build-profile.ts';
import { releaseDescription, configurationChanges } from './release-notes.ts';
import {transferDigest} from './transfer.ts';
import {validateRunContext} from './run-context.ts';

const mode = process.argv[2];
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('此腳本僅供經確認的 GitHub Actions 工作執行；本地請使用測試');
if (mode === 'publish' && process.env.PUBLISH_RELEASE !== 'true') throw new Error('未確認發布 Release；編譯驗證只保留 Actions artifact');
const id = requestId(process.env.REQUEST_ID), configSha = sha(process.env.CONFIG_SHA);
const repository = process.env.GITHUB_REPOSITORY!;
const source = resolve('work/source'), definition = resolve('work/definition');
const github = new GitHub(process.env.GITHUB_TOKEN || '');
const expectedRun={id:Number(process.env.GITHUB_RUN_ID),attempt:Number(process.env.GITHUB_RUN_ATTEMPT),number:Number(process.env.GITHUB_RUN_NUMBER),sha:process.env.GITHUB_SHA!};
function digest(path: string) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
async function snapshot(): Promise<SavedRequest> {
  const file = await github.call(`/repos/${repository}/contents/requests/${id}.json?ref=${configSha}`);
  if (file.encoding !== 'base64' || file.size > 524288) throw new Error('無效的設定快照');
  const s = JSON.parse(Buffer.from(file.content, 'base64').toString()) as Snapshot;
  const c = validateConfig(s.config), target = targetFor(c.target,c.profileId);
  checkSnapshot(s);
  if(c.schemaVersion===2 && s.recipeSha!==process.env.GITHUB_SHA)throw new Error('Actions 編譯流程與快照版本不一致');
  if (process.env.EXPECTED_TARGET && c.target !== process.env.EXPECTED_TARGET) throw new Error('此工作流程不接受其他平台的設定');
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
  const context=validateRunContext(await github.call(`/repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`),expectedRun);
  writeFileSync('work/run.json',JSON.stringify(context));
  const output = { source_repository: s.sourceRepository, source_sha: s.sourceSha, definition_repository: s.definitionRepository || s.sourceRepository, definition_sha: s.definitionSha || s.sourceSha };
  for (const [key, value] of Object.entries(output)) appendFileSync(process.env.GITHUB_OUTPUT!, `${key}=${value}\n`);
} else if (mode === 'build') {
  const s = JSON.parse(readFileSync('work/snapshot.json', 'utf8')) as SavedRequest;
  if (s.configSha !== configSha || s.requestId !== id) throw new Error('設定版本不一致');
  checkSnapshot(s);
  if(s.config.schemaVersion===2 && s.recipeSha!==process.env.GITHUB_SHA)throw new Error('Actions 編譯流程與快照版本不一致');
  const c = validateConfig(s.config); const target = targetFor(c.target,c.profileId);
  if (s.sourceSha !== target.sourceSha || s.sourceRepository !== target.repository) throw new Error('非受控原始碼');
  verifyCheckout(source, s.sourceSha); if (s.definitionSha) verifyCheckout(definition, s.definitionSha);
  if(c.target==='am32' && target.version){
    const header=readFileSync(join(source,'Inc/version.h'),'utf8');
    const version=header.match(/^#define VERSION_MAJOR\s+(\d+)/m)?.[1]+'.'+header.match(/^#define VERSION_MINOR\s+(\d+)/m)?.[1];
    if(version!==target.version)throw new Error('AM32 固定來源版本定義不符');
  }
  if (c.target === 'px4') {
    // The Morakot fork does not publish the upstream release tags. Fetch only the
    // verified upstream tag; the firmware source remains the pinned Morakot SHA.
    const tag=target.upstreamTag || 'v1.18.0-beta1',tagSha=target.upstreamTagSha || 'd90ac5b79200c44895c03ee7c284b20b80ecf75d';
    run('git',['fetch','--depth=1','https://github.com/PX4/PX4-Autopilot.git',`refs/tags/${tag}:refs/tags/${tag}`],source);
    const described=run('git',['describe','--tags','--long','--abbrev=10','--match',tag,'HEAD'],source,true).trim();
    const expected=target.version==='1.17.0'?'v1.17.0-0-g'+target.sourceSha.slice(0,10):'v'+target.version;
    if (run('git',['rev-parse',`refs/tags/${tag}`],source,true).trim()!==tagSha || described!==expected)throw new Error('PX4 上游版本 tag 與來源歷史不一致');
  }
  applySettings(c, source, definition);
  let toolchain = '';
  if (c.target === 'ardupilot' || c.target === 'px4') {
    const image = target.image || (c.target === 'ardupilot' ? 'ardupilot/ardupilot-dev-chibios:v0.2.0' : 'ghcr.io/px4/px4-dev:v1.17.0-rc2');
    run('docker', ['pull', image], process.cwd());
    const imageDigest = run('docker', ['inspect', '--format={{index .RepoDigests 0}}', image], process.cwd(), true).trim();
    const imageEnvironment: string[] = JSON.parse(run('docker', ['inspect', '--format={{json .Config.Env}}', image], process.cwd(), true));
    const imagePath = imageEnvironment.find(value => value.startsWith('PATH='))?.slice(5) || '/usr/local/bin:/usr/bin:/bin';
    // Include recursively checked-out submodules; trusting /source alone does not cover ChibiOS.
    const submodules = run('git', ['submodule', 'foreach', '--quiet', '--recursive', 'pwd'], source, true).trim().split(/\r?\n/).filter(Boolean);
    const gitEnvironment = gitSafetyEnvironment(source, submodules).flatMap(value => ['-e', value]);
    // Preserve the official image's user, HOME and Python environment.
    const dockerArgs = ['run', '--rm', '-e', `PATH=${c.target === 'ardupilot' ? '/opt/gcc-arm-none-eabi-10/bin:' : ''}${imagePath}`, ...gitEnvironment, '-v', `${source}:/source`, '-w', '/source', image];
    const compilerOutput=run('docker', [...dockerArgs, 'arm-none-eabi-gcc', '--version'], process.cwd(), true);
    toolchain = (compilerOutput.split('\n').find(line=>line.includes('arm-none-eabi-gcc')) || compilerOutput.split('\n')[0]) + `; ${imageDigest}`;
    if (c.target === 'ardupilot') {
      for (const args of [['configure','--board','Morakot','--bootloader'],['bootloader']]) run('docker',[...dockerArgs,'./waf',...args],process.cwd());
      copyFileSync(join(source,'build/Morakot/bin/AP_Bootloader.bin'),join(source,'Tools/bootloaders/Morakot_bl.bin'));
    }
    for (const command of c.target === 'px4' ? plan(c,'/definition').slice(1) : plan(c, '/definition')) run('docker', [...dockerArgs, command.executable, ...command.args], process.cwd());
  } else {
    for (const command of plan(c, definition)) run(command.executable, command.args, source);
    const compilers = readdirSync(source, { recursive: true }).map(String).filter(p => basename(p) === 'arm-none-eabi-gcc');
    const compiler = compilers.length ? join(source, compilers[0]) : 'arm-none-eabi-gcc';
    toolchain = run(compiler, ['--version'], source, true).split('\n')[0];
  }
  mkdirSync('output', { recursive: true });
  const bootloader=c.target==='px4' && c.options.buildTarget==='bootloader';
  const directory = c.target === 'ardupilot' ? join(source, 'build/Morakot/bin') : c.target === 'px4' ? join(source, bootloader?'build/morakot_v6_bootloader':'build/morakot_v6_default') : join(source, 'obj');
  const files = readdirSync(directory).filter(name => c.target === 'ardupilot' ? [`ardu${c.options.vehicle}.apj`,`ardu${c.options.vehicle}.bin`].includes(name) : c.target === 'px4' ? (bootloader?['morakot_v6_bootloader.bin','morakot_v6_bootloader.elf'].includes(name):name === 'morakot_v6_default.px4') : c.target === 'betaflight' ? /MORAKOT.*\.(hex|bin)$/.test(name) : name.includes(`MORAKOT_4IN1_ESC_60A_${c.options.variant}_`) && /\.(hex|bin)$/.test(name));
  if (!files.length) throw new Error('編譯成功但找不到目標產物');
  if (bootloader) verifyPx4Bootloader(readFileSync(join(directory,'morakot_v6_bootloader.bin')),readFileSync(join(directory,'morakot_v6_bootloader.elf')));
  else if (c.target === 'px4') verifyPx4(readFileSync(join(directory,files[0])),s.sourceSha,target.version);
  if (c.target === 'ardupilot') verifyArduPilot(readFileSync(join(directory,`ardu${c.options.vehicle}.apj`)),readFileSync(join(directory,`ardu${c.options.vehicle}.bin`)),s.sourceSha);
  const buildRun=validateRunContext(JSON.parse(readFileSync('work/run.json','utf8')),expectedRun);
  const identity = releaseIdentity(s,Number(process.env.GITHUB_RUN_ID),Number(process.env.GITHUB_RUN_ATTEMPT),buildRun);
  const names = files.map(name => ({ original:name, renamed:`${identity.releaseTag}${name.slice(name.lastIndexOf('.'))}` }));
  for (const {original,renamed} of names) { if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(renamed) || !lstatSync(join(directory, original)).isFile()) throw new Error('無效產物'); copyFileSync(join(directory, original), join('output', renamed)); }
  const assets = names.map(({renamed:name}) => ({ name, size: statSync(join('output', name)).size, sha256: digest(join('output', name)) }));
  const manifest: Provenance = { schemaVersion: 1, requestId: id, configSha, sourceRepository: s.sourceRepository, sourceSha: s.sourceSha,
    ...(s.definitionSha ? { definitionRepository: s.definitionRepository, definitionSha: s.definitionSha } : {}),
    configDigest: createHash('sha256').update(canonicalConfig(c)).digest('hex'), workflowSha: sha(process.env.GITHUB_SHA), runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), target: c.target, toolchain, assets, ...identity };
  writeFileSync('output/changes.json',JSON.stringify(configurationChanges(s),null,2)+'\n');
  writeFileSync('output/config.json', canonicalConfig(c) + '\n'); writeFileSync('output/provenance.json', JSON.stringify(manifest, null, 2) + '\n');
  appendFileSync(process.env.GITHUB_OUTPUT!,`transfer_hash=${transferDigest()}\n`);
} else if (mode === 'publish') {
  if(!/^[0-9a-f]{64}$/.test(process.env.TRANSFER_HASH || '') || transferDigest()!==process.env.TRANSFER_HASH)throw new Error('同次編譯的產物轉交雜湊不符');
  const s = await snapshot();
  const runInfo = await github.call(`/repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  const actualRun = { id: Number(process.env.GITHUB_RUN_ID), run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT), head_sha: sha(process.env.GITHUB_SHA), run_number:runInfo.run_number, created_at:runInfo.created_at,run_started_at:runInfo.run_started_at };
  if (runInfo.id !== actualRun.id || runInfo.run_attempt !== actualRun.run_attempt || runInfo.head_sha !== actualRun.head_sha || runInfo.display_title !== `Firmware ${id}`) throw new Error('工作版本不一致');
  const manifest = verifyProvenance(JSON.parse(readFileSync('output/provenance.json', 'utf8')), s, actualRun, createHash('sha256').update(canonicalConfig(s.config)).digest('hex'));
  if (canonicalConfig(JSON.parse(readFileSync('output/config.json', 'utf8'))) !== canonicalConfig(s.config)) throw new Error('設定快照不一致');
  if(JSON.stringify(JSON.parse(readFileSync('output/changes.json','utf8')))!==JSON.stringify(configurationChanges(s)))throw new Error('修改摘要與配置不一致');
  const expected = [...manifest.assets.map(a => a.name), 'provenance.json', 'config.json', 'changes.json'].sort();
  if (readdirSync('output').sort().join(',') !== expected.join(',')) throw new Error('產物包含未允許的檔案');
  for (const name of expected) if (!lstatSync(join('output', name)).isFile() || statSync(join('output', name)).size > 104857600) throw new Error('無效產物或大小超出限制');
  for (const asset of manifest.assets) if (digest(join('output', asset.name)) !== asset.sha256 || statSync(join('output', asset.name)).size !== asset.size) throw new Error('產物雜湊或大小不符');
  if (s.config.target === 'px4') {
    if(s.config.options.buildTarget==='bootloader'){
      const bin=manifest.assets.find(a=>a.name.endsWith('.bin')),elf=manifest.assets.find(a=>a.name.endsWith('.elf'));
      if(manifest.assets.length!==2 || !bin || !elf)throw new Error('Bootloader 必須包含 BIN 與 ELF');
      verifyPx4Bootloader(readFileSync(join('output',bin.name)),readFileSync(join('output',elf.name)));
    }else for (const asset of manifest.assets) verifyPx4(readFileSync(join('output',asset.name)),s.sourceSha,targetFor('px4',s.config.profileId).version);
  }
  if (s.config.target === 'ardupilot') {
    const apj=manifest.assets.find(a=>a.name.endsWith('.apj')),bin=manifest.assets.find(a=>a.name.endsWith('.bin'));
    if(!apj||!bin)throw new Error('ArduPilot 缺少 APJ／BIN');
    verifyArduPilot(readFileSync(join('output',apj.name)),readFileSync(join('output',bin.name)),s.sourceSha);
  }
  const tag = releaseIdentity(s,actualRun.id,actualRun.run_attempt,actualRun).releaseTag;
  let existing: any; try { existing = await github.call(`/repos/${repository}/releases/tags/${tag}`); } catch (e) { if (!(e instanceof GitHubError && e.status === 404)) throw e; }
  if (existing) throw new Error('此 Release 已存在，不覆寫既有結果');
  const release = await github.call(`/repos/${repository}/releases`, 'POST', { tag_name: tag, target_commitish: actualRun.head_sha, name: s.config.schemaVersion===2?tag:`${targetFor(s.config.target).name} ${manifest.firmwareVersion} · ${manifest.variant} · ${manifest.buildDate}`, draft: true, make_latest: 'false', body:releaseDescription(s,manifest,repository) });
  for (const name of expected) {
    const response = await fetch(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/octet-stream', 'X-GitHub-Api-Version': '2026-03-10' }, body: readFileSync(join('output', name)), signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`發布資產失敗（${response.status}）；保留 draft 供排查`);
  }
  await github.call(`/repos/${repository}/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'false' });
} else throw new Error('未知的流程階段');
