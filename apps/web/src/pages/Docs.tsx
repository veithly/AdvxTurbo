import React from 'react';
import { useT } from '../i18n/index.js';
import { api } from '../api.js';
import { useToast } from '../ui.js';
import { sfx } from '../audio.js';

const ENDPOINTS: Array<[string, string, string, string]> = [
  ['GET', '/agent/worker', 'worker:read', 'Read worker context'],
  ['GET', '/agent/worker/strategy', 'strategy:read', 'Read current strategy code'],
  ['POST', '/agent/worker/simulations', 'strategy:simulate', 'Run fixed-seed simulation'],
  ['POST', '/agent/worker/compare', 'strategy:simulate', 'A/B compare two versions'],
  ['POST', '/agent/worker/versions', 'strategy:publish', 'Create a draft version'],
  ['POST', '/agent/worker/versions/{id}/publish', 'strategy:publish', 'Publish a version'],
  ['GET', '/agent/worker/matches', 'match:read', 'List recent matches'],
  ['POST', '/agent/worker/challenges', 'challenge:create', 'Create a challenge'],
  ['GET', '/opponents', 'worker:read', 'List public opponents'],
  ['GET', '/leaderboards', 'worker:read', 'Read leaderboards'],
  ['GET', '/tournaments', 'tournament:read', 'List tournaments'],
  ['POST', '/tournaments/{id}/entries', 'tournament:enter_free', 'Enter a free tournament'],
  ['GET', '/chain/worker-status', 'worker:read', 'Read on-chain worker status'],
];

const RUNTIME = `// Strategy entry point — pure, deterministic, no side effects.
function onIdle(me, coworkers, office) {
  // me: { id, role, energy, blame, position, objectives }
  // coworkers: Array<{ id, role, position, status }>
  // office: { phase, bugs, tasks, releaseProgress, stability }
  const bug = office.bugs.find(b => b.severity === 'p0');
  if (bug) return actions.fix({ bugId: bug.id });
  return actions.work();
}`;

const PROMPT = `You are tuning an AI worker in "Blame Game".
Priorities: 1) ship the project; 2) lower final blame without false accusations;
3) raise verifiable contribution; 4) complete secret objectives; 5) keep code simple & deterministic.
Workflow: GET /v1/agent/worker → read strategy & recent failed replays →
propose ≤3 concrete changes → run fixed-seed A/B (POST /v1/agent/worker/simulations) →
publish only if success rate does not drop and no hard timeout.

你正在调优《谁来背锅？》的 AI 员工。优先级：确保项目上线 > 降低背锅 > 提高贡献 > 完成秘密目标 > 保持确定性。
流程：读取上下文与失败回放 → 提出不超过 3 个改动 → 固定种子 A/B 回归 → 达标才发布。`;

export function Docs() {
  const t = useT();
  const toast = useToast();
  const base = (api.base || location.origin) + '/v1';

  function copyPrompt() {
    sfx('click', 0.3);
    navigator.clipboard.writeText(PROMPT);
    toast.show(t('common.copied'));
  }

  return (
    <div className="content">
      <h2 className="page-title">📖 {t('docs.title')}</h2>

      <div className="card">
        <h3>{t('docs.apiBase')}</h3>
        <code>{base}</code>
        <p className="small muted" style={{ marginTop: 8 }}>Authorization: Bearer &lt;worker_key&gt;</p>
      </div>

      <div className="card">
        <h3>{t('docs.endpoints')}</h3>
        <table className="tbl">
          <thead><tr><th>Method</th><th>Endpoint</th><th>Scope</th><th>Desc</th></tr></thead>
          <tbody>
            {ENDPOINTS.map(([m, ep, scope, desc]) => (
              <tr key={m + ep}>
                <td><span className="tag gray">{m}</span></td>
                <td className="small"><code>{ep}</code></td>
                <td className="small muted">{scope}</td>
                <td className="small">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>{t('docs.runtime')}</h3>
        <pre className="code">{RUNTIME}</pre>
        <p className="small muted">
          Sandbox forbids: <code>fetch</code>, <code>require</code>, <code>process</code>, <code>eval</code>,
          <code>Function</code>, <code>fs</code>, <code>WebSocket</code>, infinite loops.
        </p>
      </div>

      <div className="card dark">
        <div className="row between">
          <h3>{t('office.prompt')}</h3>
          <button className="btn sm cyan" onClick={copyPrompt}>📋 {t('docs.copyPrompt')}</button>
        </div>
        <pre className="code">{PROMPT}</pre>
      </div>
    </div>
  );
}
