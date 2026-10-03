import { createHash } from 'node:crypto';
import { targetFor } from '../shared/catalog.ts';
import { templateData } from '../server/templates-data.ts';
import type { SavedRequest, Provenance } from '../shared/domain.ts';

const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function configurationChanges(saved:SavedRequest) {
  const t=targetFor(saved.config.target,saved.config.profileId),baseline=templateData[t.templateKey || t.id];
  const options=t.fields.filter(f=>saved.config.options[f.key]!==f.default).map(f=>({key:f.key,label:f.label,before:f.default,after:saved.config.options[f.key]}));
  const files=Object.entries(saved.config.files || {}).filter(([path,text])=>text!==baseline[path]).map(([path,text])=>{
    const old=(baseline[path] || '').split('\n'),next=text.split('\n');
    function extra(a:string[],b:string[]){const counts=new Map<string,number>();for(const line of b)counts.set(line,(counts.get(line)||0)+1);return a.filter(line=>{const count=counts.get(line)||0;if(count){counts.set(line,count-1);return false;}return true;});}
    return {path,beforeSha256:hash(baseline[path] || ''),afterSha256:hash(text),removed:extra(old,next),added:extra(next,old)};
  });
  return {baseline:saved.config.profileId || 'legacy-'+saved.config.target,templateRevision:t.templateRevision,options,files};
}
const safe=(s:string)=>s.replace(/[\r\n]/g,' ').replace(/[\\`*_{}[\]<>!|]/g,c=>'\\'+c);
export function releaseDescription(saved:SavedRequest,manifest:Provenance,repository:string):string {
  const changes=configurationChanges(saved),t=targetFor(saved.config.target,saved.config.profileId);
  const format=(v:string|boolean)=>typeof v==='boolean'?(v?'啟用':'停用'):v;
  const lines=[`${t.name} ${manifest.displayFirmwareVersion || manifest.firmwareVersion} · Morakot${manifest.variant && manifest.variant!=='Morakot'?' · '+manifest.variant:''} · ${manifest.buildDate}（台灣時間）`,
    ...(manifest.variant==='bootloader'?['Bootloader：BIN／ELF，Flash 位址 0x08000000；使用 SWD／DFU，主韌體更新入口不適用。']:[]), '', '修改摘要（相對於此版本的 Morakot 預設配置）：'];
  for(const o of changes.options)lines.push(`- ${safe(o.label)}：${safe(format(o.before))} → ${safe(format(o.after))}`);
  let excerptBudget=3500;
  for(const f of changes.files){
    lines.push(`- ${safe(f.path)}：新增 ${f.added.length} 行、移除 ${f.removed.length} 行${!f.added.length&&!f.removed.length?'（行序調整）':''}`);
    const edits=[...f.removed.map(line=>'- '+line),...f.added.map(line=>'+ '+line)].slice(0,6);
    const excerpt=edits.map(line=>line.replaceAll('~','∼').slice(0,160));
    const size=excerpt.join('\n').length;
    if(excerpt.length && size<=excerptBudget){lines.push('','~~~~diff',...excerpt,'~~~~');excerptBudget-=size;}
  }
  if(!changes.options.length&&!changes.files.length)lines.push('- 使用此版本的預設配置，無使用者修改。');
  lines.push('',`設定：[${saved.configSha.slice(0,12)}](https://github.com/${repository}/commit/${saved.configSha}) · 原始碼：[${saved.sourceSha.slice(0,12)}](https://github.com/${saved.sourceRepository}/commit/${saved.sourceSha})`,
    `[編譯紀錄](https://github.com/${repository}/actions/runs/${manifest.runId}) · 完整設定：config.json · 修改清單：changes.json · 版本與雜湊：provenance.json`);
  return lines.join('\n');
}
