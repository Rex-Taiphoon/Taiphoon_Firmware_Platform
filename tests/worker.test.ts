import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { env } from './fixtures.ts';

test('Workers 實際 runtime 完成 OAuth、原生 fetch 與私人配置授權',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'taiphoon-worker-test-'));
  let runtime: Miniflare | undefined;
  try {
    const entry=join(dir,'worker.js');
    await build({entryPoints:['server/worker.ts'],outfile:entry,bundle:true,platform:'neutral',format:'esm',external:['node:crypto']});
    let exchanges=0, calls=0;
    runtime=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:entry,compatibilityDate:'2026-10-03',compatibilityFlags:['nodejs_compat'],bindings:env,
      outboundService: async (request: Request) => {
        const url=new URL(request.url);
        if (url.href==='https://github.com/login/oauth/access_token') { exchanges++;return Response.json({access_token:'FAKE_RUNTIME_TOKEN',expires_in:3600}); }
        assert.equal(url.origin,'https://api.github.com');
        assert.equal(request.headers.get('user-agent'),'Taiphoon-Firmware-Platform');
        assert.equal(request.headers.get('authorization'),'Bearer FAKE_RUNTIME_TOKEN');
        calls++;
        return url.pathname==='/user' ? Response.json({login:'Rex-Taiphoon'}) : Response.json({permissions:{push:true}});
      }
    }));
    const r=await runtime.dispatchFetch(env.API_ORIGIN+'/auth/login',{redirect:'manual'});
    assert.equal(r.status,302);
    assert.equal(new URL(r.headers.get('location')!).origin,'https://github.com');
    assert.match(r.headers.get('set-cookie')!,/HttpOnly; SameSite=Lax/);
    assert.equal((await runtime.dispatchFetch(env.API_ORIGIN+'/templates/px4')).status,403);
    assert.equal((await runtime.dispatchFetch(env.API_ORIGIN+'/session',{headers:{Origin:env.PAGES_ORIGIN}})).status,401);
    const state=new URL(r.headers.get('location')!).searchParams.get('state')!;
    const callback=await runtime.dispatchFetch(env.API_ORIGIN+'/auth/callback?state='+state+'&code=FAKE_CODE',{headers:{Cookie:'oauth_state='+state}});
    assert.equal(callback.status,200);
    const html=await callback.text();
    assert.ok(!html.includes('FAKE_RUNTIME_TOKEN'));
    const session=html.match(/"session":"([A-Za-z0-9_-]+)"/)![1];
    const templates=await runtime.dispatchFetch(env.API_ORIGIN+'/templates/px4',{headers:{Origin:env.PAGES_ORIGIN,Authorization:'Bearer '+session}});
    assert.equal(templates.status,200);
    assert.ok((await templates.json() as any).files['default.px4board'].includes('CONFIG_BOARD'));
    assert.equal(exchanges,1);assert.equal(calls,3);
  } finally { await runtime?.dispose();rmSync(dir,{recursive:true,force:true}); }
});
