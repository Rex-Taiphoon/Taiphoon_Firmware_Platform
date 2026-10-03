import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPx4Bootloader} from '../scripts/packages.ts';
import {plan} from '../scripts/adapter.ts';
import {configFor,releaseIdentity,validateConfig} from '../shared/domain.ts';
import {targetFor} from '../shared/catalog.ts';
import {templateData} from '../server/templates-data.ts';

function packagePair(){
  const binary=Buffer.alloc(128,0xff);binary.writeUInt32LE(0x24080000);binary.writeUInt32LE(0x08000009,4);
  const elf=Buffer.alloc(84+binary.length);Buffer.from('7f454c46010101','hex').copy(elf);
  elf.writeUInt16LE(2,16);elf.writeUInt16LE(40,18);elf.writeUInt32LE(52,28);elf.writeUInt16LE(32,42);elf.writeUInt16LE(1,44);
  elf.writeUInt32LE(1,52);elf.writeUInt32LE(84,56);elf.writeUInt32LE(0x08000000,64);elf.writeUInt32LE(binary.length,68);binary.copy(elf,84);
  return {binary,elf};
}
test('Bootloader BIN／ELF 核對內容、向量、MCU、Flash 起點與保留容量',()=>{
  const {binary,elf}=packagePair();assert.equal(verifyPx4Bootloader(binary,elf).flashAddress,'0x08000000');
  binary.writeUInt32LE(0x240032fc);binary.copy(elf,84);verifyPx4Bootloader(binary,elf);
  for(const corrupt of [()=>{binary[12]^=1;},()=>binary.writeUInt32LE(0x08020009,4),()=>elf.writeUInt32LE(0x08020000,64),()=>elf.writeUInt16LE(62,18)]){
    const pair=packagePair();pair.binary.copy(binary);pair.elf.copy(elf);corrupt();assert.throws(()=>verifyPx4Bootloader(binary,elf));
  }
  assert.throws(()=>verifyPx4Bootloader(Buffer.alloc(131073),packagePair().elf));
});
test('兩個 PX4 版本只接受受控 bootloader 目標，與主韌體有獨立名稱',()=>{
  for(const profile of ['px4-1.17.0-morakot-r2','px4-1.18.0-beta1-6-g186ad6d691-morakot-r2']){
    const config=configFor('px4',profile);config.options.buildTarget='bootloader';
    assert.equal(plan(config,'definition')[1].args[1],'morakot_v6_bootloader');
    assert.throws(()=>validateConfig({...config,options:{...config.options,buildTarget:'upload; bash'}}));
    const saved={config,recipeRef:'platform-build-v2-5',createdAt:'2026-10-03T00:00:00Z'} as any;
    assert.match(releaseIdentity(saved,71,1,{run_number:15,created_at:saved.createdAt}).releaseTag,/^PX4-.*-Morakot-Bootloader-20261003-15$/);
    config.options.buildTarget='firmware';assert.equal(plan(config,'definition')[1].args[1],'morakot_v6_default');
    assert.ok(!releaseIdentity(saved,71,1,{run_number:15,created_at:saved.createdAt}).releaseTag.includes('Bootloader'));
  }
});
test('舊工作標籤保留查詢相容性，4.7.0 模板與來源獨立保存',()=>{
  const config=configFor('px4','px4-1.17.0-morakot-r1');
  assert.equal(releaseIdentity({config,recipeRef:'platform-build-v2-4',createdAt:'2026-10-03'} as any,71,1,{run_number:13,created_at:'2026-10-03T00:00:00Z'}).releaseTag,'PX41.17.0-Morakot-20261003-13');
  const old=targetFor('ardupilot','ardupilot-4.6.3-morakot-r1'),next=targetFor('ardupilot','ardupilot-4.7.0-morakot-r1');
  assert.notEqual(old.sourceSha,next.sourceSha);assert.notEqual(old.templateKey,next.templateKey);
  assert.deepEqual(templateData[next.templateKey!],templateData[old.templateKey!]);
  assert.equal(next.repository,'ArduPilot/ardupilot');assert.equal(next.version,'4.7.0');
});
