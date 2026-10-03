import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {verifyPx4,verifyArduPilot} from '../scripts/packages.ts';
test('ArduPilot 發布前拒絕錯誤 board、來源、超過刷寫容量或與 BIN 不同的 APJ',()=>{
  const sha='a'.repeat(40),image=Buffer.alloc(64);
  const p={magic:'APJFWv1',board_id:1210,git_identity:sha.slice(0,8),image:deflateSync(image).toString('base64'),image_size:64,image_maxsize:128};
  assert.deepEqual(verifyArduPilot(Buffer.from(JSON.stringify(p)),image,sha),{imageSize:64,maxSize:128});
  for(const changes of [{board_id:1},{git_identity:'b'.repeat(8)},{image_maxsize:32},{image_maxsize:2000000}])assert.throws(()=>verifyArduPilot(Buffer.from(JSON.stringify({...p,...changes})),image,sha));
  assert.throws(()=>verifyArduPilot(Buffer.from(JSON.stringify(p)),Buffer.alloc(64,1),sha));
});
test('PX4 發布前檢查解壓映像容量與完整 source SHA',()=>{
  const sha='a'.repeat(40),image=Buffer.alloc(64);
  const p={magic:'PX4FWv1',board_id:1105,git_hash:sha,image:deflateSync(image).toString('base64'),image_size:64,image_maxsize:128};
  assert.deepEqual(verifyPx4(Buffer.from(JSON.stringify(p)),sha),{imageSize:64,maxSize:128});
  for(const changes of [{image_maxsize:32},{board_id:1},{git_hash:'b'.repeat(40)},{image_size:63}]) assert.throws(()=>verifyPx4(Buffer.from(JSON.stringify({...p,...changes})),sha));
  assert.throws(()=>verifyPx4(Buffer.from(JSON.stringify(p)),sha,'1.18.0-beta1-6-g186ad6d691'));
});
