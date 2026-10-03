import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {profiles,defaultProfileId,targetFor} from '../shared/catalog.ts';
import {configFor,canonicalConfig,releaseIdentity,validateConfig} from '../shared/domain.ts';
import {Platform} from '../server/platform.ts';
import {profileDigest} from '../server/build-profile.ts';
import {templateData} from '../server/templates-data.ts';
import {configurationChanges,releaseDescription} from '../scripts/release-notes.ts';
import {applySettings} from '../scripts/adapter.ts';
import {validateRunContext} from '../scripts/run-context.ts';
import {createHandler} from '../server/handler.ts';
import {seal} from '../server/crypto.ts';
import {FakeGitHub,env,ID,ID2,manifestFor} from './fixtures.ts';

function setup(){
  const gh=new FakeGitHub();gh.run.run_number=82;gh.run.created_at='2026-10-03T16:30:00Z';
  const call=gh.call.bind(gh);gh.call=async<T=any>(path:string,method?:string,body?:any):Promise<T>=>path.includes('/git/ref/tags/')?{object:{type:'commit',sha:gh.run.head_sha}} as T:call<T>(path,method,body);
  return {gh,p:new Platform({...env,GITHUB_WORKFLOW_REF:'platform-build-v2-1'},gh,'Rex-Taiphoon')};
}
test('新舊快照並存；新增版本不會破壞舊工作與 Release 下载',async()=>{
  const {gh,p}=setup();const old=new Platform(env,gh,'Rex-Taiphoon');const legacy=await old.save(ID,configFor('ardupilot'));await old.dispatch(ID);gh.publish(legacy);
  const prior=(await p.status(ID)).releaseUrl;
  const newer=await p.save(ID2,configFor('ardupilot',defaultProfileId('ardupilot')));
  assert.equal(newer.config.schemaVersion,2);assert.equal(newer.recipeSha,gh.run.head_sha);
  assert.equal((await p.saved(ID)).sourceSha,legacy.sourceSha);assert.equal((await p.status(ID)).releaseUrl,prior);
  await p.dispatch(ID2);assert.equal((await p.saved(ID2)).config.profileId,newer.config.profileId);
  assert.equal(gh.dispatchInputs.config_sha,newer.configSha);gh.publish(newer);
  assert.equal((await p.status(ID2)).phase,'success');assert.match((await p.status(ID2)).releaseUrl!,/ArduPilot4.6.3-Morakot-20261004-82$/);
});
test('新 API 僅建立具名版本工作；舊設定可恢復與冪等讀取，不能生成旧命名新 Release',async()=>{
  const {gh,p}=setup(),old=new Platform(env,gh,'Rex-Taiphoon');
  await old.save(ID,configFor('ardupilot'));
  assert.equal((await p.save(ID,configFor('ardupilot'))).config.schemaVersion,1);
  assert.equal((await p.saved(ID)).config.schemaVersion,1);
  await assert.rejects(p.save(ID2,configFor('ardupilot')),/選擇韌體版本/);
  await assert.rejects(p.dispatch(ID),/新版/);
});
test('重新命名歷史 Release 只改顯示標題，設定、provenance 與下載 tag 仍核對原工作',async()=>{
  const {gh,p}=setup(),saved=await p.save(ID,configFor('ardupilot',defaultProfileId('ardupilot')));
  await p.dispatch(ID);gh.publish(saved);gh.release.name='ArduPilot-4.6.3-Morakot-20261004-82';
  const status=await p.status(ID);
  assert.equal(status.phase,'success');assert.equal(status.releaseName,gh.release.name);
  assert.match(status.releaseUrl!,/ArduPilot4.6.3/);assert.match(status.assets![0].url!,/ArduPilot4.6.3/);
});
test('日期以真正的 Actions 建立時間及台灣時區決定，流水號和重跑各自識別',async()=>{
  const {p}=setup(),saved=await p.save(ID,configFor('ardupilot',defaultProfileId('ardupilot')));
  const run={run_number:82,created_at:'2026-10-03T16:30:00Z'};
  assert.equal(releaseIdentity(saved,71,1,run).releaseTag,'ArduPilot4.6.3-Morakot-20261004-82');
  assert.equal(releaseIdentity(saved,71,2,run).releaseTag,'ArduPilot4.6.3-Morakot-20261004-82-r2');
  assert.equal(releaseIdentity(saved,71,2,{...run,run_started_at:'2026-10-05T00:00:00Z'}).releaseTag,'ArduPilot4.6.3-Morakot-20261005-82-r2');
  assert.throws(()=>releaseIdentity(saved,71,1),/日期/);
});
test('所有平台的新 Release 命名遵循同一規範，PX4 與 AM32 都不帶 hash',async()=>{
  for(const id of ['ardupilot','px4','betaflight','am32'] as const){
    const {p}=setup(),saved=await p.save(ID,configFor(id,defaultProfileId(id)));
    saved.recipeRef='platform-build-v2-5';
    const identity=releaseIdentity(saved,71,1,{run_number:82,created_at:'2026-10-03T00:00:00Z'});
    assert.match(identity.releaseTag,/^[A-Za-z0-9]+-[0-9.]+(?:-beta\d+|-alpha)?-Morakot-20261003-82$/);
    assert.ok(!/[0-9a-f]{8,}/.test(identity.releaseTag.replace('20261003','')));
    if(id==='px4')assert.equal(identity.releaseTag,'PX4-1.18.0-beta1-Morakot-20261003-82');
    if(id==='am32')assert.equal(identity.releaseTag,'AM32-2.20-Morakot-20261003-82');
  }
});
test('編譯從已驗證的 run 快照取得時間，不需要把 API token 帶進工具鏈',()=>{
  const run={id:71,run_attempt:2,run_number:82,head_sha:'b'.repeat(40),created_at:'2026-10-03T00:00:00Z'};
  const expected={id:71,attempt:2,number:82,sha:'b'.repeat(40)};
  assert.deepEqual(validateRunContext(run,expected),run);
  for(const mismatch of [{id:72},{attempt:1},{number:83},{sha:'c'.repeat(40)}])assert.throws(()=>validateRunContext(run,{...expected,...mismatch}));
  assert.throws(()=>validateRunContext({...run,created_at:'bad'},expected));
});
test('來源、設定雜湊、流程 tag 或實際 workflow SHA 被替換時拒絕',async()=>{
  for(const field of ['sourceSha','profileDigest','recipeSha']){
    const {gh,p}=setup();await p.save(ID,configFor('ardupilot',defaultProfileId('ardupilot')));
    gh.files.get(`requests/${ID}.json`)!.value[field]='0'.repeat(field==='profileDigest'?64:40);
    await assert.rejects(p.dispatch(ID));
  }
  const {gh,p}=setup(),saved=await p.save(ID,configFor('ardupilot',defaultProfileId('ardupilot')));
  await p.dispatch(ID);gh.publish(saved);gh.run.head_sha='c'.repeat(40);
  assert.equal((await p.status(ID)).phase,'failed');
});
test('版本白名單按平台驗證，新版不再有獨立 OSD 選項',()=>{
  for(const id of ['ardupilot','px4','betaflight'] as const){const c=configFor(id,defaultProfileId(id));assert.ok(!('osd' in c.options));validateConfig(c);}
  const c=configFor('px4','px4-1.17.0-morakot-r1');assert.equal(targetFor(c.target,c.profileId).version,'1.17.0');
  assert.throws(()=>validateConfig({...c,profileId:'untrusted'}));
  assert.throws(()=>validateConfig({...c,target:'ardupilot'}));
  assert.throws(()=>validateConfig({...c,options:{...c.options,osd:false}}));
});
test('修改清單相對於選定版本模板，包含參數與檔案的實際增刪行',async()=>{
  const {p}=setup(),c=configFor('ardupilot',defaultProfileId('ardupilot'));c.options.scripting=false;
  c.files={...templateData.ardupilot,'defaults.parm':templateData.ardupilot['defaults.parm'].replace('OSD_TYPE2 5','OSD_TYPE2 0')};
  const saved=await p.save(ID,c),changes=configurationChanges(saved);
  assert.equal(changes.options[0].key,'scripting');assert.equal(changes.files[0].path,'defaults.parm');
  assert.ok(changes.files[0].removed.includes('OSD_TYPE2 5'));assert.ok(changes.files[0].added.includes('OSD_TYPE2 0'));
  const notes=releaseDescription(saved,manifestFor(saved,{id:71,run_attempt:1,head_sha:saved.recipeSha!,run_number:82,created_at:'2026-10-03T00:00:00Z'}),'owner/repo');
  assert.match(notes,/OSD_TYPE2 0/);assert.match(notes,/Lua/);assert.match(notes,/config.json/);
});
test('新版 ArduPilot 與 PX4 尊重配置檔 OSD，且設定 hash 綁定工具鏈和模板',()=>{
  const dir=mkdtempSync(join(tmpdir(),'morakot-version-'));try{
    for(const id of ['ardupilot','px4'] as const){
      const c=configFor(id,defaultProfileId(id)),t=targetFor(id,c.profileId);c.files={...templateData[t.templateKey!]};if(id==='px4')c.files['default.px4board']+='\nCONFIG_DRIVERS_OSD_ATXXXX=y\n';
      const source=join(dir,id);mkdirSync(source,{recursive:true});applySettings(c,source,join(dir,'definition'));
      if(id==='ardupilot')assert.equal(readFileSync(join(source,'platform-defaults.parm'),'utf8'),c.files['defaults.parm']);
      else assert.ok(readFileSync(join(source,'boards/morakot/v6/default.px4board'),'utf8').includes('CONFIG_DRIVERS_OSD_ATXXXX=y'));
      assert.notEqual(profileDigest(t),profileDigest({...t,image:'different'}));
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('私人模板端點按版本讀取，未知與跨平台版本被拒絕',async()=>{
  const session=seal({actor:'Rex-Taiphoon',userToken:'FAKE_TOKEN',expires:Date.now()+60000},env.SESSION_KEY);
  const handler=createHandler(env,async()=>Response.json({permissions:{push:true}}));
  const get=(profile:string)=>handler(new Request(env.API_ORIGIN+'/templates/px4?profile='+profile,{headers:{Origin:env.PAGES_ORIGIN,Authorization:'Bearer '+session}}));
  const response=await get('px4-1.17.0-morakot-r1');assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.templateRevision,targetFor('px4',body.profileId).templateRevision);
  assert.equal((await get('bad')).status,422);assert.equal((await get(defaultProfileId('ardupilot')!)).status,422);
});
