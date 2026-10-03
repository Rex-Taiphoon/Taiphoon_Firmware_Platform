import {profilesFor,targetFor,displayVersion,type FirmwareId} from '../shared/catalog.ts';
export function VersionSelect({target,selected,disabled,onSelect}:{target:FirmwareId;selected?:string;disabled:boolean;onSelect:(id:string)=>void}) {
  const legacy=targetFor(target);
  return <label className="field version-select"><span>韌體版本</span><select aria-label="韌體版本" value={selected || 'legacy'} disabled={disabled} onChange={e=>onSelect(e.target.value)}>
    {!selected && <option value="legacy" disabled>{legacy.version || legacy.sourceSha.slice(0,12)} · 舊版工作</option>}
    {profilesFor(target).filter(p=>p.available || p.profileId===selected).map(p=><option key={p.profileId} value={p.profileId} disabled={!p.available}>{displayVersion(p)} · Morakot · {p.profileId?.split('-').at(-1)}</option>)}
  </select></label>;
}
