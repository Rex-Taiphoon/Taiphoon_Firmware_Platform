import { useEffect, useRef, useState } from 'react';
import { FileTree } from './FileTree.tsx';
import { Client, apiUrl, demoAllowed } from './client.ts';
import { targets, targetFor, type FirmwareId } from '../shared/catalog.ts';
import { defaultConfig, configFor, validateConfig, canonicalConfig, requestId, type Config, type SavedRequest, type BuildStatus, type Phase } from '../shared/domain.ts';

const phaseLabels: Record<Phase, string> = { saved: '設定已保存', dispatching: '正在送出', queued: '等待執行', validating: '驗證設定', building: '編譯中', publishing: '發布結果', success: '完成', failed: '工作失敗', cancelled: '已取消', uncertain: '確認送出結果' };
const steps = ['保存設定', '排隊', '編譯', '發布', '下載'];
const stepIndex: Partial<Record<Phase, number>> = { saved: 0, dispatching: 1, queued: 1, validating: 1, building: 2, publishing: 3, success: 4 };
export function App() {
  const [demo, setDemo] = useState(demoAllowed && !apiUrl);
  const client = useRef(new Client(demo));
  const [actor, setActor] = useState(demo ? 'local-demo' : '');
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [saved, setSaved] = useState<SavedRequest>();
  const [status, setStatus] = useState<BuildStatus>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pollError, setPollError] = useState(''), [pollTick, setPollTick] = useState(0);
  const [restoreId, setRestoreId] = useState(new URLSearchParams(location.search).get('request') || '');
  const pendingSave = useRef<{ id: string; config: string } | undefined>(undefined);
  const popup = useRef<Window | null>(null), loginTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const target = targetFor(config.target);
  const filesComplete = !target.editableFiles || target.editableFiles.every(p=>config.files?.[p]!==undefined);
  const dirty = saved && JSON.stringify(saved.config) !== JSON.stringify(config);
  const [fileTab,setFileTab] = useState('');
  useEffect(() => { setFileTab(target.editableFiles?.find(p=>target.definitionPath.endsWith(p)) || target.editableFiles?.[0] || ''); },[target.id]);
  useEffect(() => {
    if (!authenticated || !target.editableFiles || filesComplete || demo) return;
    let cancelled = false;
    client.current.call<{files:Record<string,string>}>(`/templates/${target.id}`).then(r => { if (!cancelled) setConfig(c=>({...c,files:{...r.files,...c.files}})); }).catch(e=>{if(!cancelled)setError(e.message);});
    return ()=>{cancelled=true;};
  },[actor,target.id,filesComplete,demo]);
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
  function selectTarget(id: FirmwareId) { if (id === config.target) return; setConfig(configFor(id)); setSaved(undefined); setStatus(undefined); setPollError(''); pendingSave.current = undefined; const url = new URL(location.href); url.searchParams.delete('request'); history.replaceState(null, '', url); }
  async function save() {
    await action(async () => {
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
    <div className="topline">DESIGNED IN TAIWAN <span>·</span> MORAKOT FIRMWARE WORKSPACE</div>
    <header className="header"><a href="https://taiphoon.com.tw/" target="_blank" rel="noreferrer" className="brand"><img src={`${import.meta.env.BASE_URL}taiphoon-logo.png`} alt="Taiphoon" /><span>TAIPHOON<small>FIRMWARE PLATFORM</small></span></a>
      <nav><a href="https://taiphoon-com.gitbook.io/" target="_blank" rel="noreferrer">產品文件 ↗</a><a href="https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform" target="_blank" rel="noreferrer">GitHub ↗</a></nav>
      {actor ? <button className="quiet" onClick={() => { client.current.session = ''; client.current.actor = ''; setActor(''); if (demo) switchMode(false); }}>● {actor} · 登出</button> : <button className="login" onClick={login} disabled={busy}>使用 GitHub 登入 ↗</button>}
    </header>
    <main>
      <section className="hero"><div><p className="eyebrow">BUILD YOUR NEXT FLIGHT</p><h1>你的設定。<br />你的 <em>Morakot。</em></h1><p className="intro">選擇韌體、調整設定，讓雲端完成編譯。<br />每一份結果，都能追溯到你保存的版本。</p></div>
        <div className="hero-detail"><span className="outline-label">CLOUD BUILD / 01</span><div className="orbit" aria-hidden="true"><div className="board"><b>M</b><span>MORAKOT</span><i>H743</i></div></div><p>GitHub Pages <span>→</span> Actions <span>→</span> Releases</p><small>無須 WSL・不需要本地編譯機</small></div>
      </section>
      <div className="section-heading"><div><p className="eyebrow">01 / FIRMWARE</p><h2>選擇你的韌體</h2></div><span className="subtle">MORAKOT 生態系 · 5 個韌體入口</span></div>
      <div className="targets" role="group" aria-label="韌體選擇">{targets.map((t, i) => <button className={`target-card ${config.target === t.id ? 'selected' : ''}`} key={t.id} onClick={() => selectTarget(t.id)} disabled={busy || Boolean(active)} aria-pressed={config.target === t.id}><span className="target-top"><small>0{i + 1}</small><span>{config.target === t.id ? '● 已選擇' : t.available ? '○ 可設定' : '待接入'}</span></span><strong>{t.name}</strong><small className="target-description">{t.description}</small><span className="target-bottom">{t.id === 'am32' ? 'ESC 韌體' : '飛控韌體'} <b>↗</b></span></button>)}</div>
      <section className="workspace">
        <div className="editor panel"><div className="panel-head"><div><p className="eyebrow">02 / CONFIGURATION</p><h2>{target.name} 設定</h2></div><span className="chip">{target.available ? 'MORAKOT' : '待接入'}</span></div>
          <p className="note">{target.note}</p>
          <dl className="source"><div><dt>硬體目標</dt><dd>{target.board}</dd></div><div><dt>來源分支</dt><dd>{target.ref || '尚未提供'}</dd></div><div><dt>原始碼版本</dt><dd><code title={target.sourceSha}>{target.sourceSha.slice(0, 12) || '待確認'}</code></dd></div></dl>
          {target.available ? <fieldset disabled={busy || Boolean(active)}>{target.fields.map(f => f.kind === 'choice' ? <label className="field" key={f.key}><span>{f.label}</span><select aria-label={f.label} value={String(config.options[f.key])} onChange={e => setConfig({ ...config, options: { ...config.options, [f.key]: e.target.value } })}>{f.choices?.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label> : <label className="toggle-row" key={f.key}><span>{f.label}</span><input type="checkbox" checked={Boolean(config.options[f.key])} onChange={e => setConfig({ ...config, options: { ...config.options, [f.key]: e.target.checked } })} /><span className="toggle" aria-hidden="true" /></label>)}</fieldset> : <div className="pending"><strong>等待 MORAKOT target 定義</strong><p>提供 INAV repository 與定義後，即可接入獨立編譯流程。現在不能送出此目標。</p></div>}
          {target.definition && <p className="note">硬體定義另固定於 <code>{target.definition.repository}@{target.definition.sha.slice(0, 10)}</code></p>}
          {target.editableFiles && <div className="file-editor"><div className="directory-heading"><strong>{target.id==='px4'?'boards/morakot/v6/':target.id==='ardupilot'?'hwdef/Morakot/':target.id==='betaflight'?'configs/MORAKOT/':'AM32 / Morakot 硬體定義'}</strong><span>{target.editableFiles.length} 個檔案</span></div><div className="file-workspace"><FileTree paths={target.editableFiles} selected={fileTab} onSelect={setFileTab}/><div className="file-content">{config.files ? <><label className="file-label" htmlFor="config-file">{fileTab} · UTF-8</label><textarea id="config-file" aria-label={fileTab} spellCheck={false} value={config.files[fileTab] || ''} disabled={busy || Boolean(active)} onChange={e=>setConfig({...config,files:{...config.files,[fileTab]:e.target.value}})} /></> : <p className="note">登入後讀取私人 repository 的完整配置目錄。</p>}</div></div><p className="note">目錄內所有文字配置均可選取編輯，保存時一起建立版本快照。功能選項優先於檔案內對應定義；不允許任意 shell、外部檔案引用或更換建置工具。</p>{target.id==='px4'&&fileTab.includes('bootloader')&&<p className="note">bootloader 檔案會一併保存；目前工作編譯 default 韌體，此檔只影響 bootloader 目標。</p>}{target.id==='am32'&&<p className="note">AM32 的 Morakot 定義位於共用 Inc/targets.h，沒有獨立的板級目錄。</p>}</div>}
          <details><summary>查看將保存的設定 JSON</summary><pre>{JSON.stringify(config, null, 2)}</pre></details>
          <p className="privacy">公開 repository 的設定、編譯紀錄與結果可能公開。請勿輸入密碼、金鑰或其他秘密。</p>
          <div className="actions"><button className="secondary" disabled={!authenticated || busy || Boolean(active) || !target.available || Boolean(!filesComplete && !demo)} onClick={save}>{busy ? '處理中…' : saved && !dirty ? '另存新版本' : '保存設定'}</button><button className="primary" disabled={!authenticated || busy || !saved || Boolean(dirty) || Boolean(active) || status?.phase === 'success' || status?.phase === 'cancelled' || (status?.phase === 'failed' && !status.canRetryDispatch) || !target.available} onClick={dispatch}>{demo ? '啟動本機流程示範' : '開始雲端編譯並發布'} <span>→</span></button></div>
          {!authenticated && <p className="note">登入後即可保存設定並提交編譯。</p>}{dirty && <p className="note">設定已變更，請先保存新的版本。</p>}
        </div>
        <div className="build panel"><div className="panel-head"><div><p className="eyebrow">03 / BUILD & DOWNLOAD</p><h2>{saved ? targetFor(saved.config.target).name + ' 編譯工作' : '編譯工作'}</h2></div><span className={`status-dot ${status?.phase === 'success' ? 'green' : ''}`} /></div>
          <div className="build-title" aria-live="polite"><span className="chip">{demo ? 'LOCAL DEMO' : 'GITHUB ACTIONS'}</span><h3>{status ? phaseLabels[status.phase] : '準備好，再起飛。'}</h3><p>{status?.message || (saved ? '此工作會使用下方固定的設定與原始碼版本。' : '保存設定後，這裡會顯示工作進度及下載結果。')}</p></div>
          <ol className="progress">{steps.map((step, i) => <li key={step} className={status && (stepIndex[status.phase] ?? -1) >= i ? 'done' : ''}><span>{status && (stepIndex[status.phase] ?? -1) > i ? '✓' : i + 1}</span>{step}</li>)}</ol>
          {saved ? <dl className="provenance"><div><dt>設定版本</dt><dd><code title={saved.configSha}>{saved.configSha.slice(0, 12)}</code></dd></div><div><dt>原始碼版本</dt><dd><code title={saved.sourceSha}>{saved.sourceSha.slice(0, 12)}</code></dd></div><div><dt>請求識別碼</dt><dd><code>{saved.requestId}</code></dd></div>{status?.runId && <div><dt>Actions 工作</dt><dd>#{status.runId} · attempt {status.runAttempt || 1}</dd></div>}</dl> : <div className="empty-state"><span>↗</span><p>每次編譯，都是一份可追溯的版本。</p></div>}
          {dirty && <p className="note">編輯中的設定尚未保存；下方結果仍使用已保存版本。</p>}{status?.runUrl && <a className="text-link" href={status.runUrl} target="_blank" rel="noreferrer">查看這次 Actions 紀錄 ↗</a>}
          {status?.provenance?.firmwareVersion && <p className="note">{targetFor(status.provenance.target).name} {status.provenance.firmwareVersion} · {status.provenance.variant} · {status.provenance.buildDate}</p>}
          {status?.phase === 'success' && status.assets?.map(a => <div className="download" key={a.name}><div><strong>{a.name}</strong>{a.sha256 && <small title={a.sha256}>SHA-256 {a.sha256.slice(0, 16)}…</small>}</div><a href={a.url} download={demo ? a.name : undefined} target={demo ? undefined : '_blank'} rel="noreferrer">下載 ↓</a></div>)}
          {status?.releaseUrl && <a className="text-link" href={status.releaseUrl} target="_blank" rel="noreferrer">查看 Release 與完整版本資訊 ↗</a>}
          {pollError && <div className="error" role="alert">狀態查詢暫停：{pollError}<button onClick={() => { setPollTick(t => t + 1); setPollError(''); }}>重新查詢</button></div>}
          {!demo && <details className="restore"><summary>找回已保存的工作</summary><label>請求識別碼<input value={restoreId} onChange={e => setRestoreId(e.target.value)} placeholder="UUID" /></label><button className="secondary" disabled={!authenticated || busy || Boolean(active)} onClick={restore}>讀取工作</button></details>}
        </div>
      </section>
      {error && <div className="error" role="alert">{error}</div>}
      {demoAllowed && <label className="demo-control"><input type="checkbox" checked={demo} disabled={busy || Boolean(active)} onChange={e => switchMode(e.target.checked)} />本機流程示範（不呼叫 GitHub，下載的是設定記錄）</label>}
      <footer><span>TAIPHOON <small>· Designed, assembled & tested in Taiwan.</small></span><span>設定留在 Git · 結果留在 Releases</span></footer>
    </main>
  </>;
}
