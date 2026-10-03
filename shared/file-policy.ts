import { targetFor, type FirmwareId } from './catalog.ts';

export function validateFiles(target: FirmwareId, value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('配置檔案必須是物件');
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (!targetFor(target).editableFiles?.includes(path)) throw new Error(`不允許的配置檔案：${path}`);
    if (typeof content !== 'string' || content.length > 32768 || content.includes('\0')) throw new Error('配置檔案太大或無效');
    const text = content.replace(/\r\n/g, '\n');
    if (target === 'px4' && path.startsWith('init/')) {
      for (const line of text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))) {
        if (!/^(?:param (?:set|set-default) [A-Z0-9_]+ -?(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)|(?:board_adc|icm45686|bmp388|iis2mdc|qmc5883l|rm3100|atxxxx) [A-Za-z0-9 .-]+)$/.test(line) || !line.split(/\s+/).includes('start') && !line.startsWith('param ')) throw new Error('PX4 init 只允許參數設定與受控驅動的 start 指令');
      }
    } else if (target === 'px4') {
      for (const line of text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))) if (!/^CONFIG_[A-Z0-9_]+=(?:[yn]|-?\d+|0x[0-9A-Fa-f]+|"[A-Za-z0-9_./-]+")$/.test(line)) throw new Error('px4board 僅允許 Kconfig 設定');
      if (!text.includes('CONFIG_BOARD_TOOLCHAIN="arm-none-eabi"') || !text.includes('CONFIG_BOARD_ARCHITECTURE="cortex-m7"')) throw new Error('不能變更受控工具鏈或 MCU 架構');
    } else if (target === 'ardupilot') {
      for (const line of text.split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)) if (/^(?:include|env|ROMFS|ROMFS_WILDCARD)\b/.test(line) || /[$`;{}]|\.\./.test(line)) throw new Error('hwdef 不允許引用其他檔案、執行指令或修改編譯環境');
      if (path.startsWith('hwdef') && (!/^MCU STM32H7xx STM32H743xx$/m.test(text) || !/^APJ_BOARD_ID (?:AP_HW_Morakot|1210)$/m.test(text))) throw new Error('必須保留 Morakot MCU 與 board ID');
      if (path === 'defaults.parm') for (const line of text.split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)) if (!/^[A-Z][A-Z0-9_]+\s+-?\d+(?:\.\d+)?$/.test(line)) throw new Error('預設參數必須使用名稱與數值');
    } else if (target === 'betaflight') {
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      if (/[$`;{}]|#\s*(?:include|line|embed)\b/.test(stripped) || /__has_include|_Pragma/.test(stripped)) throw new Error('config.h 只允許硬體定義與 C 前處理設定');
      if (!/#define\s+FC_TARGET_MCU\s+STM32H743\b/.test(text) || !/#define\s+BOARD_NAME\s+MORAKOT\b/.test(text)) throw new Error('必須保留 MORAKOT MCU 與板名');
    }
    files[path] = text;
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
