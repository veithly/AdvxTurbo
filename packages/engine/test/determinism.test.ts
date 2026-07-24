import assert from 'node:assert';
import { simulateMatch } from '../src/index.js';
import {
  DEFAULT_RULESET,
  STRATEGY_BALANCED,
  STRATEGY_FIREFIGHTER,
  STRATEGY_GRINDER,
  STRATEGY_POLITICIAN,
  sha256Prefixed,
  MVP_ROLES,
} from '@blame/shared';
import type { SimulateInput } from '@blame/shared';

const strategies = [STRATEGY_FIREFIGHTER, STRATEGY_BALANCED, STRATEGY_GRINDER, STRATEGY_POLITICIAN];

function makeInput(seed: string): SimulateInput {
  return {
    matchId: 'mat_test_1',
    mode: 'ranked',
    ruleset: DEFAULT_RULESET,
    finalSeed: seed,
    seedCommitment: sha256Prefixed('server-secret-1'),
    participants: MVP_ROLES.map((role, i) => ({
      workerId: 'wrk_' + i,
      seat: i,
      name: 'Worker ' + i,
      role,
      strategyVersionId: 'ver_' + i,
      strategyHash: sha256Prefixed('code' + i),
      sourceCode: strategies[i],
    })),
  };
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log('  \u2713', name); }
  else { fail++; console.error('  \u2717 FAIL:', name); }
}

console.log('== 引擎确定性与正确性测试 ==');

const seed = sha256Prefixed('final-seed-abc');
const a = simulateMatch(makeInput(seed));
const b = simulateMatch(makeInput(seed));

check('同种子 resultHash 一致 (PRD 64.1)', a.result.resultHash === b.result.resultHash);
check('同种子 replayHash 一致', a.result.replayHash === b.result.replayHash);
check('4 名参赛者结算完整', a.result.participants.length === 4);
check('名次为 1..4 无重复', new Set(a.result.participants.map((p) => p.placement)).size === 4);
check('存在唯一背锅者', !!a.result.scapegoatWorkerId);
check('帧序列非空 (可回放)', a.frames.length > 400);
check('时间线事件非空', a.timeline.length > 0);
check('无效动作率 < 3% (PRD 22.3)', (a.result.metrics.invalidActionRate ?? 1) < 0.03);
check('CPU p95 有记录', a.result.metrics.strategyCpuP95Ms >= 0);

// 不同种子应产生不同回放
const c = simulateMatch(makeInput(sha256Prefixed('final-seed-xyz')));
check('不同种子 -> 不同 replayHash', a.result.replayHash !== c.result.replayHash);

// 超时策略应进入 safeMode 且比赛继续
const timeoutInput = makeInput(seed);
timeoutInput.participants[0].sourceCode = 'function onIdle(me,co,of){ var x=0; for(var i=0;i<1e9;i++){x+=i;} return actions.idle(); }';
const t = simulateMatch(timeoutInput);
check('超时策略比赛仍完成 (PRD 21.4 安全回退)', t.result.participants.length === 4);

// 非法 API 应被静态检查拒绝并回退
const illegalInput = makeInput(seed);
illegalInput.participants[1].sourceCode = 'function onIdle(me,co,of){ return require("fs"); }';
const il = simulateMatch(illegalInput);
check('非法 API 策略不崩溃', il.result.participants.length === 4);

// 结果状态合法
const validStatuses = ['success', 'fail_incomplete', 'fail_crash', 'fail_p0', 'fail_noship'];
check('结果状态合法: ' + a.result.resultStatus, validStatuses.includes(a.result.resultStatus));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
console.log('背锅者:', a.result.scapegoatWorkerId, '| 标题:', a.result.titleKey, '| 状态:', a.result.resultStatus, '| MemeHeat:', a.result.memeHeat);
console.log('名次:', a.result.participants.map((p) => `${p.workerId}#${p.placement}(blame ${p.finalBlame},score ${p.finalScore})`).join(', '));

if (fail > 0) process.exit(1);
