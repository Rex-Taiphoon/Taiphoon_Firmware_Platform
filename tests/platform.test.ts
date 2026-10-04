import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '../server/platform.ts';
import { configFor } from '../shared/domain.ts';
import { ID, ID2, env, FakeGitHub } from './fixtures.ts';

test('保存 → 觸發 → 發布 → 下載：結果對應同一份設定與 run', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  const saved = await p.save(ID, configFor('ardupilot'));
  assert.equal((await p.status(ID)).phase, 'saved');
  assert.equal((await p.dispatch(ID)).phase, 'queued');
  gh.run.status = 'in_progress'; gh.jobs = [{ name: 'build', status: 'in_progress' }];
  assert.equal((await p.status(ID)).phase, 'building');
  gh.jobs = [{ name: 'publish', status: 'in_progress' }]; assert.equal((await p.status(ID)).phase, 'publishing');
  gh.publish(saved); const status = await p.status(ID);
  assert.equal(status.phase, 'success'); assert.equal(status.provenance?.configSha, saved.configSha);
  assert.ok(status.assets![0].url!.endsWith(`/releases/download/ardupilot-copter-4.6.3-${saved.createdAt.slice(0,10).replaceAll('-','')}-71-1/arducopter.apj`));
  assert.equal(gh.dispatchCount, 1);
});
test('重複保存與同時觸發不會覆寫設定或重複 dispatch', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  const first = await p.save(ID, configFor('ardupilot')), second = await p.save(ID, configFor('ardupilot'));
  assert.equal(first.configSha, second.configSha);
  await Promise.all([p.dispatch(ID), p.dispatch(ID)]); assert.equal(gh.dispatchCount, 1);
  await assert.rejects(p.save(ID, configFor('px4')), /其他設定/);
});
test('dispatch 受理後逾時，利用 request ID 找回而不重送', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon'); gh.timeoutAfterAccept = true;
  await p.save(ID, configFor('ardupilot')); assert.equal((await p.dispatch(ID)).phase, 'uncertain');
  assert.equal((await p.dispatch(ID)).phase, 'queued'); assert.equal(gh.dispatchCount, 1);
  assert.equal(gh.files.get(`dispatches/${ID}.json`)?.value.runId, 71);
});
test('明確被 GitHub 拒絕時可修正權限後重試', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  await p.save(ID, configFor('ardupilot')); gh.rejectDispatch = true;
  assert.equal((await p.dispatch(ID)).phase, 'failed'); gh.rejectDispatch = false;
  assert.equal((await p.dispatch(ID)).phase, 'queued'); assert.equal(gh.dispatchCount, 2);
});
test('並行工作的錯誤 Release 不提供下載', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  const saved = await p.save(ID, configFor('ardupilot')); await p.dispatch(ID); gh.publish(saved);
  gh.provenance.requestId = ID2; const status = await p.status(ID);
  assert.equal(status.phase, 'failed'); assert.equal(status.assets, undefined);
});
test('設定版本、source SHA、attempt、資產雜湊或缺少設定快照，都阻止下载', async () => {
  for (const corrupt of [
    (g: FakeGitHub) => { g.provenance.configSha = 'c'.repeat(40); },
    (g: FakeGitHub) => { g.provenance.sourceSha = 'c'.repeat(40); },
    (g: FakeGitHub) => { g.run.run_attempt = 2; },
    (g: FakeGitHub) => { g.release.assets[2].digest = `sha256:${'0'.repeat(64)}`; },
    (g: FakeGitHub) => { g.release.assets = g.release.assets.filter((a: any) => a.name !== 'config.json'); },
    (g: FakeGitHub) => { g.publishedConfig.options.vehicle = 'rover'; },
  ]) {
    const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
    const saved = await p.save(ID, configFor('ardupilot')); await p.dispatch(ID); gh.publish(saved); corrupt(gh);
    assert.equal((await p.status(ID)).phase, 'failed'); assert.equal((await p.status(ID)).assets, undefined);
  }
});
test('失敗、取消、draft 及未發布的工作無下載', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  const saved = await p.save(ID, configFor('ardupilot')); await p.dispatch(ID);
  gh.run.status = 'completed'; gh.run.conclusion = 'failure'; assert.equal((await p.status(ID)).phase, 'failed');
  gh.run.conclusion = 'cancelled'; assert.equal((await p.status(ID)).phase, 'cancelled');
  gh.run.conclusion = 'success'; assert.equal((await p.status(ID)).phase, 'failed');
  gh.publish(saved); gh.release.draft = true; assert.equal((await p.status(ID)).phase, 'failed');
});
test('使用者不能讀取其他人的工作，INAV 必須指定已登錄版本', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  await p.save(ID, configFor('ardupilot'));
  await assert.rejects(new Platform(env, gh, 'other-user').saved(ID), /其他使用者/);
  await assert.rejects(p.save(ID2, configFor('inav')), /韌體版本/);
});
test('快照來源或已觸發的設定被修改後不允許再次 dispatch', async () => {
  const gh = new FakeGitHub(), p = new Platform(env, gh, 'Rex-Taiphoon');
  await p.save(ID, configFor('ardupilot')); await p.dispatch(ID);
  const file = gh.files.get(`requests/${ID}.json`)!; file.commit = 'c'.repeat(40);
  await assert.rejects(p.dispatch(ID), /版本被變更/);
  file.value.sourceSha = '0'.repeat(40); await assert.rejects(p.saved(ID), /受控目標/);
});
