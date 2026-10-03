import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileTree } from '../shared/file-tree.ts';
import { templateData } from '../server/templates-data.ts';
import { configFor } from '../shared/domain.ts';
import { applySettings } from '../scripts/adapter.ts';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('目錄樹保留所有巢狀路徑、資料夾先列且不重複',()=>{
  const paths=Object.keys(templateData.px4), roots=fileTree([...paths,paths[0]]), found:string[]=[];
  function walk(nodes:ReturnType<typeof fileTree>) {for(const n of nodes)n.children?walk(n.children):found.push(n.path);}
  walk(roots);assert.deepEqual(found.sort(),paths.sort());
  assert.equal(roots[0].name,'init');
  assert.ok(roots.find(n=>n.name==='nuttx-config')?.children?.find(n=>n.name==='scripts'));
});
test('新增目錄編輯確實套用到 PX4、Betaflight config.c 與 AM32 建置目錄',()=>{
  const dir=mkdtempSync(join(tmpdir(),'taiphoon-directory-test-'));
  try {
    const source=join(dir,'source'),definition=join(dir,'definition');mkdirSync(source,{recursive:true});
    const px4={...configFor('px4'),files:{...templateData.px4,'src/board_config.h':templateData.px4['src/board_config.h']+'\n#define MORAKOT_TEST_PIN 1\n','firmware.prototype':JSON.stringify({...JSON.parse(templateData.px4['firmware.prototype']),summary:'MY-MORAKOT'})}};
    applySettings(px4,source,definition);
    for(const [path,text]of Object.entries(px4.files)) if(path!=='default.px4board'&&path!=='firmware.prototype')assert.equal(readFileSync(join(source,'boards/morakot/v6',path),'utf8'),text,path);
    assert.equal(JSON.parse(readFileSync(join(source,'boards/morakot/v6/firmware.prototype'),'utf8')).summary,'MY-MORAKOT');
    mkdirSync(join(source,'src/main/target'),{recursive:true});writeFileSync(join(source,'src/main/target/common_pre.h'),'#define USE_TELEMETRY\n');writeFileSync(join(source,'src/main/target/common_post.h'),'');
    const configC=templateData.betaflight['config.c']+'\n// edited board pre-init\n';
    applySettings({...configFor('betaflight'),files:{...templateData.betaflight,'config.c':configC}},source,definition);
    assert.equal(readFileSync(join(definition,'configs/MORAKOT/config.c'),'utf8'),configC);
    mkdirSync(join(source,'Inc'),{recursive:true});
    applySettings({...configFor('am32'),files:{'Inc/targets.h':templateData.am32['Inc/targets.h']+'\n// edited Morakot definition\n'}},source,definition);
    assert.ok(readFileSync(join(source,'Inc/targets.h'),'utf8').includes('// edited Morakot definition'));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
