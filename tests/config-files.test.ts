import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateData } from '../server/templates-data.ts';
import { configFor, validateConfig, canonicalConfig, releaseIdentity } from '../shared/domain.ts';
import { savedFixture } from './fixtures.ts';

test('三平台提供的實際配置可以保存，修改會改變版本摘要',()=>{
  for (const id of ['ardupilot','px4','betaflight','am32'] as const) {
    const c = {...configFor(id),files:templateData[id]};
    assert.deepEqual(validateConfig(c).files,templateData[id]);
    assert.notEqual(canonicalConfig(c),canonicalConfig({...c,files:{...c.files,[Object.keys(c.files)[0]]:Object.values(c.files)[0]+'\n# comment\n'}}));
  }
});
test('完整板級目錄仍拒絕 CMake 執行、C 外部引用、Kconfig 路徑与 linker 外部輸入',()=>{
  for (const [path,suffix] of [
    ['src/CMakeLists.txt','\nexecute_process(COMMAND bash -c id)'],
    ['src/init.c','\n#include "/etc/passwd"'],
    ['src/init.c','\n#include HEADER_PATH'],
    ['src/init.c','\n#inc\\\nlude "/etc/passwd"'],
    ['nuttx-config/Kconfig','\nsource "/etc/private"'],
    ['nuttx-config/scripts/script.ld','\nINPUT(/etc/private)'],
    ['nuttx-config/nsh/defconfig','\nCONFIG_ARCH_OPTIMIZATION="-fplugin=/tmp/plugin.so"'],
  ]) assert.throws(()=>validateConfig({...configFor('px4'),files:{[path]:templateData.px4[path]+suffix}}),path);
  const prototype=JSON.parse(templateData.px4['firmware.prototype']);
  assert.throws(()=>validateConfig({...configFor('px4'),files:{'firmware.prototype':JSON.stringify({...prototype,image_maxsize:1966080})}}));
});
test('阻止 init shell、路徑穿越、工具鏈替換與 config.h 引用主機檔案',()=>{
  for (const [id,path,text] of [
    ['px4','init/rc.board_sensors','icm45686 start; curl evil'],
    ['px4','init/rc.board_defaults','param set X $(id)'],
    ['px4','default.px4board','CONFIG_BOARD_TOOLCHAIN="/tmp/compiler"'],
    ['ardupilot','hwdef.dat',templateData.ardupilot['hwdef.dat']+'\ninclude ../../file'],
    ['betaflight','config.h',templateData.betaflight['config.h']+'\n#include "/etc/passwd"'],
  ] as const) assert.throws(()=>validateConfig({...configFor(id),files:{[path]:text}}));
  assert.throws(()=>validateConfig({...configFor('px4'),files:{'../../workflow.yml':'x'}}));
});
test('Release 標籤同時區分平台、載具、版本、日期與重試',()=>{
  const s = savedFixture();
  assert.equal(releaseIdentity(s,71,1).releaseTag,'ardupilot-copter-4.6.3-20261003-71-1');
  assert.notEqual(releaseIdentity(s,71,1).releaseTag,releaseIdentity(s,71,2).releaseTag);
  assert.equal(releaseIdentity({...s,config:{...s.config,options:{...s.config.options,vehicle:'sub'}}},72,1).firmwareVersion,'4.6.0-dev');
});
