import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { targets, profilesFor, defaultProfileId, targetFor } from '../shared/catalog.ts';
import { hardwareFor, ardupilotBoard } from '../shared/hardware.ts';
import { configFor, validateConfig, releaseIdentity, verifyProvenance } from '../shared/domain.ts';
import { Platform } from '../server/platform.ts';
import { checkSnapshot } from '../server/build-profile.ts';
import { profileDigest } from '../server/build-profile.ts';
import { templateData } from '../server/templates-data.ts';
import { plan, applySettings } from '../scripts/adapter.ts';
import { verifyArduPilot } from '../scripts/packages.ts';
import { FakeGitHub, env, ID, savedFixture, manifestFor } from './fixtures.ts';

for (const id of ['narigps', 'herb-node']) {
  const identity = { id, revision: 'current' };
  test(`${id} 的 AP_Periph 配置、編譯命令與板級目錄相互隔離`, () => {
    const profile = defaultProfileId('ardupilot', identity)!;
    const t = targetFor('ardupilot', profile), board = ardupilotBoard(t);
    const c = configFor('ardupilot', profile); c.files = templateData[t.templateKey!];
    assert.deepEqual(hardwareFor(t), identity);
    assert.deepEqual(validateConfig(c), c);
    assert.deepEqual(c.options, { vehicle: 'AP_Periph' });
    assert.equal(defaultProfileId('px4', identity), undefined);
    assert.ok(profilesFor('ardupilot', identity).every(p => hardwareFor(p).id === id));
    assert.ok(plan(c, '/definition')[0].args.includes(board.board));
    assert.ok(!plan(c, '/definition')[0].args.some(a => a.startsWith('--default-parameters')));
    assert.deepEqual(plan(c, '/definition')[1].args, ['AP_Periph']);
    assert.throws(() => validateConfig({ ...c, options: { vehicle: 'copter' } }));
    const root = mkdtempSync(resolve('.research/hardware-test-'));
    try {
      applySettings(c, root, root);
      const dir = join(root, 'libraries/AP_HAL_ChibiOS/hwdef', board.board);
      assert.equal(readFileSync(join(dir, 'hwdef.dat'), 'utf8'), c.files['hwdef.dat']);
      assert.equal(readFileSync(join(dir, 'hwdef-bl.dat'), 'utf8'), c.files['hwdef-bl.dat']);
      assert.equal(readFileSync(join(root, 'platform-extra.dat'), 'utf8'), '');
      assert.ok(!existsSync(join(root, 'libraries/AP_HAL_ChibiOS/hwdef/Morakot')));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  test(`${id} 拒絕跨板配置、Flash 位址修改、覆寫識別與額外 include/env`, () => {
    const t = targetFor('ardupilot', defaultProfileId('ardupilot', identity));
    const c = configFor('ardupilot', t.profileId), files = templateData[t.templateKey!];
    const other = targetFor('ardupilot', defaultProfileId('ardupilot', { id: id === 'narigps' ? 'herb-node' : 'narigps', revision: 'current' }));
    assert.throws(() => validateConfig({ ...c, files: templateData[other.templateKey!] }));
    for (const change of [
      (s: string) => s.replace(/FLASH_RESERVE_START_KB \d+/, 'FLASH_RESERVE_START_KB 0'),
      (s: string) => s + '\nAPJ_BOARD_ID 12345\n',
      (s: string) => s + '\nFLASH_SIZE_KB 4096\n',
      (s: string) => s + '\ndefine CAN_APP_NODE_NAME "other"\n',
      (s: string) => s + '\ninclude /etc/passwd\n',
      (s: string) => s + '\nenv AP_PERIPH 0\n',
    ]) assert.throws(() => validateConfig({ ...c, files: { ...files, 'hwdef.dat': change(files['hwdef.dat']) } }));
    if (id === 'herb-node') assert.throws(() => validateConfig({ ...c, files: { ...files, 'hwdef-bl.dat': files['hwdef-bl.dat'].replace('include ../include/network_bootloader.inc', '') } }));
  });
  test(`${id} 的發布與 manifest 綁定硬體，APJ 核對節點識別`, () => {
    const t = targetFor('ardupilot', defaultProfileId('ardupilot', identity)), board = ardupilotBoard(t);
    const saved = { ...savedFixture(), config: configFor('ardupilot', t.profileId), sourceSha: t.sourceSha, sourceRepository: t.repository, profileDigest: profileDigest(t), recipeRef: 'platform-build-v2-14', recipeSha: 'b'.repeat(40) };
    assert.doesNotThrow(()=>checkSnapshot(saved));
    assert.throws(()=>checkSnapshot({...saved,recipeRef:'platform-build-v2-13'}));
    const run = { id: 71, run_attempt: 1, head_sha: saved.recipeSha, run_number: 82, created_at: '2026-10-05T00:00:00Z' };
    const manifest = manifestFor(saved, run);
    const release = releaseIdentity(saved, run.id, run.run_attempt, run);
    assert.ok('hardwareId' in release);
    assert.equal(release.hardwareId, id);
    assert.match(release.releaseTag, new RegExp(`-${id}-20261005-82$`));
    assert.doesNotThrow(() => verifyProvenance(manifest, saved, run, manifest.configDigest));
    assert.throws(() => verifyProvenance({ ...manifest, hardwareId: 'morakot' }, saved, run, manifest.configDigest));
    const binary = Buffer.from(`AP_Periph ${board.binaryIdentity}`);
    const apj = { magic: 'APJFWv1', board_id: board.boardId, git_identity: t.sourceSha.slice(0, 8), image: deflateSync(binary).toString('base64'), image_size: binary.length, image_maxsize: board.maxImageSize };
    assert.doesNotThrow(() => verifyArduPilot(Buffer.from(JSON.stringify(apj)), binary, t.sourceSha, board));
    assert.throws(() => verifyArduPilot(Buffer.from(JSON.stringify(apj)), binary, t.sourceSha));
    assert.throws(() => verifyArduPilot(Buffer.from(JSON.stringify(apj)), binary, t.sourceSha, { ...board, binaryIdentity: 'wrong node' }));
    assert.notEqual(profileDigest(t), profileDigest({ ...t, hardware: { id, revision: 'v2' } }));
  });
}

test('現有 Morakot／ESC 維持區分；Ver2 尚未接入不能建立工作', () => {
  const fc = { id: 'morakot', revision: 'current' }, esc = { id: 'morakot-esc', revision: 'current' };
  assert.equal(defaultProfileId('am32', fc), undefined);
  assert.ok(defaultProfileId('am32', esc));
  assert.equal(defaultProfileId('ardupilot', esc), undefined);
  for (const t of targets) assert.equal(defaultProfileId(t.id, { id: 'morakot', revision: 'v2' }), undefined);
  assert.throws(() => configFor('ardupilot', 'ardupilot-morakot-v2'));
});

test('新硬體不能送到舊流程；新流程保存正確板級快照並指定固定 recipe', async () => {
  const gh=new FakeGitHub(),call=gh.call.bind(gh);
  gh.call=async<T=any>(path:string,method?:string,body?:any):Promise<T>=>path.includes('/git/ref/tags/')?{object:{type:'commit',sha:gh.run.head_sha}} as T:call<T>(path,method,body);
  const t=targetFor('ardupilot',defaultProfileId('ardupilot',{id:'narigps',revision:'current'}));
  const c={...configFor('ardupilot',t.profileId),files:templateData[t.templateKey!]};
  await assert.rejects(new Platform({...env,GITHUB_WORKFLOW_REF:'platform-build-v2-13'},gh,'Rex-Taiphoon').save(ID,c),/新版多硬體/);
  assert.equal(gh.files.size,0);
  const platform=new Platform({...env,GITHUB_WORKFLOW_REF:'platform-build-v2-14'},gh,'Rex-Taiphoon');
  const saved=await platform.save(ID,c);
  assert.equal(saved.recipeRef,'platform-build-v2-14');
  assert.equal(saved.sourceSha,t.sourceSha);
  assert.equal(saved.profileDigest,profileDigest(t));
  assert.doesNotThrow(()=>checkSnapshot(saved));
  await platform.dispatch(ID);
  assert.equal(gh.dispatchInputs.config_sha,saved.configSha);
});
