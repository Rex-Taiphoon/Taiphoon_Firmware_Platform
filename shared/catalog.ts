import { boardFiles, templateRevisions } from './board-files.ts';
export type FirmwareId = 'ardupilot' | 'px4' | 'betaflight' | 'inav' | 'am32';
export type Field = { key: string; label: string; kind: 'boolean' | 'choice'; choices?: { value: string; label: string }[]; default: string | boolean };
export type Target = {
  id: FirmwareId; name: string; board: string; description: string; repository: string;
  ref: string; sourceSha: string; definitionPath: string; definition?: { repository: string; sha: string; path: string };
  available: boolean; note: string; fields: Field[];
  version?: string; vehicleVersions?: Record<string,string>; editableFiles?: string[]; workflow?: string;
  profileId?: string; templateKey?: string; templateRevision?: string; adapterRevision?: string;
  image?: string; upstreamTag?: string; upstreamTagSha?: string;
};
export const targets: Target[] = [
  { id: 'ardupilot', name: 'ArduPilot', board: 'Morakot', description: 'Copter / Plane / Rover 4.6.3 · Sub 4.6.0-dev', repository: 'Rex-Taiphoon/ardupilot', ref: '92b0cd78', sourceSha: '92b0cd788ec29406f26c6f9c31d5ceedbd1cc538', definitionPath: 'libraries/AP_HAL_ChibiOS/hwdef/Morakot/hwdef.dat', version: '4.6.3', vehicleVersions: {copter:'4.6.3',plane:'4.6.3',rover:'4.6.3',sub:'4.6.0-dev'}, workflow: 'ardupilot.yml', editableFiles: ['hwdef.dat', 'hwdef-bl.dat', 'defaults.parm'], available: true, note: '使用附件固定來源與 Morakot 配置；此來源的 Sub 版本為 4.6.0-dev', fields: [
    { key: 'vehicle', label: '載具韌體', kind: 'choice', default: 'copter', choices: [{ value: 'copter', label: 'Copter 多旋翼' }, { value: 'plane', label: 'Plane 固定翼' }, { value: 'rover', label: 'Rover 地面載具' }, { value: 'sub', label: 'Sub 水下載具' }] },
    { key: 'osd', label: '編譯 OSD（停用時移除 OSD 程式）', kind: 'boolean', default: true },
    { key: 'scripting', label: '包含 Lua 腳本支援', kind: 'boolean', default: true },
    { key: 'osdType2', label: '第二組 OSD 預設值', kind: 'choice', default: '5', choices: [{ value: '5', label: 'MSP DisplayPort（原始定義）' }, { value: '0', label: '停用' }] },
  ] },
  { id: 'px4', name: 'PX4', board: 'morakot_v6_default', description: '1.18.0-beta1 · MORAKOT v6', repository: 'Rex-Taiphoon/PX4-Autopilot', ref: '186ad6d691', sourceSha: '186ad6d6914456bdb39f196c3069e9bef995bc3a', definitionPath: 'boards/morakot/v6/default.px4board', version: '1.18.0-beta1-6-g186ad6d691', workflow: 'px4.yml', editableFiles: ['default.px4board', 'init/rc.board_defaults', 'init/rc.board_sensors'], available: true, note: '使用附件 Morakot v6；保留原 bootloader board ID 1105', fields: [
    { key: 'dds', label: '包含 uXRCE-DDS 模組（可能超出刷寫容量）', kind: 'boolean', default: false },
    { key: 'osd', label: '包含 ATXXXX OSD 驅動', kind: 'boolean', default: false },
    { key: 'buildType', label: '編譯模式', kind: 'choice', default: 'Release', choices: [{ value: 'Release', label: 'Release 最佳化' }, { value: 'Debug', label: 'Debug 除錯' }] },
    { key: 'lto', label: '連結最佳化 LTO（縮小韌體）', kind: 'boolean', default: true },
  ] },
  { id: 'betaflight', name: 'Betaflight', board: 'MORAKOT / STM32H743', description: '2026.12.0-alpha · MORAKOT', repository: 'betaflight/betaflight', ref: '2026-08-23', sourceSha: '1b53ace8356cc43f3c8359ed2357255ba789ca73', definitionPath: 'configs/MORAKOT/config.h', version: '2026.12.0-alpha', workflow: 'betaflight.yml', editableFiles: ['config.h'], available: true, note: '附件硬體 config；原 ZIP source SHA 未確認，使用相同版本的官方 2026-08-23 固定來源', fields: [
    { key: 'gps', label: '包含 GPS 功能', kind: 'boolean', default: true },
    { key: 'beeper', label: '包含蜂鳴器功能', kind: 'boolean', default: true },
    { key: 'osd', label: '包含 OSD 功能', kind: 'boolean', default: true },
    { key: 'blackbox', label: '包含 Blackbox', kind: 'boolean', default: true },
    { key: 'telemetry', label: '包含遙測', kind: 'boolean', default: true },
  ] },
  { id: 'inav', name: 'INAV', board: 'MORAKOT · 待提供', description: '導航飛控 · 預留整合', repository: '', ref: '', sourceSha: '', definitionPath: '', available: false, note: '等待 repository 與 MORAKOT target 定義', fields: [] },
  { id: 'am32', name: 'AM32', board: 'Morakot 4-in-1 ESC', description: '60A · G071 / L431 CAN', repository: 'Rex-Taiphoon/AM32', ref: 'Morakot_4in1_ESC-dev', sourceSha: 'eec483e880bc9ac2429dafc71368f044dc018892', definitionPath: 'Inc/targets.h', available: true, note: 'G071 已通過雲端編譯與 Release 驗證；L431 CAN 待驗收', fields: [
    { key: 'variant', label: 'ESC 硬體版本', kind: 'choice', default: 'G071', choices: [{ value: 'G071', label: 'MORAKOT 60A · G071' }, { value: 'L431_CAN', label: 'MORAKOT 60A · L431 CAN' }] },
    { key: 'serialTelemetry', label: '包含序列遙測', kind: 'boolean', default: true },
  ] },
];
for (const target of targets) if (boardFiles[target.id]) target.editableFiles = boardFiles[target.id];
// Legacy entries remain unchanged: schema-1 snapshots and Release tags depend on them.
export const profiles: Target[] = targets.filter(t=>t.available).map(t=>({
  ...t, profileId: `${t.id}-${t.version || 'dev-'+t.sourceSha.slice(0,12)}-morakot-r1`,
  templateKey: t.id, templateRevision: templateRevisions[t.id], adapterRevision: 'morakot-v2-r1',
  fields: t.fields.filter(f=>!['osd','osdType2'].includes(f.key)),
  ...(t.id==='ardupilot'?{image:'ardupilot/ardupilot-dev-chibios@sha256:8bb0f850fb3fe1c170cb12dd577ab64f3708be8a828f9eafd28d73559766e81f'}:{}),
  ...(t.id==='px4'?{image:'ghcr.io/px4/px4-dev@sha256:5e7ad18c75c3a5a655d5adfde4ab1eb216dd4bee7710941b6cd122f3969a7fed',upstreamTag:'v1.18.0-beta1',upstreamTagSha:'d90ac5b79200c44895c03ee7c284b20b80ecf75d'}:{}),
}));
const px4 = profiles.find(t=>t.id==='px4')!;
profiles.push({...px4, profileId:'px4-1.17.0-morakot-r1', repository:'PX4/PX4-Autopilot',
  sourceSha:'d6f12ad1c4f70ad3230afd7d86e971421e02fef4', ref:'v1.17.0', version:'1.17.0',
  description:'1.17.0 · Morakot', templateKey:'px4-1.17', templateRevision:templateRevisions['px4-1.17'],
  editableFiles:boardFiles['px4-1.17'], upstreamTag:'v1.17.0', upstreamTagSha:'a5eb12d2ab591251faa009f76b2685b8cc64405d',
  note:'官方 PX4 1.17.0 固定來源，搭配獨立 Morakot 配置；雲端編譯驗證不等同硬體驗收'});
export function profilesFor(id: FirmwareId): Target[] { return profiles.filter(t=>t.id===id); }
const am32=profiles.find(t=>t.id==='am32')!;
// The fixed source's Inc/version.h defines 2.20. Keep the former SHA-labelled profile for history.
am32.available=false;
profiles.push({...am32,profileId:'am32-2.20-morakot-r1',version:'2.20',available:true,description:'2.20 · Morakot 4-in-1 ESC'});
export function displayVersion(target: Target,variant?:string): string {
  return (target.vehicleVersions?.[variant || ''] || target.version || 'Development').replace(/-\d+-g[0-9a-f]+$/,'');
}
export function defaultProfileId(id: FirmwareId): string | undefined { return profilesFor(id).find(t=>t.available)?.profileId; }
export function targetFor(id: unknown, profileId?: string): Target {
  const target = profileId ? profiles.find(t=>t.id===id && t.profileId===profileId) : targets.find(t => t.id === id);
  if (!target) throw new Error('不支援的韌體目標');
  return target;
}
