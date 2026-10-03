import { inflateSync } from 'node:zlib';
// Morakot H743: bootloader owns the first 128 KiB at 0x08000000.
export function verifyPx4Bootloader(binary:Buffer,elf:Buffer) {
  if(binary.length<8 || binary.length>131072 || elf.length<52 || elf.subarray(0,7).toString('hex')!=='7f454c46010101' || elf.readUInt16LE(16)!==2 || elf.readUInt16LE(18)!==40)throw new Error('PX4 Bootloader 格式或 128 KiB 容量不符');
  const stack=binary.readUInt32LE(0),reset=binary.readUInt32LE(4);
  const ram=[[0x20000000,0x20020000],[0x24000000,0x24080000],[0x30000000,0x30048000],[0x38000000,0x38010000]];
  // NuttX initializes SP from _ebss + IDLETHREAD_STACKSIZE; the supplied linker aligns _ebss to 4.
  if(stack%4 || !ram.some(([a,b])=>stack>a&&stack<=b) || !(reset&1) || (reset&~1)<0x08000000 || (reset&~1)>=0x08000000+binary.length)throw new Error(`PX4 Bootloader 向量或 Flash 起始位址不符（SP=0x${stack.toString(16)}，Reset=0x${reset.toString(16)}）`);
  const offset=elf.readUInt32LE(28),size=elf.readUInt16LE(42),count=elf.readUInt16LE(44);
  if(size!==32 || !count || offset+size*count>elf.length)throw new Error('PX4 Bootloader ELF 區段無效');
  const segments=[];
  for(let i=0;i<count;i++){
    const p=offset+i*size;if(elf.readUInt32LE(p)!==1)continue;
    const fileOffset=elf.readUInt32LE(p+4),address=elf.readUInt32LE(p+12),length=elf.readUInt32LE(p+16);
    if(!length)continue;
    if(address<0x08000000 || address+length>0x08020000 || fileOffset+length>elf.length)throw new Error('PX4 Bootloader ELF 載入範圍不符');
    segments.push({start:address-0x08000000,length,fileOffset});
  }
  if(!segments.length || Math.min(...segments.map(s=>s.start))!==0 || Math.max(...segments.map(s=>s.start+s.length))!==binary.length)throw new Error('PX4 Bootloader ELF／BIN 範圍不一致');
  for(const s of segments)if(!binary.subarray(s.start,s.start+s.length).equals(elf.subarray(s.fileOffset,s.fileOffset+s.length)))throw new Error('PX4 Bootloader ELF／BIN 內容不一致');
  return {imageSize:binary.length,maxSize:131072,flashAddress:'0x08000000',applicationAddress:'0x08020000'};
}
export function verifyArduPilot(data: Buffer, binary: Buffer, sourceSha: string) {
  const p=JSON.parse(data.toString('utf8'));
  const image=inflateSync(Buffer.from(p.image,'base64'),{maxOutputLength:1703936});
  if(p.magic!=='APJFWv1'||p.board_id!==1210||p.git_identity!==sourceSha.slice(0,8)||image.length!==p.image_size||
     !Number.isSafeInteger(p.image_maxsize)||p.image_maxsize<=0||p.image_maxsize>1703936||image.length>p.image_maxsize||!image.equals(binary)) throw new Error('ArduPilot 套件來源、board ID、容量或 APJ／BIN 內容不符');
  return {imageSize:image.length,maxSize:p.image_maxsize};
}
export function verifyPx4(data: Buffer, sourceSha: string, version?: string) {
  const p=JSON.parse(data.toString('utf8'));
  const image=inflateSync(Buffer.from(p.image,'base64'),{maxOutputLength:2097152});
  if (p.magic!=='PX4FWv1'||p.board_id!==1105||p.git_hash!==sourceSha||image.length!==p.image_size||
      !Number.isSafeInteger(p.image_maxsize)||p.image_maxsize<=0||p.image_maxsize>1966080) throw new Error('PX4 套件版本、board ID 或刷寫容量驗證失敗');
  if (image.length>p.image_maxsize) throw new Error(`PX4 映像 ${image.length} bytes 超出 bootloader 容量 ${p.image_maxsize} bytes；請停用不需要的模組`);
  if (version && !image.includes(Buffer.from('v'+version.replace(/-\d+-g[0-9a-f]+$/,'')))) throw new Error('PX4 映像缺少正確版本標籤；請完整 checkout Git tags');
  return { imageSize:image.length, maxSize:p.image_maxsize };
}
