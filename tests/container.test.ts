import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { gitSafetyEnvironment } from '../scripts/container.ts';

test('容器 Git 同時信任 ChibiOS 與巢狀子模組，但不放寬到其他 repository', () => {
  const checkout = resolve('work/source');
  const env = gitSafetyEnvironment(checkout, [join(checkout, 'modules/ChibiOS'), join(checkout, 'modules/mavlink/pymavlink')]);
  assert.ok(env.includes('GIT_CONFIG_COUNT=3'));
  assert.ok(env.includes('GIT_CONFIG_VALUE_1=/source/modules/ChibiOS'));
  assert.ok(env.includes('GIT_CONFIG_VALUE_2=/source/modules/mavlink/pymavlink'));
  assert.ok(!env.some(value => value.endsWith('=*')));
  assert.throws(() => gitSafetyEnvironment(checkout, [resolve('work/other')]), /checkout/);
});
