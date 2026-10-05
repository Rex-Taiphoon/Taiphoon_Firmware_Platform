import { createHash } from 'node:crypto';
import { targetFor, type Target } from '../shared/catalog.ts';
import { validateConfig, sha, ValidationError, type Snapshot } from '../shared/domain.ts';

export function profileDigest(target: Target): string {
  const {note,description,available,ref,...spec}=target;
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex');
}
export function checkSnapshot(s: Snapshot): Target {
  const c=validateConfig(s.config),t=targetFor(c.target,c.profileId);
  sha(s.sourceSha);
  if(s.sourceRepository!==t.repository||s.sourceSha!==t.sourceSha||s.definitionRepository!==t.definition?.repository||s.definitionSha!==t.definition?.sha)throw new ValidationError('設定來源不在受控目標中');
  if(c.schemaVersion===2){
    if(t.recipeRefs && !t.recipeRefs.includes(s.recipeRef || ''))throw new ValidationError('此硬體不支援快照指定的編譯流程');
    if(s.profileDigest!==profileDigest(t))throw new ValidationError('編譯版本設定雜湊不一致');
    if(typeof s.recipeRef!=='string'||!/^platform-build-v2-[a-z0-9-]+$/.test(s.recipeRef))throw new ValidationError('不支援的編譯流程版本');
    sha(s.recipeSha);
  }
  return t;
}
