import { inflateSync } from 'node:zlib';
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
