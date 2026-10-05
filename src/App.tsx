import { useEffect, useRef, useState } from 'react';
import {VersionSelect} from './VersionSelect.tsx';
import { FileTree } from './FileTree.tsx';
import { Client, apiUrl, demoAllowed } from './client.ts';
import { hardware, hardwareFor, hardwareLabel, type HardwareIdentity } from '../shared/hardware.ts';
import { targets, profilesFor, targetFor, displayVersion, defaultProfileId, type FirmwareId } from '../shared/catalog.ts';
import { configFor, validateConfig, canonicalConfig, requestId, type Config, type SavedRequest, type BuildStatus, type Phase } from '../shared/domain.ts';

const phaseLabels: Record<Phase, string> = { saved: '設定已保存', dispatching: '正在送出', queued: '等待執行', validating: '驗證設定', building: '編譯中', publishing: '發布結果', success: '完成', failed: '工作失敗', cancelled: '已取消', uncertain: '確認送出結果' };
const steps = ['保存設定', '排隊', '編譯', '發布', '下載'];
const stepIndex: Partial<Record<Phase, number>> = { saved: 0, dispatching: 1, queued: 1, validating: 1, building: 2, publishing: 3, success: 4 };
const platformIntroductions: Record<FirmwareId, string> = {
  ardupilot: '支援多旋翼、固定翼與地面載具的飛控韌體。',
  px4: '飛控韌體，可選擇編譯主韌體或 Bootloader。',
  betaflight: '適用於穿越機與競速多旋翼的飛控韌體。',
  inav: '支援 GPS 導航的多旋翼與固定翼飛控韌體。',
  am32: '無刷馬達 ESC 韌體，可選擇 G071 或 L431 CAN。',
};
export function App() {
  const [demo, setDemo] = useState(demoAllowed && !apiUrl);
  const client = useRef(new Client(demo));
  const [actor, setActor] = useState(demo ? 'local-demo' : '');
  const [config, setConfig] = useState<Config>(configFor('ardupilot',defaultProfileId('ardupilot')));
  const [saved, setSaved] = useState<SavedRequest>();
  const [status, setStatus] = useState<BuildStatus>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pollError, setPollError] = useState(''), [pollTick, setPollTick] = useState(0);
  const [restoreId, setRestoreId] = useState(new URLSearchParams(location.search).get('request') || '');
  const pendingSave = useRef<{ id: string; config: string } | undefined>(undefined);
  const popup = useRef<Window | null>(null), loginTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const target = targetFor(config.target,config.profileId);
  const selectedHardware=hardwareFor(target);
  const platformAvailable=profilesFor(config.target,selectedHardware).some(p=>p.available);
  const compatibleTargets=targets.filter(t=>profilesFor(t.id,selectedHardware).some(p=>p.available));
  const filesComplete = !target.editableFiles || target.editableFiles.every(p=>config.files?.[p]!==undefined);
  const dirty = saved && JSON.stringify(saved.config) !== JSON.stringify(config);
  const [fileTab,setFileTab] = useState('');
  useEffect(() => { setFileTab(target.editableFiles?.find(p=>target.definitionPath.endsWith(p)) || target.editableFiles?.[0] || ''); },[target.id,target.profileId]);
  useEffect(() => {
    if (!authenticated || !target.editableFiles || filesComplete || demo) return;
    let cancelled = false;
    client.current.call<{files:Record<string,string>}>(`/templates/${target.id}${target.profileId ? "?profile="+encodeURIComponent(target.profileId) : ""}`).then(r => { if (!cancelled) setConfig(c=>({...c,files:{...r.files,...c.files}})); }).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;};
  },[actor,target.id,target.profileId,filesComplete,demo]);
  const active = status && !['saved', 'success', 'failed', 'cancelled'].includes(status.phase);
  const authenticated = demo || Boolean(actor && client.current.session);

  useEffect(() => () => { client.current.dispose(); popup.current?.close(); clearTimeout(loginTimer.current); }, []);
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (!apiUrl || e.origin !== new URL(apiUrl).origin || e.source !== popup.current || e.data?.type !== 'taiphoon-auth' || typeof e.data.session !== 'string' || typeof e.data.actor !== 'string') return;
      client.current.session = e.data.session; client.current.actor = e.data.actor;
      setActor(e.data.actor); setError(''); popup.current?.close(); popup.current = null; clearTimeout(loginTimer.current); setBusy(false);
    };
    window.addEventListener('message', listener); return () => window.removeEventListener('message', listener);
  }, []);
  useEffect(() => {
    if (!saved || !active || !authenticated) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const next = await client.current.status(saved.requestId); if (!cancelled) { setStatus(next); setPollError(''); } }
      catch (e) { if (!cancelled) { setPollError((e as Error).message); if (!client.current.session && !demo) setActor(''); } }
      if (!cancelled) timer = setTimeout(poll, demo ? 700 : 5000);
    };
    void poll(); return () => { cancelled = true; clearTimeout(timer); };
  }, [saved?.requestId, active, authenticated, demo, pollTick]);

  async function action(work: () => Promise<void>) { setBusy(true); setError(''); try { await work(); } catch (e) { setError((e as Error).message); if (!client.current.session && !demo) setActor(''); } finally { setBusy(false); } }
  function login() {
    if (!apiUrl) { setError('先依 README 設定 GitHub App 與 API 網址'); return; }
    setBusy(true); setError(''); popup.current = window.open(`${apiUrl}/auth/login`, 'taiphoon-login', 'width=650,height=760');
    if (!popup.current) { setBusy(false); setError('請允許登入彈出視窗'); return; }
    clearTimeout(loginTimer.current); loginTimer.current = setTimeout(() => { setBusy(false); setError('登入尚未完成，可關閉視窗後重試'); popup.current?.close(); popup.current = null; }, 120000);
  }
  function switchMode(value: boolean) { client.current.dispose(); client.current = new Client(value); setDemo(value); setActor(value ? 'local-demo' : ''); setSaved(undefined); setStatus(undefined); setError(''); pendingSave.current = undefined; }
  function selectTarget(id: FirmwareId) { if (id === config.target) return; const profile=defaultProfileId(id,selectedHardware); if(!profile)return; if(config.files && !window.confirm('切換韌體會載入預設配置。請先保存要保留的修改。'))return; setConfig(configFor(id,profile)); setSaved(undefined); setStatus(undefined); setPollError(''); pendingSave.current = undefined; const url = new URL(location.href); url.searchParams.delete('request'); history.replaceState(null, '', url); }
  function selectHardware(identity:HardwareIdentity) {
    if(identity.id===selectedHardware.id && identity.revision===selectedHardware.revision)return;
    const next=targets.find(t=>defaultProfileId(t.id,identity));
    if(!next)return;
    if(config.files && !window.confirm('切換硬體會載入該硬體的預設配置。請先保存要保留的修改。'))return;
    const id=defaultProfileId(config.target,identity)?config.target:next.id;
    setConfig(configFor(id,defaultProfileId(id,identity)));setSaved(undefined);setStatus(undefined);setPollError('');pendingSave.current=undefined;
    const url=new URL(location.href);url.searchParams.delete('request');history.replaceState(null,'',url);
  }
  function selectVersion(profileId:string) {
    if(profileId===config.profileId)return;
    if(config.files && !window.confirm('切換版本會載入該版本的預設配置。請先保存要保留的修改。'))return;
    setConfig(configFor(config.target,profileId));setSaved(undefined);setStatus(undefined);setPollError('');pendingSave.current=undefined;
    const url=new URL(location.href);url.searchParams.delete('request');history.replaceState(null,'',url);
  }
  async function save() {
    await action(async () => {
      if(config.schemaVersion===1)throw new Error('請選擇韌體版本，載入該版本配置後另存新工作。');
      const validated = validateConfig(config), canonical = canonicalConfig(validated);
      if (!pendingSave.current || pendingSave.current.config !== canonical) pendingSave.current = { id: crypto.randomUUID(), config: canonical };
      const result = await client.current.save(pendingSave.current.id, validated); setSaved(result); setStatus({ phase: 'saved' });
      if (!demo) { const url = new URL(location.href); url.searchParams.set('request', result.requestId); history.replaceState(null, '', url); }
      pendingSave.current = undefined; setPollError('');
    });
  }
  async function dispatch() { if (!saved || dirty) return; await action(async () => { setStatus({ phase: 'dispatching' }); setStatus(await client.current.dispatch(saved.requestId)); }); }
  async function restore() { await action(async () => { const id = requestId(restoreId.trim()); const r = await client.current.saved(id); setConfig(r.config); setSaved(r); setStatus(await client.current.status(id)); }); }

  return <>
    <header className="header"><a href="https://taiphoon.com.tw/" target="_blank" rel="noreferrer" className="brand"><img src={`${import.meta.env.BASE_URL}taiphoon-logo.png`} alt="Taiphoon" /><span>TAIPHOON<small>FIRMWARE PLATFORM</small></span></a>
      <nav><a href="https://taiphoon-com.gitbook.io/" target="_blank" rel="noreferrer">產品文件 ↗</a></nav>
      {actor ? <button className="quiet" onClick={() => { client.current.session = ''; client.current.actor = ''; setActor(''); if (demo) switchMode(false); }}>● {actor} · 登出</button> : <button className="login" onClick={login} disabled={busy}>使用 GitHub 登入 ↗</button>}
    </header>
    <main>
      <section className="hero"><p className="eyebrow">TAIPHOON FIRMWARE</p><h1>Taiphoon 韌體編譯平台</h1><p className="intro">選擇硬體、韌體版本與配置</p></section>
      <section className="panel hardware-selection" aria-label="硬體選擇"><div className="panel-head"><h2>選擇硬體</h2></div>
        <label className="field"><span>硬體型號</span><select aria-label="硬體型號" value={selectedHardware.id} disabled={busy || Boolean(active)} onChange={e=>{const h=hardware.find(h=>h.id===e.target.value)!;const revision=h.revisions.find(r=>targets.some(t=>defaultProfileId(t.id,{id:h.id,revision:r.id})));if(revision)selectHardware({id:h.id,revision:revision.id});}}>{hardware.map(h=><option key={h.id} value={h.id} disabled={!h.revisions.some(r=>targets.some(t=>defaultProfileId(t.id,{id:h.id,revision:r.id})))}>{h.name}{!h.revisions.some(r=>targets.some(t=>defaultProfileId(t.id,{id:h.id,revision:r.id})))?' · 待接入':''}</option>)}</select></label>
        <label className="field"><span>硬體版本</span><select aria-label="硬體版本" value={selectedHardware.revision} disabled={busy || Boolean(active)} onChange={e=>selectHardware({id:selectedHardware.id,revision:e.target.value})}>{hardware.find(h=>h.id===selectedHardware.id)!.revisions.map(r=><option key={r.id} value={r.id} disabled={!targets.some(t=>defaultProfileId(t.id,{id:selectedHardware.id,revision:r.id}))}>{r.name}{r.note?' · '+r.note:''}</option>)}</select></label>
      </section>
      <div className="section-heading"><div><p className="eyebrow">01 / FIRMWARE</p><h2>選擇你的韌體</h2></div><span className="subtle">{hardwareLabel(target)}</span></div>
      <div className="targets" role="group" aria-label="韌體選擇">{compatibleTargets.map((t, i) => <button className={`target-card ${config.target === t.id ? 'selected' : ''}`} key={t.id} onClick={() => selectTarget(t.id)} disabled={busy || Boolean(active)} aria-pressed={config.target === t.id}><span className="target-top"><small>0{i + 1}</small><span>{config.target === t.id ? '● 已選擇' : t.available ? '○ 可設定' : '待接入'}</span></span><strong>{t.name}</strong><small className="target-description">{t.name} {displayVersion(config.target === t.id ? target : targetFor(t.id, defaultProfileId(t.id,selectedHardware)))}</small><span className="target-bottom">{t.id === 'am32' ? 'ESC 韌體' : target.hardware && t.id==='ardupilot' ? '周邊韌體' : '飛控韌體'} <b>↗</b></span></button>)}</div>
      <section className="workspace">
        <div className="editor panel"><div className="panel-head"><div><p className="eyebrow">02 / CONFIGURATION</p><h2>{target.name} 設定</h2></div><span className="chip">{target.available ? hardwareLabel(target) : target.profileId ? '歷史版本' : '待接入'}</span></div>
          {platformAvailable && <VersionSelect target={config.target} selected={config.profileId} disabled={busy || Boolean(active)} onSelect={selectVersion}/>}
          <p className="note">{target.name} {displayVersion(target)}：{target.ardupilotBoard ? 'AP_Periph 周邊韌體，用於 CAN 節點與感測器。' : platformIntroductions[target.id]}</p>
          {target.hardware && <p className="note">{target.note}</p>}
          {!target.available && platformAvailable && <p className="note">此為歷史編譯設定；選擇可用版本可建立新的工作。</p>}
          {!config.profileId && target.available && <p className="note">此為舊版工作，保存與結果驗證沿用原版本。選擇新版設定可建立新的工作。</p>}
          <dl className="source"><div><dt>硬體目標</dt><dd>{target.id==='px4' && config.options.buildTarget==='bootloader'?'morakot_v6_bootloader':target.board}</dd></div><div><dt>固定來源</dt><dd>{target.ref || '尚未提供'}</dd></div><div><dt>原始碼版本</dt><dd><code title={target.sourceSha}>{target.sourceSha.slice(0, 12) || '待確認'}</code></dd></div></dl>
          {platformAvailable ? <fieldset disabled={busy || Boolean(active) || !target.available || config.schemaVersion===1}>{target.fields.filter(f=>!['osd','osdType2'].includes(f.key) && !(config.options.buildTarget==='bootloader' && ['dds','lto'].includes(f.key))).map(f => f.kind === 'choice' ? <label className="field" key={f.key}><span>{f.label}</span><select aria-label={f.label} value={String(config.options[f.key])} onChange={e => setConfig({ ...config, options: { ...config.options, [f.key]: e.target.value } })}>{f.choices?.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label> : <label className="toggle-row" key={f.key}><span>{f.label}</span><input type="checkbox" checked={Boolean(config.options[f.key])} onChange={e => setConfig({ ...config, options: { ...config.options, [f.key]: e.target.checked } })} /><span className="toggle" aria-hidden="true" /></label>)}</fieldset> : <div className="pending"><strong>等待硬體的韌體定義</strong><p>此硬體尚未有可用的編譯設定。</p></div>}
          {config.options.buildTarget==='bootloader' && <p className="note">Bootloader 輸出 BIN／ELF，使用 SWD／DFU，Flash 起點 0x08000000。DDS 與主韌體 LTO 不套用；Bootloader 設定請編輯其配置檔。</p>}
          {target.definition && <p className="note">硬體定義另固定於 <code>{target.definition.repository}@{target.definition.sha.slice(0, 10)}</code></p>}
          {target.editableFiles && <div className="file-editor"><div className="directory-heading"><strong>{target.definitionPath.includes('/') ? target.definitionPath.slice(0,target.definitionPath.lastIndexOf('/')+1) : hardwareLabel(target)+' 硬體定義'}</strong><span>{target.editableFiles.length} 個檔案</span></div><div className="file-workspace"><FileTree paths={target.editableFiles} selected={fileTab} onSelect={setFileTab}/><div className="file-content">{config.files ? <><label className="file-label" htmlFor="config-file">{fileTab} · UTF-8</label><textarea id="config-file" aria-label={fileTab} spellCheck={false} value={config.files[fileTab] || ''} disabled={busy || Boolean(active)} onChange={e=>setConfig({...config,files:{...config.files,[fileTab]:e.target.value}})} /></> : <p className="note">登入後讀取私人 repository 的完整配置目錄。</p>}</div></div>{target.id==='px4'&&fileTab.includes('bootloader')&&<p className="note">選擇「Bootloader」會編譯此目標並提供 BIN／ELF；主韌體與 Bootloader 分別發布，OSD、DDS 與主韌體 LTO 選項不套用於 Bootloader。</p>}{target.id==='am32'&&<p className="note">AM32 的 Morakot 定義位於共用 Inc/targets.h，沒有獨立的板級目錄。</p>}</div>}
          <div className="actions"><button className="secondary" disabled={!authenticated || config.schemaVersion===1 || busy || Boolean(active) || !target.available || Boolean(!filesComplete && !demo)} onClick={save}>{busy ? '處理中…' : saved && !dirty ? '另存新版本' : '保存設定'}</button><button className="primary" disabled={!authenticated || config.schemaVersion===1 || busy || !saved || Boolean(dirty) || Boolean(active) || status?.phase === 'success' || status?.phase === 'cancelled' || (status?.phase === 'failed' && !status.canRetryDispatch) || !target.available} onClick={dispatch}>{demo ? '啟動本機流程示範' : '開始雲端編譯並發布'} <span>→</span></button></div>
          {!authenticated && <p className="note">登入後即可保存設定並提交編譯。</p>}{dirty && <p className="note">設定已變更，請先保存新的版本。</p>}
        </div>
        <div className="build panel"><div className="panel-head"><div><p className="eyebrow">03 / BUILD & DOWNLOAD</p><h2>{saved ? targetFor(saved.config.target,saved.config.profileId).name + ' 編譯工作' : '編譯工作'}</h2></div><span className={`status-dot ${status?.phase === 'success' ? 'green' : ''}`} /></div>
          <div className="build-title" aria-live="polite"><span className="chip">{demo ? 'LOCAL DEMO' : 'GITHUB ACTIONS'}</span><h3>{status ? phaseLabels[status.phase] : '等待開始'}</h3><p>{status?.message || (saved ? '此工作會使用下方固定的設定與原始碼版本。' : '保存設定後，這裡會顯示工作進度及下載結果。')}</p></div>
          <ol className="progress">{steps.map((step, i) => <li key={step} className={status && (stepIndex[status.phase] ?? -1) >= i ? 'done' : ''}><span>{status && (stepIndex[status.phase] ?? -1) > i ? '✓' : i + 1}</span>{step}</li>)}</ol>
          {saved ? <dl className="provenance"><div><dt>硬體</dt><dd>{hardwareLabel(targetFor(saved.config.target,saved.config.profileId))}</dd></div><div><dt>韌體版本</dt><dd>{displayVersion(targetFor(saved.config.target,saved.config.profileId),String(saved.config.options.vehicle || saved.config.options.variant || ''))}</dd></div><div><dt>設定版本</dt><dd><code title={saved.configSha}>{saved.configSha.slice(0, 12)}</code></dd></div><div><dt>原始碼版本</dt><dd><code title={saved.sourceSha}>{saved.sourceSha.slice(0, 12)}</code></dd></div><div><dt>請求識別碼</dt><dd><code>{saved.requestId}</code></dd></div>{status?.runId && <div><dt>Actions 工作</dt><dd>#{status.runId} · attempt {status.runAttempt || 1}</dd></div>}</dl> : <div className="empty-state"><span>↗</span><p>每次編譯，都是一份可追溯的版本。</p></div>}
          {dirty && <p className="note">編輯中的設定尚未保存；下方結果仍使用已保存版本。</p>}{status?.runUrl && <a className="text-link" href={status.runUrl} target="_blank" rel="noreferrer">查看這次 Actions 紀錄 ↗</a>}
          {status?.provenance?.releaseTag && <p className="result-name">{status.releaseName || status.provenance.releaseTag}</p>}{status?.provenance?.firmwareVersion && <p className="note">{targetFor(status.provenance.target).name} {status.provenance.displayFirmwareVersion || status.provenance.firmwareVersion} · {status.provenance.variant} · {status.provenance.buildDate}</p>}
          {status?.phase === 'success' && status.assets?.map(a => <div className="download" key={a.name}><div><strong>{a.name}</strong>{a.sha256 && <small title={a.sha256}>SHA-256 {a.sha256.slice(0, 16)}…</small>}</div><a href={a.url} download={demo ? a.name : undefined} target={demo ? undefined : '_blank'} rel="noreferrer">下載 ↓</a></div>)}
          {status?.releaseUrl && <a className="text-link" href={status.releaseUrl} target="_blank" rel="noreferrer">查看 Release 與完整版本資訊 ↗</a>}
          {pollError && <div className="error" role="alert">狀態查詢暫停：{pollError}<button onClick={() => { setPollTick(t => t + 1); setPollError(''); }}>重新查詢</button></div>}
          {!demo && <details className="restore"><summary>找回已保存的工作</summary><label>請求識別碼<input value={restoreId} onChange={e => setRestoreId(e.target.value)} placeholder="UUID" /></label><button className="secondary" disabled={!authenticated || busy || Boolean(active)} onClick={restore}>讀取工作</button></details>}
        </div>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {demoAllowed && <label className="demo-control"><input type="checkbox" checked={demo} disabled={busy || Boolean(active)} onChange={e => switchMode(e.target.checked)} />本機流程示範（不呼叫 GitHub，下載的是設定記錄）</label>}
      <footer><span>TAIPHOON <small>· Designed, assembled & tested in Taiwan.</small></span></footer>
    </main>
  </>;
}
