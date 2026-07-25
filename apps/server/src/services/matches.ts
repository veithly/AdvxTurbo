import { db, now } from '../db.js';
import { id, sha256, token as randToken } from '../util.js';
import { simulateMatch } from '@blame/engine';
import { DEFAULT_RULESET, ENGINE_VERSION, RULESET_VERSION, sha256Prefixed, getMode } from '@blame/shared';
import type { SimulateInput, MatchReplay, RoleId } from '@blame/shared';
import { getWorker } from './workers.js';
import { getVersion, saveReplay } from './strategies.js';
import { matchLeaf, submitMatchBatch, anchorMatchOnChain } from '../chain/gateway.js';
import * as economy from './economy.js';

// PRD 34.2 种子流程 (commit-reveal 混合)
function makeSeed(matchId: string, participantWorkerIds: string[]) {
  const serverSecret = randToken();
  const serverCommit = sha256Prefixed('commit:' + serverSecret);
  const participantEntropy = participantWorkerIds.map((w) => sha256('entropy:' + w)).sort();
  const finalizedBlockHash = sha256('block:' + matchId); // mock finalized block
  const finalSeed = sha256Prefixed([serverSecret, matchId, finalizedBlockHash, ...participantEntropy].join('|'));
  return { serverSecret, serverCommit, finalSeed, finalSeedHash: sha256Prefixed('fs:' + finalSeed) };
}

/** 反串谋对手搜索 (PRD 18.5/52.3)：按 rating 接近、排除同一 user；志愿者（工作人员阵营）不作为对手 */
export function findOpponents(worker: any, count: number): any[] {
  const rows = db
    .prepare(
      "SELECT * FROM workers WHERE id != ? AND user_id != ? AND status = ? AND COALESCE(appearance_json, '') NOT LIKE '%\"volunteer\":true%' ORDER BY ABS(rating - ?) ASC LIMIT ?"
    )
    .all(worker.id, worker.user_id, 'active', worker.rating, count * 3) as any[];
  // 取最接近的 count 个（已按 rating 距离排序）
  return rows.slice(0, count);
}

function participantFromWorker(w: any, seat: number) {
  const ver = getVersion(w.current_ranked_version_id) || { id: 'default', source_code: '', source_hash: '0x0' };
  return {
    workerId: w.id,
    seat,
    name: w.name,
    role: w.role as RoleId,
    strategyVersionId: ver.id,
    strategyHash: sha256Prefixed(ver.source_hash || w.id),
    sourceCode: ver.source_code || '',
  };
}

/** 运行一场正式排位赛 (PRD 19.1)；staffWorkerIds 为玩家的志愿者，占用工作人员席位进入模拟 */
export function runRankedMatch(workerIds: string[], mode = 'ranked', tournamentId?: string, modeId = 'ranked', staffWorkerIds?: string[]): { matchId: string; replay: MatchReplay } {
  const workers = workerIds.map((wid) => getWorker(wid)).filter(Boolean);
  if (workers.length < 2) throw new Error('NOT_ENOUGH_WORKERS');
  const staffWorkers = (staffWorkerIds || []).map((wid) => getWorker(wid)).filter(Boolean).slice(0, 5);
  const matchId = id('mat');
  const seed = makeSeed(matchId, workers.map((w) => w.id));

  const gm = getMode(modeId);
  const scenario = { id: gm.id, winCondition: gm.winCondition, winnerTitleKey: gm.winnerTitleKey, successOverride: gm.successOverride, noScapegoatPenalty: gm.noScapegoatPenalty, eventBias: gm.eventBias };

  const input: SimulateInput = {
    matchId,
    mode,
    ruleset: { ...DEFAULT_RULESET, players: workers.length, scenario },
    finalSeed: seed.finalSeed,
    seedCommitment: seed.serverCommit,
    participants: workers.map((w, i) => participantFromWorker(w, i)),
    staffParticipants: staffWorkers.map((w) => ({ workerId: w.id, name: w.name })),
  };

  const replay = simulateMatch(input);
  const res = replay.result;
  saveReplay(matchId, replay);

  db.prepare(
    `INSERT INTO matches (id, mode, status, engine_version, engine_hash, ruleset_version, ruleset_hash, map_id, map_hash, event_deck_hash, server_seed_commit, server_seed_reveal, final_seed, final_seed_hash, result_status, project_success, scapegoat_worker_id, title_key, meme_heat, result_hash, replay_hash, tournament_id, started_at, finished_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    matchId, mode, 'verified', ENGINE_VERSION, sha256Prefixed(ENGINE_VERSION), RULESET_VERSION, res.rulesetHash,
    'open-office-hell', res.mapHash, res.eventDeckHash, seed.serverCommit, seed.serverSecret, seed.finalSeed, seed.finalSeedHash,
    res.resultStatus, res.projectSuccess ? 1 : 0, res.scapegoatWorkerId, res.titleKey, res.memeHeat, res.resultHash, res.replayHash,
    tournamentId || null, res.startedAt, res.finishedAt
  );
  db.prepare('UPDATE matches SET winner_worker_id=?, mode_id=? WHERE id=?').run(res.winnerWorkerId || null, res.modeId || 'ranked', matchId);

  // 参赛者 + 评分更新
  const ratingBefore: Record<string, number> = {};
  for (const w of workers) ratingBefore[w.id] = w.rating;
  const ratingAfter = updateRatings(workers, res.participants);

  for (const p of res.participants) {
    const w = workers.find((x) => x.id === p.workerId)!;
    db.prepare(
      `INSERT INTO match_participants (match_id, seat_index, worker_id, strategy_version_id, strategy_hash, role, spawn_index, final_score, placement, project_success, final_blame, verified_contribution, reputation, scapegoat, rating_before, rating_after)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      matchId, p.seat, p.workerId, p.strategyVersionId, p.strategyHash, p.role, p.seat, p.finalScore, p.placement,
      p.projectSuccess ? 1 : 0, p.finalBlame, p.verifiedContribution, p.reputation, p.scapegoat ? 1 : 0,
      ratingBefore[p.workerId] ?? 1200, ratingAfter[p.workerId] ?? 1200
    );
    if (mode === 'ranked') {
      db.prepare('UPDATE workers SET games=games+1, project_successes=project_successes+?, wins=wins+?, blame_sum=blame_sum+?, win_streak=CASE WHEN ? THEN win_streak+1 ELSE 0 END WHERE id=?')
        .run(p.projectSuccess ? 1 : 0, p.placement === 1 ? 1 : 0, p.finalBlame, p.placement === 1 ? 1 : 0, p.workerId);
    }
  }

  // 志愿者工作人员：累计抓捕数与执勤场次（抓捕榜）
  if (mode === 'ranked') {
    for (const s of res.staff || []) {
      if (s.volunteer) db.prepare('UPDATE workers SET catches_sum=COALESCE(catches_sum,0)+?, patrols=COALESCE(patrols,0)+1 WHERE id=?').run(s.catches, s.id);
    }
  }

  // 链上批次锚定 (PRD 32) — 排位赛立即成一小批次演示
  if (mode === 'ranked') {
    try {
      const leaf = matchLeaf({ matchId, mode, engineHash: sha256Prefixed(ENGINE_VERSION), rulesetHash: res.rulesetHash, mapHash: res.mapHash, eventDeckHash: res.eventDeckHash, seedCommitment: seed.serverCommit, finalSeed: seed.finalSeed, resultHash: res.resultHash, replayHash: res.replayHash });
      const batch = submitMatchBatch([leaf]);
      db.prepare('UPDATE matches SET batch_id=? WHERE id=?').run(batch.batchId, matchId);
      // 真实链上锚定（live 模式，限频）：fire-and-forget，不阻塞比赛
      anchorMatchOnChain(res.replayHash).catch(() => {});
    } catch (e) {
      // 链不可用时不阻塞游戏
    }
    // 经济：按名次发放 Coffee Points + 质押派息 + 赛季 XP
    try {
      const ownerOf = (wid: string) => workers.find((w) => w.id === wid)?.user_id as string | undefined;
      economy.rewardMatch(res.participants.map((p) => ({ workerId: p.workerId, placement: p.placement })), ownerOf);
      for (const w of workers) { const uid = w.user_id; if (uid) economy.addSeasonXp(uid, 20); }
    } catch (e) {
      // 经济结算失败不阻塞比赛
    }
  }

  return { matchId, replay };
}

// PRD 18.3 OpenSkill 风格：按名次成对更新 + sigma 收敛
function updateRatings(workers: any[], participants: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  const K = 32;
  const byId: Record<string, any> = Object.fromEntries(workers.map((w) => [w.id, w]));
  for (const w of workers) out[w.id] = w.rating;
  for (const a of participants) {
    const wa = byId[a.workerId];
    if (!wa) continue;
    let delta = 0;
    for (const b of participants) {
      if (a.workerId === b.workerId) continue;
      const wb = byId[b.workerId];
      if (!wb) continue;
      const expected = 1 / (1 + Math.pow(10, (wb.rating - wa.rating) / 400));
      const actual = a.placement < b.placement ? 1 : a.placement > b.placement ? 0 : 0.5;
      delta += (actual - expected);
    }
    const games = wa.games || 0;
    const kFactor = games < 10 ? K * 1.6 : K; // 新 Agent 高不确定度定级
    const newRating = Math.max(0, Math.round(wa.rating + (kFactor * delta) / Math.max(1, participants.length - 1)));
    const newSigma = Math.max(60, (wa.rating_sigma || 350) * 0.97);
    out[a.workerId] = newRating;
    db.prepare('UPDATE workers SET rating=?, rating_mu=?, rating_sigma=?, best_rating=MAX(COALESCE(best_rating,1200),?) WHERE id=?').run(newRating, newRating, newSigma, newRating, a.workerId);
  }
  return out;
}

export function getMatch(matchId: string): any {
  return db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
}

export function matchParticipants(matchId: string): any[] {
  return db.prepare(
    `SELECT mp.*, w.name AS worker_name, w.agent_tool AS agent_tool, w.appearance_json AS appearance_json, u.display_name AS owner
     FROM match_participants mp LEFT JOIN workers w ON w.id = mp.worker_id LEFT JOIN users u ON u.id = w.user_id
     WHERE mp.match_id = ? ORDER BY mp.placement`
  ).all(matchId) as any[];
}

export function recentMatches(limit = 30, workerId?: string): any[] {
  if (workerId) {
    return db
      .prepare('SELECT m.* FROM matches m JOIN match_participants p ON p.match_id = m.id WHERE p.worker_id = ? ORDER BY m.finished_at DESC LIMIT ?')
      .all(workerId, limit) as any[];
  }
  return db.prepare('SELECT * FROM matches ORDER BY finished_at DESC LIMIT ?').all(limit) as any[];
}

/** 热门事故卡片 (Home) — 按 MemeHeat 排序 */
export function hotMatches(limit = 8): any[] {
  return db.prepare('SELECT * FROM matches ORDER BY meme_heat DESC, finished_at DESC LIMIT ?').all(limit) as any[];
}

// PRD 45.4 排行榜（catch = 工作人员抓捕榜：志愿者按累计抓捕数排序）
export function leaderboard(kind = 'rating', limit = 50): any[] {
  if (kind === 'catch') {
    return db
      .prepare('SELECT w.*, u.display_name AS owner FROM workers w JOIN users u ON u.id = w.user_id WHERE COALESCE(w.patrols, 0) > 0 ORDER BY COALESCE(w.catches_sum, 0) DESC, COALESCE(w.patrols, 0) ASC LIMIT ?')
      .all(limit) as any[];
  }
  const order = kind === 'meme' ? 'wins DESC' : kind === 'stable' ? '(project_successes*1.0/(games+1)) DESC' : 'rating DESC';
  return db
    .prepare(`SELECT w.*, u.display_name AS owner FROM workers w JOIN users u ON u.id = w.user_id WHERE w.games > 0 ORDER BY ${order} LIMIT ?`)
    .all(limit) as any[];
}
