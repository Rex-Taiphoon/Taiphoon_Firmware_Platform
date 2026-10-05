import type { Target } from './catalog.ts';

export type Hardware = { id: string; name: string; revisions: { id: string; name: string; note?: string }[] };
export type HardwareIdentity = { id: string; revision: string };
export type ArduPilotBoard = {
  board: string;
  mcu: string;
  boardId: number;
  boardIdToken?: string;
  maxImageSize: number;
  // Exact protected lines from each reviewed hwdef (including flash layout).
  lockedHwdef: Record<string, string[]>;
  buildBootloader: boolean;
  outputs: Record<string, string>;
  binaryIdentity?: string;
  allowedIncludes?: Record<string, string[]>;
};

export const hardware: Hardware[] = [
  { id: 'morakot', name: 'Morakot', revisions: [
    { id: 'current', name: 'Morakot Ver.1' },
    { id: 'v2', name: 'Morakot Ver.2', note: '待提供板級定義' },
  ] },
  { id: 'morakot-esc', name: 'Morakot 4-in-1 ESC', revisions: [{ id: 'current', name: 'Morakot 4-in-1 ESC' }] },
  { id: 'narigps', name: 'NariGPS', revisions: [{ id: 'current', name: 'NariGPS Ver.1' }] },
  { id: 'herb-node', name: 'HerbNode', revisions: [{ id: 'current', name: 'HerbNode Ver.1' }] },
];

export function hardwareFor(target: Target): HardwareIdentity {
  const identity = target.hardware || { id: target.id === 'am32' ? 'morakot-esc' : 'morakot', revision: 'current' };
  if (!hardware.some(h => h.id === identity.id && h.revisions.some(r => r.id === identity.revision))) throw new Error('未登錄的硬體或硬體版本');
  return identity;
}
export function hardwareLabel(target: Target): string {
  const identity = hardwareFor(target), h = hardware.find(h => h.id === identity.id)!;
  const revision = h.revisions.find(r => r.id === identity.revision)!;
  if (revision.name.startsWith(h.name + ' ')) return revision.name;
  return h.name + (identity.revision === 'current' ? '' : ' ' + revision.name);
}
export function hardwareReleaseName(target: Target): string {
  // Historical ESC releases also used Morakot. Preserve their identity.
  if (!target.hardware) return 'Morakot';
  const identity = hardwareFor(target);
  return `${identity.id}${identity.revision === 'current' ? '' : '-' + identity.revision}`;
}
export function ardupilotBoard(target: Target): ArduPilotBoard {
  if (target.ardupilotBoard) {
    const b = target.ardupilotBoard;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(b.board) || !Number.isSafeInteger(b.boardId) || b.boardId <= 0 || !Number.isSafeInteger(b.maxImageSize) || b.maxImageSize <= 0 || b.maxImageSize > 16 * 1024 * 1024 || !/^STM32\w+ STM32\w+$/.test(b.mcu) || (b.boardIdToken && !/^AP_HW_[A-Za-z0-9_]+$/.test(b.boardIdToken)) || !Object.values(b.outputs).length || Object.values(b.outputs).some(name => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) || !b.lockedHwdef['hwdef.dat']?.length || !b.lockedHwdef['hwdef-bl.dat']?.length) throw new Error('無效的 ArduPilot 板級編譯設定');
    return b;
  }
  if (target.hardware) throw new Error('此硬體尚未登錄 ArduPilot 板級編譯設定');
  return { board: 'Morakot', mcu: 'STM32H7xx STM32H743xx', boardId: 1210, boardIdToken: 'AP_HW_Morakot', maxImageSize: 1703936, lockedHwdef: {}, buildBootloader: true, outputs: { copter: 'arducopter', plane: 'arduplane', rover: 'ardurover', sub: 'ardusub' } };
}
