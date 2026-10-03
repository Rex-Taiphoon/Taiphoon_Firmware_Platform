import { targetFor } from '../shared/catalog.ts';
import { readFileSync, writeFileSync, mkdirSync, cpSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConfig, type Config } from '../shared/domain.ts';

export type Command = { executable: string; args: string[] };
export function plan(value: unknown, definitionDir: string): Command[] {
  const c = validateConfig(value);
  switch (c.target) {
    case 'ardupilot': return [{ executable: './waf', args: ['configure', '--board', 'Morakot', '--default-parameters=platform-defaults.parm', '--extra-hwdef=platform-extra.dat'] }, { executable: './waf', args: [String(c.options.vehicle)] }];
    case 'px4': return [{ executable: 'bash', args: ['Tools/setup/ubuntu.sh', '--no-sim-tools'] }, { executable: 'make', args: ['-j2', 'morakot_v6_default', `PX4_CMAKE_BUILD_TYPE=${c.options.buildType === 'Release' ? 'MinSizeRel' : 'Debug'}`] }];
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
  const c = validateConfig(config), t = targetFor(c.target,c.profileId), template = 'templates/'+(t.templateKey || c.target);
  if (c.target === 'ardupilot') {
    const dir = join(source, 'libraries/AP_HAL_ChibiOS/hwdef/Morakot');
    mkdirSync(dir, { recursive: true });
    for (const name of ['hwdef.dat','hwdef-bl.dat','defaults.parm']) {
      let text = c.files?.[name] ?? readFileSync(join(template,name),'utf8');
      text = text.replace(/^APJ_BOARD_ID AP_HW_Morakot$/m, 'APJ_BOARD_ID 1210');
      writeFileSync(join(dir,name),text);
    }
    if(c.schemaVersion===1){
    const original = readFileSync(join(dir, 'defaults.parm'),'utf8').replace(/^OSD_TYPE2\s+[^\n]*$/gm,'');
    writeFileSync(join(source, 'platform-defaults.parm'), original + `\nOSD_TYPE2 ${c.options.osd ? c.options.osdType2 : '0'}\n`);
    writeFileSync(join(source, 'platform-extra.dat'), `define OSD_ENABLED ${c.options.osd ? 1 : 0}\n${c.options.osd ? '' : 'define HAL_WITH_MSP_DISPLAYPORT 0\ndefine HAL_WITH_OSD_BITMAP 0\ndefine OSD_PARAM_ENABLED 0\n'}define AP_SCRIPTING_ENABLED ${c.options.scripting ? 1 : 0}\n`);
    }else{
      copyFileSync(join(dir,'defaults.parm'),join(source,'platform-defaults.parm'));
      writeFileSync(join(source,'platform-extra.dat'),`define AP_SCRIPTING_ENABLED ${c.options.scripting ? 1 : 0}\n`);
    }
  } else if (c.target === 'px4') {
    const dir = join(source,'boards/morakot/v6');
    cpSync(template,dir,{recursive:true});
    for (const [name,text] of Object.entries(c.files ?? {})) writeFileSync(join(dir,name),text);
    const prototype = JSON.parse(readFileSync(join(dir,'firmware.prototype'),'utf8'));
    if (!c.files?.['firmware.prototype']) { prototype.description = 'Taiphoon Morakot v6 firmware (bootloader board ID 1105)'; prototype.summary = 'MORAKOT-V6'; }
    writeFileSync(join(dir,'firmware.prototype'),JSON.stringify(prototype,null,2));
    const path = join(dir, 'default.px4board');
    let text = readFileSync(path, 'utf8');
    for (const [name,enabled] of [['CONFIG_MODULES_UXRCE_DDS_CLIENT',c.options.dds],['CONFIG_DRIVERS_OSD_ATXXXX',c.options.osd],['CONFIG_BOARD_LTO',c.options.lto]] as const) {
      if(c.schemaVersion===2 && name==='CONFIG_DRIVERS_OSD_ATXXXX')continue;
      text = text.replace(new RegExp(`^(?:${name}=.*|# ${name} is not set)\\r?\\n?`,'gm'),'');
      text += `\n${enabled ? name+'=y' : '# '+name+' is not set'}\n`;
    }
    writeFileSync(path, text);
  } else if (c.target === 'betaflight') {
    mkdirSync(join(definition,'configs/MORAKOT'),{recursive:true});
    cpSync(template,join(definition,'configs/MORAKOT'),{recursive:true});
    for (const [name,text] of Object.entries(c.files ?? {})) writeFileSync(join(definition,'configs/MORAKOT',name),text);
    const path = join(definition, 'configs/MORAKOT/config.h');
    writeFileSync(path,c.files?.['config.h'] ?? readFileSync(path,'utf8'));
    const groups: Record<string,string[]> = {
      gps:['USE_GPS','USE_CMS_GPS'], beeper:['USE_BEEPER'], osd:['USE_OSD','USE_MAX7456','USE_FRSKYOSD'],
      blackbox:['USE_BLACKBOX','USE_USB_MSC'],
      telemetry:['USE_TELEMETRY','USE_MSP_OVER_TELEMETRY','USE_SERIALRX_FPORT','USE_SERIALRX_JETIEXBUS','USE_SERIALRX_MAVLINK','USE_CRSF_V3','USE_CRSF_CMS_TELEMETRY','USE_CRSF_ACCGYRO_TELEMETRY'],
    };
    const post = join(source,'src/main/target/common_post.h');
    let text = readFileSync(post,'utf8');
    const headers = ['src/main/target/common_pre.h','src/main/target/common_post.h'].map(p=>readFileSync(join(source,p),'utf8')).join('\n')+readFileSync(path,'utf8');
    const macros = [...new Set(headers.match(/\b(?:USE|ENABLE)_[A-Z0-9_]+\b/g) ?? [])];
    for (const [key,prefixes] of Object.entries(groups)) if (!(c.schemaVersion===2 && key==='osd') && !c.options[key]) for (const macro of macros.filter(m=>prefixes.some(p=>m===p||m.startsWith(p+'_')||m===p.replace('USE_','ENABLE_')||m.startsWith(p.replace('USE_','ENABLE_')+'_')))) text += `\n#undef ${macro}\n${macro.startsWith('ENABLE_') ? '#define '+macro+' 0\n' : ''}`;
    // beeper.c supplies NONE itself when the feature is absent. A board pin
    // retained from config.h would conflict with that upstream fallback.
    if (!c.options.beeper) text += '\n#undef BEEPER_PIN\n';
    writeFileSync(post,text);
  } else if (c.target === 'am32') {
    const path = join(source, 'Inc/targets.h'); writeFileSync(path, amendAm32(c.files?.['Inc/targets.h'] ?? readFileSync(path, 'utf8'), String(c.options.variant), Boolean(c.options.serialTelemetry)));
  } else throw new Error('INAV 尚未接入');
}
