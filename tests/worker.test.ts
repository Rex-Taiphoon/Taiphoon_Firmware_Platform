import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { env } from './fixtures.ts';

test('Workers 實際 runtime 可以產生 OAuth state、拒絕未登入與非 Pages 來源',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'taiphoon-worker-test-'));
  let runtime: Miniflare | undefined;
  try {
    const entry=join(dir,'worker.js');
    await build({entryPoints:['server/worker.ts'],outfile:entry,bundle:true,platform:'neutral',format:'esm',external:['node:crypto']});
    runtime=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:entry,compatibilityDate:'2026-10-03',compatibilityFlags:['nodejs_compat'],bindings:env}));
    const r=await runtime.dispatchFetch(env.API_ORIGIN+'/auth/login',{redirect:'manual'});
    assert.equal(r.status,302);
    assert.equal(new URL(r.headers.get('location')!).origin,'https://github.com');
    assert.match(r.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
    assert.equal((await runtime.dispatchFetch(env.API_ORIGIN+'/templates/px4')).status,403);
    assert.equal((await runtime.dispatchFetch(env.API_ORIGIN+'/session',{headers:{Origin:env.PAGES_ORIGIN}})).status,401);
  } finally { await runtime?.dispose();rmSync(dir,{recursive:true,force:true}); }
});
