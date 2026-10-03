import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateData } from '../server/templates-data.ts';
import { configFor, validateConfig, canonicalConfig, releaseIdentity } from '../shared/domain.ts';
import { savedFixture } from './fixtures.ts';

test('三平台提供的實際配置可以保存，修改會改變版本摘要',()=>{
  for (const id of ['ardupilot','px4','betaflight'] as const) {
    const c = {...configFor(id),files:templateData[id]};
    assert.deepEqual(validateConfig(c).files,templateData[id]);
    assert.notEqual(canonicalConfig(c),canonicalConfig({...c,files:{...c.files,[Object.keys(c.files)[0]]:Object.values(c.files)[0]+'\n# comment\n'}}));
  }
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
});
