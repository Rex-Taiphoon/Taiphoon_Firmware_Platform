import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
export function transferDigest(directory='output'):string {
  const files=readdirSync(directory).sort().map(name=>{
    const path=join(directory,name),stat=lstatSync(path);
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(name)||!stat.isFile()||stat.size>104857600)throw new Error('產物轉交包含無效檔案');
    return {name,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')};
  });
  if(!files.length)throw new Error('產物轉交缺少檔案');
  return createHash('sha256').update(JSON.stringify(files)).digest('hex');
}
