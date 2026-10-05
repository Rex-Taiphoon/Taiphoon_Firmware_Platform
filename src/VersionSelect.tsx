import {profilesFor,targetFor,displayVersion,type FirmwareId} from '../shared/catalog.ts';
import {hardwareFor} from '../shared/hardware.ts';
export function VersionSelect({target,selected,disabled,onSelect}:{target:FirmwareId;selected?:string;disabled:boolean;onSelect:(id:string)=>void}) {
  const legacy=targetFor(target);
  return <label className="field version-select"><span>韌體版本</span><select aria-label="韌體版本" value={selected || 'legacy'} disabled={disabled} onChange={e=>onSelect(e.target.value)}>
    {!selected && <option value="legacy" disabled>{legacy.version || legacy.sourceSha.slice(0,12)} · 舊版工作</option>}
    {profilesFor(target,hardwareFor(targetFor(target,selected))).filter(p=>p.available || p.profileId===selected).sort((a,b)=>displayVersion(b).localeCompare(displayVersion(a),undefined,{numeric:true})).map(p=><option key={p.profileId} value={p.profileId} disabled={!p.available}>{displayVersion(p)}{!p.available?' · 歷史配置':''}</option>)}
  </select></label>;
}
