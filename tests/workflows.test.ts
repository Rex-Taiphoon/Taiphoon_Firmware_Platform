import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';

test('韌體 workflow 手動觸發，編譯 job 無發布權限與秘密', () => {
  const w = parse(readFileSync('.github/workflows/firmware.yml', 'utf8'));
  assert.deepEqual(Object.keys(w.on), ['workflow_dispatch']); assert.deepEqual(w.permissions, {});
  assert.equal(w.on.workflow_dispatch.inputs.publish_release.type, 'boolean');
  assert.equal(w.on.workflow_dispatch.inputs.publish_release.default, false);
  assert.equal(w.jobs.publish.if, 'inputs.publish_release');
  assert.equal(w.jobs.publish.steps.find((s: any) => s.run === 'node scripts/pipeline.ts publish').env.PUBLISH_RELEASE, '${{ inputs.publish_release }}');
  assert.deepEqual(w.jobs.build.permissions, { contents: 'read', actions: 'read' });
  assert.equal(w.jobs.publish.permissions.contents, 'write'); assert.deepEqual(w.jobs.publish.needs, ['validate', 'build']);
  assert.ok(!JSON.stringify(w.jobs.build).includes('secrets.'));
  assert.ok(w.jobs.build.steps.filter((s: any) => s.uses?.startsWith('actions/checkout')).every((s: any) => s.with['persist-credentials'] === false));
  assert.ok(w.jobs.publish.steps.filter((s: any) => s.uses?.startsWith('actions/checkout')).every((s: any) => !s.with.repository));
  for (const j of Object.values(w.jobs) as any[]) for (const step of j.steps) if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
});
test('只編譯模式拒絕直接執行 Release 發布脚本，不呼叫 GitHub', () => {
  const result = spawnSync(process.execPath, ['scripts/pipeline.ts', 'publish'], {
    env: { GITHUB_ACTIONS: 'true', PUBLISH_RELEASE: 'false' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未確認發布 Release/);
});
test('cache 僅轉交同次 run／attempt／SHA，沒有 fallback，發布比對可信 job 摘要',()=>{
  for(const file of ['firmware','ardupilot','px4','betaflight','inav']){
    const w=parse(readFileSync(`.github/workflows/${file}.yml`,'utf8'));
    const save=w.jobs.build.steps.find((s:any)=>s.uses?.startsWith('actions/cache/save'));
    const restore=w.jobs.publish.steps.find((s:any)=>s.uses?.startsWith('actions/cache/restore'));
    assert.equal(save.with.key,'firmware-transfer-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}');
    assert.equal(restore.with.key,save.with.key);assert.equal(restore.with['fail-on-cache-miss'],true);assert.equal(restore.with['restore-keys'],undefined);
    assert.equal(w.jobs.publish.steps.find((s:any)=>s.run==='node scripts/pipeline.ts publish').env.TRANSFER_HASH,'${{ needs.build.outputs.transfer_hash }}');
    assert.ok(!w.jobs.build.steps.find((s:any)=>s.run==='node scripts/pipeline.ts build').env?.GITHUB_TOKEN);
  }
});
test('Pages 只手動驗證前端建置，不上傳 artifact 或部署', () => {
  const w = parse(readFileSync('.github/workflows/pages.yml', 'utf8'));
  assert.deepEqual(Object.keys(w.on), ['workflow_dispatch']); assert.equal(w.on.workflow_dispatch.inputs.confirmed.default, false);
  assert.equal(w.jobs.build.if, 'inputs.confirmed');
  assert.ok(!w.jobs.build.steps.some((s: any) => s.uses?.startsWith('actions/upload-artifact')));
  assert.ok(w.jobs.build.steps.some((s: any) => s.run === 'pnpm build'));
  assert.ok(w.jobs.build.steps.some((s: any) => s.run === 'node scripts/audit-public.mjs'));
  assert.equal(w.jobs.deploy, undefined); assert.ok(!JSON.stringify(w.jobs.build).includes('secrets.'));
});
