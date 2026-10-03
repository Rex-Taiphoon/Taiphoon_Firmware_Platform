import{test}from'node:test';
import assert from'node:assert/strict';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync,renameSync}from'node:fs';
import{join}from'node:path';
import{tmpdir}from'node:os';
import{transferDigest}from'../scripts/transfer.ts';
test('job 轉交摘要綁定每個檔名與 bytes，拒絕空目錄與非檔案',()=>{
  const dir=mkdtempSync(join(tmpdir(),'morakot-transfer-'));try{
    assert.throws(()=>transferDigest(dir),/缺少/);
    writeFileSync(join(dir,'config.json'),'{}');writeFileSync(join(dir,'firmware.bin'),Buffer.from([1,2,3]));
    const original=transferDigest(dir);writeFileSync(join(dir,'firmware.bin'),Buffer.from([1,2,4]));assert.notEqual(transferDigest(dir),original);
    writeFileSync(join(dir,'firmware.bin'),Buffer.from([1,2,3]));assert.equal(transferDigest(dir),original);
    renameSync(join(dir,'firmware.bin'),join(dir,'other.bin'));assert.notEqual(transferDigest(dir),original);
    mkdirSync(join(dir,'extra'));assert.throws(()=>transferDigest(dir),/無效/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
