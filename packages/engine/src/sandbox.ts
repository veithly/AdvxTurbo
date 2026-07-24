import vm from 'node:vm';
import type { AgentAction } from '@blame/shared';
import { Rng } from '@blame/shared';

// PRD 21.2 禁止能力 — 发布前/编译前静态检查 (21.5)
const FORBIDDEN_PATTERNS: Array<[RegExp, string]> = [
  [/\brequire\s*\(/, 'require'],
  [/\bimport\b/, 'import'],
  [/\bprocess\b/, 'process'],
  [/\bglobalThis\b/, 'globalThis'],
  [/\beval\s*\(/, 'eval'],
  [/\bFunction\s*\(/, 'Function constructor'],
  [/\bfetch\s*\(/, 'fetch'],
  [/\bXMLHttpRequest\b/, 'XHR'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\bfs\b/, 'fs'],
  [/\bchild_process\b/, 'child_process'],
  [/\bwhile\s*\(\s*true\s*\)/, 'while(true) infinite loop'],
  [/\bfor\s*\(\s*;\s*;\s*\)/, 'for(;;) infinite loop'],
  [/\b__proto__\b/, '__proto__'],
  [/\bconstructor\s*\[/, 'reflective constructor access'],
];

export interface StaticCheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  hasOnIdle: boolean;
  hasOnAudit: boolean;
  bytes: number;
}

export function staticCheck(source: string, sourceBytesMax = 65536): StaticCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes > sourceBytesMax) errors.push(`SOURCE_TOO_LARGE:${bytes}>${sourceBytesMax}`);
  for (const [re, name] of FORBIDDEN_PATTERNS) {
    if (re.test(source)) errors.push(`FORBIDDEN_API:${name}`);
  }
  const hasOnIdle = /function\s+onIdle\s*\(/.test(source);
  const hasOnAudit = /function\s+onAudit\s*\(/.test(source);
  if (!hasOnIdle) errors.push('MISSING_ENTRY:onIdle');
  // 圈复杂度粗略提示
  const branches = (source.match(/\b(if|for|while|case|&&|\|\|)\b/g) || []).length;
  if (branches > 120) warnings.push('HIGH_COMPLEXITY');
  return { ok: errors.length === 0, errors, warnings, hasOnIdle, hasOnAudit, bytes };
}

// 动作工厂 — 返回纯描述对象 (PRD 15.1)
const ACTION_FACTORY_SRC = `
var __mk = function(type){ return function(o){ o = o || {}; o.type = type; return o; }; };
var actions = {
  moveTo: __mk('moveTo'),
  claimTask: __mk('claimTask'),
  work: __mk('work'),
  help: __mk('help'),
  inspect: __mk('inspect'),
  review: __mk('review'),
  fix: __mk('fix'),
  assign: __mk('assign'),
  forceAssign: __mk('forceAssign'),
  coffee: __mk('coffee'),
  fakeWork: __mk('fakeWork'),
  hide: __mk('hide'),
  rollback: __mk('rollback'),
  disclose: __mk('disclose'),
  escalate: __mk('escalate'),
  ship: __mk('ship'),
  useSkill: __mk('useSkill'),
  takeCredit: __mk('takeCredit'),
  speak: __mk('speak'),
  promise: __mk('promise'),
  praise: __mk('praise'),
  accuse: __mk('accuse'),
  defend: __mk('defend'),
  confess: __mk('confess'),
  submitEvidence: __mk('submitEvidence'),
  staySilent: __mk('staySilent'),
  idle: __mk('idle')
};
`;

export interface CompiledStrategy {
  ok: boolean;
  error?: string;
  hasOnAudit: boolean;
  callIdle(me: unknown, coworkers: unknown, office: unknown, rng: Rng, hardMs: number): CallOutcome;
  callAudit(me: unknown, coworkers: unknown, office: unknown, rng: Rng, hardMs: number): CallOutcome;
}

export interface CallOutcome {
  action: AgentAction | null;
  timedOut: boolean;
  error?: string;
  elapsedMs: number;
}

interface RngHolder {
  rng: Rng | null;
}

export function compileStrategy(source: string): CompiledStrategy {
  const check = staticCheck(source);
  const holder: RngHolder = { rng: null };
  const noopConsole = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  const sandbox: Record<string, unknown> = {
    console: noopConsole,
    game: { random: () => (holder.rng ? holder.rng.next() : 0) },
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    __in: {},
    __out: null,
  };
  const ctx = vm.createContext(sandbox, { name: 'blame-strategy' });

  if (!check.ok) {
    return {
      ok: false,
      error: check.errors.join(','),
      hasOnAudit: false,
      callIdle: () => ({ action: null, timedOut: false, error: 'COMPILE_FAILED', elapsedMs: 0 }),
      callAudit: () => ({ action: null, timedOut: false, error: 'COMPILE_FAILED', elapsedMs: 0 }),
    };
  }

  try {
    // 覆盖 Math.random 走确定性子流 (PRD 21.3)
    vm.runInContext(ACTION_FACTORY_SRC + '\nMath.random = function(){ return game.random(); };\n' + source, ctx, {
      timeout: 200,
    });
    vm.runInContext(
      'var __onIdle = (typeof onIdle === "function") ? onIdle : null;' +
        'var __onAudit = (typeof onAudit === "function") ? onAudit : null;',
      ctx
    );
  } catch (e) {
    return {
      ok: false,
      error: 'COMPILE_ERROR:' + (e as Error).message,
      hasOnAudit: false,
      callIdle: () => ({ action: null, timedOut: false, error: 'COMPILE_FAILED', elapsedMs: 0 }),
      callAudit: () => ({ action: null, timedOut: false, error: 'COMPILE_FAILED', elapsedMs: 0 }),
    };
  }

  const invoke = (entry: '__onIdle' | '__onAudit', me: unknown, coworkers: unknown, office: unknown, rng: Rng, hardMs: number): CallOutcome => {
    holder.rng = rng;
    (sandbox as any).__in = { me, coworkers, office };
    (sandbox as any).__out = null;
    const start = performance.now();
    try {
      vm.runInContext(
        `__out = ${entry} ? ${entry}(__in.me, __in.coworkers, __in.office) : null;`,
        ctx,
        { timeout: Math.max(1, Math.ceil(hardMs)) }
      );
    } catch (e) {
      const msg = (e as Error).message || '';
      const timedOut = /timed out|Script execution timed out/i.test(msg);
      return { action: null, timedOut, error: timedOut ? 'HARD_TIMEOUT' : 'RUNTIME_ERROR:' + msg, elapsedMs: performance.now() - start };
    }
    const raw = (sandbox as any).__out;
    const elapsedMs = performance.now() - start;
    if (raw == null) return { action: null, timedOut: false, elapsedMs };
    if (typeof raw !== 'object' || typeof (raw as any).type !== 'string') {
      return { action: null, timedOut: false, error: 'INVALID_RETURN', elapsedMs };
    }
    // 复制为纯净对象，剥离潜在的宿主引用
    const a = raw as any;
    const action: AgentAction = {
      type: String(a.type),
      taskId: a.taskId != null ? String(a.taskId) : undefined,
      bugId: a.bugId != null ? String(a.bugId) : undefined,
      workerId: a.workerId != null ? String(a.workerId) : undefined,
      zone: a.zone != null ? String(a.zone) : undefined,
      key: a.key != null ? String(a.key) : undefined,
      debugTag: a.debugTag != null ? String(a.debugTag).slice(0, 40) : undefined,
      interruptIf: Array.isArray(a.interruptIf) ? a.interruptIf.map(String).slice(0, 6) : undefined,
      target: a.target,
    };
    return { action, timedOut: false, elapsedMs };
  };

  return {
    ok: true,
    hasOnAudit: check.hasOnAudit,
    callIdle: (me, cw, off, rng, hardMs) => invoke('__onIdle', me, cw, off, rng, hardMs),
    callAudit: (me, cw, off, rng, hardMs) => invoke('__onAudit', me, cw, off, rng, hardMs),
  };
}
