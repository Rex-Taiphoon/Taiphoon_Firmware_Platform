import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {verifyPx4} from '../scripts/packages.ts';
test('PX4 發布前檢查解壓映像容量與完整 source SHA',()=>{
  const sha='a'.repeat(40),image=Buffer.alloc(64);
  const p={magic:'PX4FWv1',board_id:1105,git_hash:sha,image:deflateSync(image).toString('base64'),image_size:64,image_maxsize:128};
  assert.deepEqual(verifyPx4(Buffer.from(JSON.stringify(p)),sha),{imageSize:64,maxSize:128});
  for(const changes of [{image_maxsize:32},{board_id:1},{git_hash:'b'.repeat(40)},{image_size:63}]) assert.throws(()=>verifyPx4(Buffer.from(JSON.stringify({...p,...changes})),sha));
  assert.throws(()=>verifyPx4(Buffer.from(JSON.stringify(p)),sha,'1.18.0-beta1-6-g186ad6d691'));
});
