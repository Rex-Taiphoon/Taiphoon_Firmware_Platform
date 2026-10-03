export type FirmwareId = 'ardupilot' | 'px4' | 'betaflight' | 'inav' | 'am32';
export type Field = { key: string; label: string; kind: 'boolean' | 'choice'; choices?: { value: string; label: string }[]; default: string | boolean };
export type Target = {
  id: FirmwareId; name: string; board: string; description: string; repository: string;
  ref: string; sourceSha: string; definitionPath: string; definition?: { repository: string; sha: string; path: string };
  available: boolean; note: string; fields: Field[];
};
export const targets: Target[] = [
  { id: 'ardupilot', name: 'ArduPilot', board: 'Morakot', description: 'Copter · Plane · Rover', repository: 'Rex-Taiphoon/ardupilot', ref: 'master', sourceSha: 'abc8df0d405dc2b39663e0c800bc729a0287bf53', definitionPath: 'libraries/AP_HAL_ChibiOS/hwdef/Morakot/hwdef.dat', available: true, note: '已核對 hwdef；雲端編譯待驗收', fields: [
    { key: 'vehicle', label: '載具韌體', kind: 'choice', default: 'copter', choices: [{ value: 'copter', label: 'Copter 多旋翼' }, { value: 'plane', label: 'Plane 固定翼' }, { value: 'rover', label: 'Rover 地面載具' }] },
    { key: 'osdType2', label: '第二組 OSD 預設值', kind: 'choice', default: '5', choices: [{ value: '5', label: 'MSP DisplayPort（原始定義）' }, { value: '0', label: '停用' }] },
  ] },
  { id: 'px4', name: 'PX4', board: 'taiphoon_morakot_default', description: 'NuttX · MORAKOT H743', repository: 'Rex-Taiphoon/PX4-Autopilot', ref: 'dev-morakot', sourceSha: '2883a8fb033410b1ca16240be288e1544b193bb0', definitionPath: 'boards/taiphoon/morakot/default.px4board', available: true, note: '已核對 board；雲端編譯待驗收', fields: [
    { key: 'dds', label: '包含 uXRCE-DDS 模組', kind: 'boolean', default: true },
    { key: 'osd', label: '包含 MSP OSD 驅動', kind: 'boolean', default: true },
  ] },
  { id: 'betaflight', name: 'Betaflight', board: 'MORAKOT / STM32H743', description: 'FPV · 獨立硬體設定', repository: 'Rex-Taiphoon/betaflight', ref: 'master', sourceSha: '0bf1f45b024222a0517bde53430a4edb36ed4ba1', definitionPath: 'configs/MORAKOT/config.h', definition: { repository: 'Rex-Taiphoon/config', sha: 'f1a20631ba16280ea9572223b99a37eceeb01751', path: 'configs/MORAKOT/config.h' }, available: true, note: '已核對外部 config；雲端編譯待驗收', fields: [
    { key: 'gps', label: '包含 GPS 功能', kind: 'boolean', default: true },
    { key: 'beeper', label: '包含蜂鳴器功能', kind: 'boolean', default: true },
  ] },
  { id: 'inav', name: 'INAV', board: 'MORAKOT · 待提供', description: '導航飛控 · 預留整合', repository: '', ref: '', sourceSha: '', definitionPath: '', available: false, note: '等待 repository 與 MORAKOT target 定義', fields: [] },
  { id: 'am32', name: 'AM32', board: 'Morakot 4-in-1 ESC', description: '60A · G071 / L431 CAN', repository: 'Rex-Taiphoon/AM32', ref: 'Morakot_4in1_ESC-dev', sourceSha: 'eec483e880bc9ac2429dafc71368f044dc018892', definitionPath: 'Inc/targets.h', available: true, note: '已核對兩種 ESC 定義；雲端編譯待驗收', fields: [
    { key: 'variant', label: 'ESC 硬體版本', kind: 'choice', default: 'G071', choices: [{ value: 'G071', label: 'MORAKOT 60A · G071' }, { value: 'L431_CAN', label: 'MORAKOT 60A · L431 CAN' }] },
    { key: 'serialTelemetry', label: '包含序列遙測', kind: 'boolean', default: true },
  ] },
];
export function targetFor(id: unknown): Target {
  const target = targets.find(t => t.id === id);
  if (!target) throw new Error('不支援的韌體目標');
  return target;
}
