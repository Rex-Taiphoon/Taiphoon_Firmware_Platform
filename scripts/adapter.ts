import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig, type Config } from '../shared/domain.ts';

export type Command = { executable: string; args: string[] };
export function plan(value: unknown, definitionDir: string): Command[] {
  const c = validateConfig(value);
  switch (c.target) {
    case 'ardupilot': return [{ executable: './waf', args: ['configure', '--board', 'Morakot', '--default-parameters=platform-defaults.parm'] }, { executable: './waf', args: [String(c.options.vehicle)] }];
    case 'px4': return [{ executable: 'bash', args: ['Tools/setup/ubuntu.sh', '--no-sim-tools'] }, { executable: 'make', args: ['-j2', 'taiphoon_morakot_default'] }];
    case 'betaflight': return [{ executable: 'make', args: ['arm_sdk_install', `BETAFLIGHT_CONFIG=${definitionDir}`] }, { executable: 'make', args: ['-j2', 'fwo', 'CONFIG=MORAKOT', `BETAFLIGHT_CONFIG=${definitionDir}`] }];
    case 'am32': return [{ executable: 'make', args: ['arm_sdk_install'] }, { executable: 'make', args: ['-j2', `MORAKOT_4IN1_ESC_60A_${c.options.variant}`] }];
    case 'inav': throw new Error('INAV MORAKOT 定義尚未提供，不能編譯');
  }
}
export function setDefine(text: string, name: string, enabled: boolean): string {
  const pattern = new RegExp(`^[ \\t]*#define[ \\t]+${name}[ \\t]*(?://[^\\r\\n]*)?\\r?$`, 'gm');
  if (!pattern.test(text)) throw new Error(`找不到受控定義 ${name}`);
  return text.replace(pattern, enabled ? `#define ${name}` : `// platform: ${name} disabled`);
}
export function setPx4(text: string, name: string, enabled: boolean): string {
  const pattern = new RegExp(`^${name}=y\\r?$`, 'm');
  if (!pattern.test(text)) throw new Error(`找不到受控定義 ${name}`);
  return text.replace(pattern, enabled ? `${name}=y` : `# ${name} is not set`);
}
export function amendAm32(text: string, variant: string, enabled: boolean): string {
  const name = `MORAKOT_4IN1_ESC_60A_${variant}`;
  const pattern = new RegExp(`(#ifdef\\s+${name}\\s*\\n)([\\s\\S]*?)(^#endif)`, 'm');
  if (!pattern.test(text)) throw new Error('找不到 MORAKOT ESC 硬體版本');
  // This development branch preselects a different board at the top of targets.h.
  text = text.replace(/^[ \t]*#define[ \t]+AM32_ESC_G071[ \t]*\r?$/m, '// platform: board is selected by the Makefile target');
  return text.replace(pattern, (_, start, block, end) => start + setDefine(block, 'USE_SERIAL_TELEMETRY', enabled) + end);
}
export function applySettings(config: Config, source: string, definition: string): void {
  const c = validateConfig(config);
  if (c.target === 'ardupilot') {
    const original = readFileSync(join(source, 'libraries/AP_HAL_ChibiOS/hwdef/Morakot/defaults.parm'), 'utf8');
    if (!/^OSD_TYPE2\s+5\s*$/m.test(original)) throw new Error('ArduPilot 預設定義已變更，需要重新核對');
    writeFileSync(join(source, 'platform-defaults.parm'), original.replace(/^OSD_TYPE2\s+5\s*$/m, `OSD_TYPE2 ${c.options.osdType2}`));
  } else if (c.target === 'px4') {
    const path = join(source, 'boards/taiphoon/morakot/default.px4board');
    let text = readFileSync(path, 'utf8');
    text = setPx4(text, 'CONFIG_MODULES_UXRCE_DDS_CLIENT', Boolean(c.options.dds));
    text = setPx4(text, 'CONFIG_DRIVERS_OSD_MSP_OSD', Boolean(c.options.osd)); writeFileSync(path, text);
  } else if (c.target === 'betaflight') {
    const path = join(definition, 'configs/MORAKOT/config.h');
    let text = readFileSync(path, 'utf8'); text = setDefine(text, 'USE_GPS', Boolean(c.options.gps)); text = setDefine(text, 'USE_BEEPER', Boolean(c.options.beeper)); writeFileSync(path, text);
  } else if (c.target === 'am32') {
    const path = join(source, 'Inc/targets.h'); writeFileSync(path, amendAm32(readFileSync(path, 'utf8'), String(c.options.variant), Boolean(c.options.serialTelemetry)));
  } else throw new Error('INAV 尚未接入');
}
