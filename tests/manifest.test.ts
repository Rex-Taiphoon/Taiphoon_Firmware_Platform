import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHub } from '../server/github.ts';

test('大型配置快照可讀取；stream 大小不能藉由虛假 Content-Length 繞過', async () => {
  const payload = JSON.stringify({ text: 'a'.repeat(70000) });
  const gh = new GitHub('FAKE_TOKEN', async () => new Response(payload, { headers: { 'Content-Length': '1' } }));
  await assert.rejects(gh.manifest('owner/repo', 1), /too large/);
  assert.deepEqual(await gh.manifest('owner/repo', 1, 131072), JSON.parse(payload));
  const oversized = new GitHub('FAKE_TOKEN', async () => new Response(JSON.stringify({ text: 'a'.repeat(140000) })));
  await assert.rejects(oversized.manifest('owner/repo', 1, 131072), /too large/);
});
