import { test, expect, request } from '@playwright/test';
import { STRATEGY_FIREFIGHTER } from '@blame/shared';

const API = process.env.API_URL || 'http://localhost:4000';

// PRD 验收 64.2 Agent + 多人测试：注册 → 建员工 → Worker Key → 读上下文 → 模拟 → 发布 → 正式比赛 → 可验证回放
test('AI Agent 完整循环 + 多人比赛 + 链上锚定', async () => {
  const ctx = await request.newContext({ baseURL: API });
  const email = `e2e_${Date.now()}@blame.game`;

  // 注册用户
  const reg = await (await ctx.post('/api/auth/register', { data: { email, password: 'test1234', displayName: 'E2E Corp', locale: 'zh' } })).json();
  const token = reg.token;
  const authed = await request.newContext({ baseURL: API, extraHTTPHeaders: { authorization: `Bearer ${token}` } });

  // 创建员工
  const worker = await (await authed.post('/api/workers', { data: { name: 'E2E Cat', role: 'engineer', appearance: {}, personality: 'e2e' } })).json();
  expect(worker.id).toBeTruthy();

  // 创建 Worker Key
  const key = await (await authed.post(`/api/workers/${worker.id}/keys`, { data: { name: 'e2e' } })).json();
  expect(key.plaintext).toMatch(/^wk_/);
  const agent = await request.newContext({ baseURL: API, extraHTTPHeaders: { authorization: `Bearer ${key.plaintext}` } });

  // 1) Agent 读上下文 (PRD 23.3)
  const context = await (await agent.get('/v1/agent/worker')).json();
  expect(context.worker.id).toBe(worker.id);
  expect(context.ruleset.runtimeApiVersion).toBe('1.0');

  // 2) 模拟候选策略 (regression A/B)
  const sim = await (await agent.post('/v1/agent/worker/simulations', {
    data: { candidate: { sourceCode: STRATEGY_FIREFIGHTER }, suite: { type: 'regression' } },
  })).json();
  expect(sim.simulationId).toBeTruthy();
  expect(sim.result.candidate.projectSuccessRate).toBeGreaterThanOrEqual(0);

  // 3) 创建并发布新版本 (PRD 23.5)
  const created = await (await agent.post('/v1/agent/worker/versions', {
    data: { sourceCode: STRATEGY_FIREFIGHTER, submittedBy: 'agent', model: { provider: 'anthropic', name: 'claude' }, changeNotes: 'E2E firefighter', riskNotes: '低事故贡献下降' },
  })).json();
  expect(created.version.id).toBeTruthy();
  const pub = await (await agent.post(`/v1/agent/worker/versions/${created.version.id}/publish`, { data: { branch: 'ranked' } })).json();
  expect(pub.status).toBe('published');

  // 4) 非法 API 应被静态检查拒绝 (PRD 21.5)
  const illegal = await agent.post('/v1/agent/worker/versions', { data: { sourceCode: 'function onIdle(){ return require("fs"); }' } });
  expect(illegal.status()).toBe(422);

  // 5) 发起正式挑战 (多人比赛，对手来自其它 seed 用户)
  const challenge = await agent.post('/v1/agent/worker/challenges', {});
  expect(challenge.ok()).toBeTruthy();
  const ch = await challenge.json();
  expect(ch.matchId).toBeTruthy();

  // 6) 读取 Agent JSON 回放 (不含对手源码) + 链上批次
  const replay = await (await ctx.get(`/api/matches/${ch.matchId}/agent.json`)).json();
  expect(replay.participants.length).toBeGreaterThanOrEqual(2);
  expect(replay.verification.replayHash).toMatch(/^0x/);
  const rawSrc = JSON.stringify(replay);
  expect(rawSrc).not.toContain('function onIdle'); // 回放不泄露源码

  const match = await (await ctx.get(`/api/matches/${ch.matchId}`)).json();
  expect(match.batch_id).toBeTruthy(); // 已锚定到链上批次

  // 7) 链上状态
  const chainStatus = await (await agent.get('/v1/chain/worker-status')).json();
  expect(chainStatus.network).toContain('injective');
});
