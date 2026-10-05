import type { ArduPilotBoard } from '../shared/hardware.ts';
import { inflateSync } from 'node:zlib';
// INAV's native H743 image uses the MCU flash base, not the PX4/AP application offset.
export function verifyInav(hex:Buffer,binary:Buffer,sourceSha:string,version:string) {
  const base=0x08000000,max=2097152;
  if(binary.length<64 || binary.length>max || hex.length>max*3)throw new Error('INAV 映像大小不符');
  let upper=0,eof=false,count=0,last=0;
  // GNU objcopy -Obinary fills holes (including the reserved config sector) with zero.
  const seen=new Uint8Array(binary.length),image=Buffer.alloc(binary.length);
  for(const line of hex.toString('ascii').trim().split(/\r?\n/)){
    if(eof || !/^:(?:[0-9a-f]{2})+$/i.test(line))throw new Error('INAV HEX 結構不符');
    const b=Buffer.from(line.slice(1),'hex'),length=b[0],address=b.readUInt16BE(1),type=b[3];
    if(b.length!==length+5 || [...b].reduce((a,v)=>a+v,0)%256)throw new Error('INAV HEX checksum 不符');
    if(type===0){
      const offset=upper+address-base;
      if(!length || offset<0 || offset+length>binary.length)throw new Error('INAV HEX Flash 範圍不符');
      for(let i=0;i<length;i++){if(seen[offset+i])throw new Error('INAV HEX 位址重複');seen[offset+i]=1;}
      b.copy(image,offset,4,4+length);count+=length;last=Math.max(last,offset+length);
    }else if(type===1){if(length || address)throw new Error('INAV HEX EOF 不符');eof=true;}
    else if(type===2 || type===4){if(length!==2 || address)throw new Error('INAV HEX 位址紀錄不符');upper=b.readUInt16BE(4)*(type===4?65536:16);}
    else if(type===3 || type===5){if(length!==4 || address)throw new Error('INAV HEX 入口紀錄不符');}
    else throw new Error('INAV HEX 類型不符');
  }
  if(!eof || !count || !seen[0] || last!==binary.length || !image.equals(binary))throw new Error('INAV HEX／BIN 內容不一致');
  const stack=binary.readUInt32LE(0),reset=binary.readUInt32LE(4);
  const ram=[[0x20000000,0x20020000],[0x24000000,0x24080000],[0x30000000,0x30048000],[0x38000000,0x38010000]];
  if(stack%8 || !ram.some(([a,b])=>stack>a&&stack<=b) || !(reset&1) || reset-1<base || reset-1>=base+binary.length)throw new Error('INAV ARM 向量或 Flash 起點不符');
  for(const identity of ['INAV','MORAKOT',version,sourceSha.slice(0,8)])if(!binary.includes(Buffer.from(identity)))throw new Error('INAV 映像來源、版本或板名不符');
  return {imageSize:binary.length,maxSize:max,flashAddress:'0x08000000',board:'MORAKOT',version};
}
// Morakot H743: bootloader owns the first 128 KiB at 0x08000000.
export function verifyPx4Bootloader(binary:Buffer,elf:Buffer) {
  if(binary.length<8 || binary.length>131072 || elf.length<52 || elf.subarray(0,7).toString('hex')!=='7f454c46010101' || elf.readUInt16LE(16)!==2 || elf.readUInt16LE(18)!==40)throw new Error('PX4 Bootloader 格式或 128 KiB 容量不符');
  const stack=binary.readUInt32LE(0),reset=binary.readUInt32LE(4);
  const ram=[[0x20000000,0x20020000],[0x24000000,0x24080000],[0x30000000,0x30048000],[0x38000000,0x38010000]];
  // NuttX initializes SP from _ebss + IDLETHREAD_STACKSIZE; the bootloader profile aligns _ebss and stack sizes to 8.
  if(stack%8 || !ram.some(([a,b])=>stack>a&&stack<=b) || !(reset&1) || (reset&~1)<0x08000000 || (reset&~1)>=0x08000000+binary.length)throw new Error(`PX4 Bootloader 向量或 Flash 起始位址不符（SP=0x${stack.toString(16)}，Reset=0x${reset.toString(16)}）`);
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
export function verifyArduPilot(data: Buffer, binary: Buffer, sourceSha: string, board?: Pick<ArduPilotBoard,'boardId'|'maxImageSize'|'binaryIdentity'>) {
  const p=JSON.parse(data.toString('utf8'));
  const max=board?.maxImageSize ?? 1703936;
  const image=inflateSync(Buffer.from(p.image,'base64'),{maxOutputLength:max});
  if(p.magic!=='APJFWv1'||p.board_id!==(board?.boardId ?? 1210)||p.git_identity!==sourceSha.slice(0,8)||image.length!==p.image_size||
     !Number.isSafeInteger(p.image_maxsize)||p.image_maxsize<=0||p.image_maxsize>max||image.length>p.image_maxsize||!image.equals(binary)) throw new Error('ArduPilot 套件來源、board ID、容量或 APJ／BIN 內容不符');
  if(board?.binaryIdentity && !image.includes(Buffer.from(board.binaryIdentity)))throw new Error('ArduPilot 映像的周邊硬體識別不符');
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
