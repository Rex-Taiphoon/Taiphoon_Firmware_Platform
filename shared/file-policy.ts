import { targetFor, type FirmwareId } from './catalog.ts';
import { allowedHeaders, lockedPx4Config, boardFiles } from './board-files.ts';

function withoutComments(text: string): string { return text.replace(/\\\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }
function validateC(target: FirmwareId, text: string) {
  const stripped = withoutComments(text);
  if (/#\s*(?:line|embed|include_next)\b|__has_include|_Pragma|\b(?:asm|__asm|__asm__)\b|\.incbin/.test(stripped)) throw new Error('C 配置不可引用主機檔案、嵌入資料或插入組合語言');
  for (const line of stripped.split('\n')) {
    if (/^\s*#\s*include\b/.test(line)) {
      const header = line.match(/^\s*#\s*include\s*[<"]([^>"\n]+)[>"]\s*$/)?.[1];
      if (!header || !allowedHeaders[target]?.includes(header)) throw new Error('僅允許此平台既有的受控 header 引用');
    }
    if (/^\s*#\s*pragma\b/.test(line) && !/^\s*#\s*pragma\s+once\s*$/.test(line)) throw new Error('僅允許 pragma once');
  }
}
function validateCmake(text: string) {
  const code=text.replace(/#[^\n]*/g,'');
  const sourceNames=boardFiles.px4.filter(p=>/^src\/.*\.(c|cpp)$/.test(p)).map(p=>p.slice(4));
  const libraries=['arch_io_pins','arch_spi','arch_board_hw_info','drivers__led','nuttx_arch','nuttx_drivers','px4_layer','bootloader'];
  const pattern=/([a-z_]+)\s*\(([^()]*)\)/g;
  for (const m of code.matchAll(pattern)) {
    const args=m[2].trim().split(/\s+/).filter(Boolean);let valid=false;
    if (m[1]==='if') valid=/^"\$\{PX4_BOARD_LABEL\}"\s+STREQUAL\s+"bootloader"$/.test(m[2].trim());
    if (['else','endif'].includes(m[1])) valid=args.length===0;
    if (m[1]==='add_library') valid=args[0]==='drivers_board'&&args.length>1&&args.slice(1).every(a=>sourceNames.includes(a));
    if (m[1]==='add_compile_definitions') valid=args.length>0&&args.every(a=>/^[A-Z][A-Z0-9_]*(?:=-?\d+)?$/.test(a));
    if (m[1]==='target_link_libraries') valid=args[0]==='drivers_board'&&args[1]==='PRIVATE'&&args.slice(2).every(a=>libraries.includes(a));
    if (m[1]==='add_dependencies') valid=args.join(' ')==='drivers_board arch_board_hw_info';
    if (m[1]==='target_include_directories') valid=args.join(' ')==='drivers_board PRIVATE ${PX4_SOURCE_DIR}/platforms/nuttx/src/bootloader/common';
    if (!valid) throw new Error('CMake 僅允許既有 board 建置結構、來源清單與數值定義，不能執行命令');
  }
  if (code.replace(pattern,'').trim()) throw new Error('不允許的 CMake 語法');
}
function validateKconfigValues(path: string, text: string) {
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  const names=new Set<string>();
  for (const line of lines) {
    if (!/^CONFIG_[A-Z0-9_]+=(?:[yn]|-?\d+|0x[0-9A-Fa-f]+|"[A-Za-z0-9_./ -]*")$/.test(line)) throw new Error('僅允許 Kconfig 名稱與受控設定值');
    const name=line.split('=')[0];if(names.has(name))throw new Error('Kconfig 設定不能重複');names.add(name);
    if (/^CONFIG_.*(?:FLAGS|TOOLCHAIN|ARCHITECTURE|LINKER_SCRIPT|ROMFSROOT|CUSTOM_DIR)/.test(name)&&!lockedPx4Config[path]?.includes(line)) throw new Error('不能變更建置工具、編譯環境或來源路徑');
    if(line.includes('..')&&!lockedPx4Config[path]?.includes(line))throw new Error('Kconfig 不允許引用目錄外的路徑');
  }
  for(const locked of lockedPx4Config[path]??[])if(!lines.includes(locked))throw new Error('必須保留 Morakot MCU、建置路徑與入口');
}

export function validateFiles(target: FirmwareId, value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('配置檔案必須是物件');
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(value)) {
    if (!targetFor(target).editableFiles?.includes(path)) throw new Error(`不允許的配置檔案：${path}`);
    if (typeof content !== 'string' || content.length > 196608 || content.includes('\0')) throw new Error('配置檔案太大或無效');
    const text = content.replace(/\r\n/g, '\n');
    if (target === 'px4' && path.startsWith('init/')) {
      for (const line of text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))) {
        if (!/^(?:param (?:set|set-default) [A-Z0-9_]+ -?(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)|(?:board_adc|icm45686|bmp388|iis2mdc|qmc5883l|rm3100|atxxxx) [A-Za-z0-9 .-]+)$/.test(line) || !line.split(/\s+/).includes('start') && !line.startsWith('param ')) throw new Error('PX4 init 只允許參數設定與受控驅動的 start 指令');
      }
    } else if (target === 'px4' && (path.endsWith('.px4board')||path.endsWith('/defconfig'))) {
      validateKconfigValues(path,text);
    } else if (target === 'px4' && path==='src/CMakeLists.txt') {
      validateCmake(text);
    } else if (target === 'px4' && path==='firmware.prototype') {
      let p;try{p=JSON.parse(text);}catch{throw new Error('firmware.prototype 必須是 JSON');}
      const keys=['board_id','magic','description','image','build_time','summary','version','image_size','image_maxsize','git_identity','board_revision'];
      if(!p||typeof p!=='object'||Object.keys(p).sort().join(',')!==keys.sort().join(',')||p.board_id!==1105||p.magic!=='PX4FWv1'||p.image_maxsize!==1703936||p.image!==''||p.image_size!==0||p.build_time!==0||p.git_identity!==''||p.board_revision!==0||['description','summary','version'].some(k=>typeof p[k]!=='string'||p[k].length>512))throw new Error('必須保留 PX4 套件 board ID、格式、容量與自動產生的欄位');
    } else if (target === 'px4' && path.endsWith('.ld')) {
      if (/\b(?:INCLUDE|INPUT|GROUP|STARTUP|OUTPUT|SEARCH_DIR)\b|["'`$]/.test(withoutComments(text))) throw new Error('linker script 不允許載入或寫出外部檔案');
    } else if (target === 'px4' && path.endsWith('/Kconfig')) {
      if (/\$|`|^\s*(?:source|rsource|osource|orsource)\b/m.test(text)) throw new Error('Kconfig 不允許執行命令或引用其他設定');
    } else if (target === 'ardupilot') {
      for (const line of text.split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)) if (/^(?:include|env|ROMFS|ROMFS_WILDCARD)\b/.test(line) || /[$`;{}]|\.\./.test(line)) throw new Error('hwdef 不允許引用其他檔案、執行指令或修改編譯環境');
      if (path.startsWith('hwdef') && (!/^MCU STM32H7xx STM32H743xx$/m.test(text) || !/^APJ_BOARD_ID (?:AP_HW_Morakot|1210)$/m.test(text))) throw new Error('必須保留 Morakot MCU 與 board ID');
      if (path === 'defaults.parm') for (const line of text.split('\n').map(l => l.split('#')[0].trim()).filter(Boolean)) if (!/^[A-Z][A-Z0-9_]+\s+-?\d+(?:\.\d+)?$/.test(line)) throw new Error('預設參數必須使用名稱與數值');
    } else if (/\.(?:c|cpp|h)$/.test(path)) {
      validateC(target,text);
      if (target === 'betaflight' && path==='config.h') {
        if (/[$`;{}]/.test(withoutComments(text))) throw new Error('config.h 只允許硬體定義與 C 前處理設定');
        if (!/#define\s+FC_TARGET_MCU\s+STM32H743\b/.test(text) || !/#define\s+BOARD_NAME\s+MORAKOT\b/.test(text)) throw new Error('必須保留 MORAKOT MCU 與板名');
      }
    } else throw new Error('未接入此配置格式');
    files[path] = text;
  }
  if(new TextEncoder().encode(JSON.stringify(files)).length>196608)throw new Error('此目錄的配置快照超過 192 KiB');
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
