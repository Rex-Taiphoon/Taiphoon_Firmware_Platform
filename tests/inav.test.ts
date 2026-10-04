import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parse} from 'yaml';
import {configFor,validateConfig} from '../shared/domain.ts';
import {defaultProfileId,targetFor} from '../shared/catalog.ts';
import {templateData} from '../server/templates-data.ts';
import {applySettings,plan} from '../scripts/adapter.ts';
import {verifyInav} from '../scripts/packages.ts';
import {Platform} from '../server/platform.ts';
import {FakeGitHub,env,ID} from './fixtures.ts';
import {createHandler} from '../server/handler.ts';
import {seal} from '../server/crypto.ts';

test('Pages 可經私人 API 取得 INAV 完整版本模板，未登入與跨平台版本被拒絕',async()=>{
  const handler=createHandler(env,async()=>Response.json({permissions:{push:true}})),profile=defaultProfileId('inav')!;
  const session=seal({actor:'Rex-Taiphoon',userToken:'FAKE_TOKEN',expires:Date.now()+60000},env.SESSION_KEY);
  const get=(version:string,token=session)=>handler(new Request(`${env.API_ORIGIN}/templates/inav?profile=${version}`,{headers:{Origin:env.PAGES_ORIGIN,Authorization:'Bearer '+token}}));
  const response=await get(profile);assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.profileId,profile);assert.deepEqual(data.files,templateData['inav-9.1.0-r2']);
  assert.equal((await get(profile,'invalid')).status,401);
  assert.equal((await get(defaultProfileId('px4')!)).status,422);
});

test('INAV 配置快照保存完整目錄並套用編輯，不修改官方其他板子',async()=>{
  const profile=defaultProfileId('inav'),t=targetFor('inav',profile),c=configFor('inav',profile);
  assert.equal(t.version,'9.1.0');assert.equal(t.repository,'iNavFlight/inav');
  c.files={...templateData[t.templateKey!],'target.h':templateData[t.templateKey!]['target.h'].replace('SERIALRX_CRSF','SERIALRX_SBUS')};
  validateConfig(c);
  const gh=new FakeGitHub();const p=new Platform({...env,GITHUB_WORKFLOW_REF:'platform-build-v2-12'},gh,'Rex-Taiphoon');
  const call=gh.call.bind(gh);gh.call=async<T=any>(path:string,method?:string,body?:any):Promise<T>=>path.includes('/git/ref/tags/')?{object:{type:'commit',sha:gh.run.head_sha}} as T:call<T>(path,method,body);
  const saved=await p.save(ID,c);assert.equal(saved.sourceSha,t.sourceSha);assert.equal(saved.config.files!['target.h'],c.files['target.h']);
  const dir=mkdtempSync(join(tmpdir(),'morakot-inav-'));
  try{
    mkdirSync(join(dir,'source'),{recursive:true});applySettings(c,join(dir,'source'),join(dir,'definition'));
    for(const [path,text]of Object.entries(c.files))assert.equal(readFileSync(join(dir,'source/src/main/target/MORAKOT',path),'utf8'),text);
  }finally{rmSync(dir,{recursive:true,force:true});}
  const commands=plan(c,'/definition');assert.ok(commands[1].args.includes('MORAKOT.bin'));assert.ok(commands[0].args.includes('-DCMAKE_BUILD_TYPE=Release'));
});

test('INAV 板級設定拒絕 CMake 指令、外部引用、錯誤 MCU／板名與任意版本',()=>{
  const c=configFor('inav',defaultProfileId('inav')),files=templateData['inav-9.1.0-r2'];
  for(const [path,text]of [
    ['CMakeLists.txt',files['CMakeLists.txt']+'execute_process(COMMAND bash -c id)'],
    ['CMakeLists.txt','target_stm32f405xg(MORAKOT HSE_MHZ 8)'],
    ['target.c',files['target.c']+'\n#include "/etc/passwd"'],
    ['target.h',files['target.h'].replace('"MKOT"','"OTHER"')],
    ['../../CMakeLists.txt','malicious'],
  ])assert.throws(()=>validateConfig({...c,files:{[path]:text}}));
  assert.throws(()=>validateConfig({...c,profileId:'inav-latest-arbitrary'}));
  assert.throws(()=>validateConfig({...c,options:{buildType:'Release; id'}}));
  assert.throws(()=>validateConfig(configFor('inav')),/韌體版本/);
});

test('INAV nine outputs agree with ArduPilot/PX4 pins, ADC selection and sensor power are explicit',()=>{
  const f=templateData['inav-9.1.0-r2'];
  const pins=['PE14','PE13','PE11','PA8','PA0','PB3','PB10','PA3','PB0'];
  const found=[...f['target.c'].matchAll(/DEF_TIM\(TIM\d, CH\d, (P[A-E]\d+),/g)].map(m=>m[1]);assert.deepEqual(found,pins);
  for(const pin of pins){assert.match(templateData['ardupilot-4.7.1']['hwdef.dat'],new RegExp('^'+pin+'\\s+TIM','m'));assert.ok(templateData['px4-1.18-rc1']['src/timer_config.cpp'].includes('GPIO::Port'+pin[1]+', GPIO::Pin'+pin.slice(2)));}
  assert.match(f['target.h'],/#define ADC_CHANNEL_1_PIN PC0/);assert.match(f['target.h'],/#define ADC_CHANNEL_2_PIN PC2/);
  assert.match(f['hardware_setup.c'],/IOHi\(DEFIO_IO\(PB2\)\)/);assert.match(f['target.h'],/CW90_DEG_FLIP/);
  assert.match(f['config.c'],/voltage.scale = 2100;/);
  const w=parse(readFileSync('.github/workflows/inav.yml','utf8'));assert.equal(w.env.EXPECTED_TARGET,'inav');assert.equal(w.jobs.build.permissions.contents,'read');assert.equal(w.jobs.publish.permissions.contents,'write');
});

function record(type:number,address:number,payload:Buffer){const b=Buffer.alloc(payload.length+5);b[0]=payload.length;b.writeUInt16BE(address,1);b[3]=type;payload.copy(b,4);b[b.length-1]=(-[...b].reduce((a,v)=>a+v,0))&255;return ':'+b.toString('hex');}
function asHex(b:Buffer){return [record(4,0,Buffer.from([8,0])),...Array.from({length:Math.ceil(b.length/16)},(_,i)=>record(0,i*16,b.subarray(i*16,i*16+16))),record(1,0,Buffer.alloc(0))].join('\n');}
test('INAV 套件驗證 HEX／BIN、Flash 起點、ARM 向量及內嵌版本與來源',()=>{
  const sha='a'.repeat(40),b=Buffer.alloc(128,0xff);b.writeUInt32LE(0x24080000,0);b.writeUInt32LE(0x08000009,4);b.write(['INAV','MORAKOT','9.1.0','aaaaaaaa'].join('\0'),32);
  assert.equal(verifyInav(Buffer.from(asHex(b)),b,sha,'9.1.0').flashAddress,'0x08000000');
  assert.throws(()=>verifyInav(Buffer.from(asHex(b).replace(':020000040800f2',':020000040802f0')),b,sha,'9.1.0'));
  assert.throws(()=>verifyInav(Buffer.from(asHex(b)+'\n:00000001ff'),b,sha,'9.1.0'));
  assert.throws(()=>verifyInav(Buffer.from(asHex(b)),b,'b'.repeat(40),'9.1.0'));
  assert.throws(()=>verifyInav(Buffer.from(asHex(b)),b,sha,'10.0.0'));
  const wrong=Buffer.from(b);wrong.writeUInt32LE(0x08020001,4);assert.throws(()=>verifyInav(Buffer.from(asHex(wrong)),wrong,sha,'9.1.0'));
  const edited=Buffer.from(b);edited[127]=0;assert.throws(()=>verifyInav(Buffer.from(asHex(b)),edited,sha,'9.1.0'));
  // INAV H743 has a reserved configuration sector: HEX omits it, objcopy BIN pads it with zero.
  const sparse=Buffer.alloc(288);b.copy(sparse);b.subarray(8).copy(sparse,168);
  const sparseHex=[record(4,0,Buffer.from([8,0])),record(0,0,sparse.subarray(0,128)),record(0,168,sparse.subarray(168)),record(1,0,Buffer.alloc(0))].join('\n');
  assert.equal(verifyInav(Buffer.from(sparseHex),sparse,sha,'9.1.0').imageSize,288);
  sparse[160]=1;assert.throws(()=>verifyInav(Buffer.from(sparseHex),sparse,sha,'9.1.0'));
});
