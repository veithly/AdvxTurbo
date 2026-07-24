import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useAuth } from '../store.js';
import { Avatar, useToast, useConfig } from '../ui.js';
import { sfx } from '../audio.js';

export function AgentLab() {
  const t = useT();
  const cfg = useConfig();
  const { user } = useAuth();
  const { workerId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [workers, setWorkers] = useState<any[]>([]);
  const [wid, setWid] = useState<string | undefined>(workerId);
  const [versions, setVersions] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [riskNotes, setRiskNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get('/api/workers').then((ws) => {
      setWorkers(ws);
      if (!wid && ws[0]) setWid(ws[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!wid) return;
    api.get('/api/workers/' + wid + '/versions').then((vs) => {
      setVersions(vs);
      const cur = vs[vs.length - 1];
      if (cur) api.get('/api/versions/' + cur.id).then((v) => setCode(v.source_code || ''));
    });
  }, [wid]);

  async function runSim(suite: 'quick' | 'regression') {
    setBusy(true); setResult(null); sfx('click');
    try {
      const r = await api.post('/api/workers/' + wid + '/simulate', { sourceCode: code, suite });
      setResult({ suite, ...r });
      sfx('success');
    } catch (e: any) {
      toast.show(e.message, 'err'); sfx('error');
    } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); sfx('click');
    try {
      const created = await api.post('/api/workers/' + wid + '/versions', { sourceCode: code, changeNotes, riskNotes, submittedBy: 'human' });
      if (!created.staticCheck.ok) { toast.show('Static check: ' + created.staticCheck.errors.join(','), 'err'); setBusy(false); return; }
      await api.post('/api/versions/' + created.version.id + '/publish', { branch: 'ranked' });
      toast.show(t('common.publish') + ' ✔'); sfx('success');
      setVersions(await api.get('/api/workers/' + wid + '/versions'));
    } catch (e: any) {
      toast.show(e.message, 'err'); sfx('error');
    } finally { setBusy(false); }
  }

  function loadTemplate(id: string) {
    const tpl = cfg?.strategyLibrary?.find((s: any) => s.id === id);
    if (tpl) setCode(tpl.code);
  }

  if (!user) return <div className="content"><div className="card center"><button className="btn primary" onClick={() => nav('/auth')}>{t('common.login')}</button></div></div>;

  const worker = workers.find((w) => w.id === wid);

  return (
    <div className="content">
      <h2 className="page-title">🧪 {t('nav.agentLab')}</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        {workers.map((w) => (
          <button key={w.id} className={`btn sm ${wid === w.id ? 'primary' : ''}`} onClick={() => setWid(w.id)}>{w.name}</button>
        ))}
      </div>

      <div className="grid lab-layout" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        {/* 编辑器 */}
        <div className="card">
          <div className="row between">
            <h3>📝 {t('lab.editor')}</h3>
            {worker && <span className="tag">{t('role.' + worker.role)}</span>}
          </div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="small muted">{t('lab.loadTemplate')}:</span>
            {(cfg?.strategyLibrary || []).map((s: any) => (
              <button key={s.id} className="btn sm" onClick={() => loadTemplate(s.id)}>{t(s.nameKey)}</button>
            ))}
          </div>
          <textarea rows={20} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn cyan" disabled={busy} onClick={() => runSim('quick')}>⚡ {t('lab.quickSim')}</button>
            <button className="btn purple" disabled={busy} onClick={() => runSim('regression')}>📊 {t('lab.regression')}</button>
          </div>
        </div>

        {/* 版本树 + 结果 */}
        <div>
          <div className="card">
            <h3>🌳 {t('lab.versionTree')}</h3>
            <div style={{ maxHeight: 160, overflow: 'auto' }}>
              {versions.map((v) => (
                <div key={v.id} className="row between small" style={{ borderBottom: '1px solid var(--gray2)', padding: '3px 0' }}>
                  <span>v{v.semver} <span className="tag gray">{v.submitted_by}</span></span>
                  <span className={`tag ${v.status === 'published' ? 'green' : v.status === 'rejected' ? 'red' : 'gray'}`}>{v.status}</span>
                </div>
              ))}
            </div>
          </div>

          {result && (
            <div className="card">
              <h3>📈 {t('lab.metrics')} ({result.suite})</h3>
              {result.suite === 'quick' && result.metrics && (
                <table className="tbl"><tbody>
                  <tr><td>{t('diff.successRate')}</td><td>{(result.metrics.projectSuccessRate * 100).toFixed(0)}%</td></tr>
                  <tr><td>{t('replay.placement')}</td><td>{result.metrics.avgPlacement}</td></tr>
                  <tr><td>{t('diff.avgBlame')}</td><td>{result.metrics.avgBlame}</td></tr>
                  <tr><td>CPU p95</td><td>{result.metrics.strategyCpuP95Ms}ms</td></tr>
                </tbody></table>
              )}
              {result.suite === 'regression' && (
                <>
                  <table className="tbl">
                    <thead><tr><th></th><th>{t('lab.candidate')}</th><th>{t('lab.baseline')}</th></tr></thead>
                    <tbody>
                      <tr><td>{t('diff.successRate')}</td><td>{(result.candidate.projectSuccessRate * 100).toFixed(0)}%</td><td>{result.baseline ? (result.baseline.projectSuccessRate * 100).toFixed(0) + '%' : '-'}</td></tr>
                      <tr><td>{t('diff.avgBlame')}</td><td>{result.candidate.avgBlame}</td><td>{result.baseline?.avgBlame ?? '-'}</td></tr>
                      <tr><td>{t('diff.p0FixRate')}</td><td>{result.candidate.p0FixRate}</td><td>{result.baseline?.p0FixRate ?? '-'}</td></tr>
                      <tr><td>{t('diff.contribution')}</td><td>{result.candidate.avgContribution}</td><td>{result.baseline?.avgContribution ?? '-'}</td></tr>
                    </tbody>
                  </table>
                  <h4 style={{ marginTop: 10 }}>{t('lab.behaviorDiff')}</h4>
                  {result.behaviorDiff?.map((d: any, i: number) => (
                    <div key={i} className="small timeline-ev">
                      <span className={`tag ${d.kind === 'measured' ? 'cyan' : 'gray'}`}>{t('lab.' + d.kind)}</span> {t(d.textKey, d.textKey)} {d.delta != null ? <b style={{ color: d.delta > 0 ? 'var(--green2)' : 'var(--red2)' }}>{d.delta > 0 ? '↑' : '↓'}{Math.abs(d.delta)}</b> : d.text}
                    </div>
                  ))}
                  <div className={`tag ${result.passesPublishGate ? 'green' : 'red'}`} style={{ marginTop: 8 }}>
                    {result.passesPublishGate ? '✔ ' + t('lab.passesGate') : '✘ ' + t('lab.failsGate')}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="card">
            <h3>🚀 {t('lab.publish')}</h3>
            <label>{t('lab.changeNotes')}</label>
            <input value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} />
            <label>{t('lab.riskNotes')}</label>
            <input value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)} />
            <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy} onClick={publish}>🚀 {t('lab.publish')}</button>
            <button className="btn sm block" style={{ marginTop: 6 }} onClick={() => nav('/chain')}>⛓ {t('lab.chainRegister')} →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
