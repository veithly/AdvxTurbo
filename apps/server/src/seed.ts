import { db } from './db.js';
import * as accounts from './services/accounts.js';
import * as workers from './services/workers.js';
import * as strategies from './services/strategies.js';
import * as matches from './services/matches.js';
import * as tournaments from './services/tournaments.js';
import * as chain from './chain/gateway.js';
import { STRATEGY_LIBRARY, MVP_ROLES } from '@blame/shared';
import type { RoleId } from '@blame/shared';

chain.initChain();

function clearAll() {
  for (const t of ['reward_claims', 'tournament_entries', 'tournaments', 'match_participants', 'matches', 'simulation_runs', 'strategy_versions', 'worker_keys', 'workers', 'wallet_links', 'sessions', 'users', 'chain_events', 'chain_passports', 'chain_balances', 'faucet_log', 'strategy_registrations', 'match_batches']) {
    try { db.exec(`DELETE FROM ${t};`); } catch {}
  }
}

const NAMES = [
  ['橘子', 'Tangerine'],
  ['卡皮', 'Capy'],
  ['鹅总', 'Goosezilla'],
  ['浣浣', 'Rocket'],
  ['柴总', 'ShibaOps'],
  ['仓仓', 'Hammy'],
  ['豆豆', 'Beans'],
  ['可乐', 'Cola'],
];
const STRATS = ['balanced', 'firefighter', 'grinder', 'politician'];

console.log('== Seeding BLAME GAME ==');
clearAll();

const workerIds: string[] = [];
const userTokens: Record<string, string> = {};

for (let i = 0; i < 8; i++) {
  const email = `player${i + 1}@blame.game`;
  const { user, token } = accounts.register(email, 'test1234', NAMES[i][1] + 'Corp', i % 2 === 0 ? 'zh' : 'en');
  userTokens[user.id] = token;
  // 绑定钱包 + 领水 + 铸 Passport (前 6 位玩家)
  const addr = '0x' + (i + 1).toString().padStart(40, '0');
  accounts.linkWallet(user.id, addr, chain.chainInfo().chainId);
  if (i < 6) chain.faucet(addr);

  const role = MVP_ROLES[i % MVP_ROLES.length] as RoleId;
  const cn = NAMES[i][0];
  const en = NAMES[i][1];
  const w = workers.createWorker(user.id, `${cn} / ${en}`, role, { color: ['#D8702B', '#7B53A5', '#4B8955', '#499CBE'][i % 4] }, '喜欢在最后一秒发布');
  workerIds.push(w.id);

  // 发布一个与初始不同的策略版本 (展示迭代)
  const stratKey = STRATS[i % STRATS.length];
  const code = STRATEGY_LIBRARY[stratKey].code;
  const created = strategies.createVersion(w.id, code, { submittedBy: 'agent', modelProvider: 'anthropic', modelName: 'claude', changeNotes: `采用 ${stratKey} 档案`, riskNotes: '低事故种子贡献可能下降' });
  if (created.staticCheck.ok) strategies.publishVersion(created.version.id, 'ranked');

  if (i < 6) {
    const mint = chain.mintPassport(w.id, addr, { name: w.name, role });
    const v = workers.getWorker(w.id).current_ranked_version_id;
    const ver = strategies.getVersion(v);
    chain.registerStrategy(mint.tokenId, ver.source_hash, '0x0', `/api/versions/${v}`);
  }
  // 每个 worker 生成一个 Worker Key (供 Agent 演示)
  const key = workers.createKey(w.id, user.id, 'seed-key');
  if (i === 0) console.log(`  Player1 workerId=${w.id}  WorkerKey=${key.plaintext}`);
}

// 运行 24 场排位赛 (确定性分组)
console.log('  Running ranked matches...');
let sample = '';
for (let m = 0; m < 24; m++) {
  const shuffled = [...workerIds].sort((a, b) => (a + m).localeCompare(b + m));
  const group = shuffled.slice(0, 4);
  const { matchId } = matches.runRankedMatch(group, 'ranked');
  if (m === 0) sample = matchId;
}

// 创建并运行一个赞助赛事
console.log('  Creating & running tournament...');
const organizer = db.prepare('SELECT user_id FROM workers WHERE id = ?').get(workerIds[0]) as any;
const trn = tournaments.createTournament({ name: 'Friday Release Cup #1', organizerUserId: organizer.user_id });
for (const wid of workerIds) {
  const uid = (db.prepare('SELECT user_id FROM workers WHERE id = ?').get(wid) as any).user_id;
  tournaments.enterTournament(trn.id, wid, uid);
}
const ran = tournaments.runTournament(trn.id);

const leaderboard = matches.leaderboard('rating', 10);
console.log('\n== Seed complete ==');
console.log('  Users: 8 | Workers:', workerIds.length, '| Matches: 24 | Tournament:', ran.name);
console.log('  Sample matchId:', sample);
console.log('  Top worker:', leaderboard[0]?.name, 'rating', Math.round(leaderboard[0]?.rating));
console.log('  Login: player1@blame.game / test1234');
console.log('  Chain events:', chain.recentChainEvents(1000).length);
process.exit(0);
