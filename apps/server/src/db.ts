import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../data');
export const REPLAY_DIR = path.join(DATA_DIR, 'replays');
fs.mkdirSync(REPLAY_DIR, { recursive: true });

const DB_PATH = process.env.BLAME_DB || path.join(DATA_DIR, 'blame.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// PRD 48.2 主要表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active',
  display_name TEXT,
  email TEXT UNIQUE,
  password_hash TEXT,
  locale TEXT DEFAULT 'zh',
  country_code TEXT,
  risk_score REAL DEFAULT 0,
  terms_version TEXT DEFAULT '1.0',
  created_at TEXT,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS wallet_links (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  chain_family TEXT,
  chain_id INTEGER,
  address_normalized TEXT,
  address_display TEXT,
  is_primary INTEGER DEFAULT 1,
  verified_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT,
  role TEXT,
  appearance_json TEXT,
  personality_text TEXT,
  status TEXT DEFAULT 'active',
  public_challenge_enabled INTEGER DEFAULT 1,
  current_ranked_version_id TEXT,
  current_pve_version_id TEXT,
  passport_network TEXT,
  passport_token_id TEXT,
  passport_worker_hash TEXT,
  rating_mu REAL DEFAULT 1200,
  rating_sigma REAL DEFAULT 350,
  rating REAL DEFAULT 1200,
  games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  project_successes INTEGER DEFAULT 0,
  blame_sum REAL DEFAULT 0,
  agent_tool TEXT DEFAULT 'claude_code',
  win_streak INTEGER DEFAULT 0,
  best_rating REAL DEFAULT 1200,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS worker_keys (
  id TEXT PRIMARY KEY,
  worker_id TEXT,
  owner_user_id TEXT,
  prefix TEXT,
  secret_hash TEXT,
  name TEXT,
  scopes TEXT,
  rate_limit_profile TEXT DEFAULT 'default',
  created_at TEXT,
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id TEXT PRIMARY KEY,
  worker_id TEXT,
  semver TEXT,
  parent_id TEXT,
  source_code TEXT,
  source_hash TEXT,
  artifact_hash TEXT,
  compiler_version TEXT,
  runtime_api_version TEXT,
  ruleset_compatibility TEXT,
  submitted_by TEXT,
  model_provider TEXT,
  model_name TEXT,
  change_notes TEXT,
  risk_notes TEXT,
  status TEXT DEFAULT 'draft',
  chain_tx_hash TEXT,
  created_at TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  worker_id TEXT,
  candidate_hash TEXT,
  baseline_version_id TEXT,
  suite_type TEXT,
  status TEXT,
  seeds INTEGER,
  metrics_json TEXT,
  ab_json TEXT,
  behavior_diff_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mode TEXT,
  status TEXT,
  engine_version TEXT,
  engine_hash TEXT,
  ruleset_version TEXT,
  ruleset_hash TEXT,
  map_id TEXT,
  map_hash TEXT,
  event_deck_hash TEXT,
  server_seed_commit TEXT,
  server_seed_reveal TEXT,
  final_seed TEXT,
  final_seed_hash TEXT,
  result_status TEXT,
  project_success INTEGER,
  scapegoat_worker_id TEXT,
  title_key TEXT,
  meme_heat INTEGER,
  result_hash TEXT,
  replay_hash TEXT,
  batch_id INTEGER,
  tournament_id TEXT,
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS match_participants (
  match_id TEXT,
  seat_index INTEGER,
  worker_id TEXT,
  strategy_version_id TEXT,
  strategy_hash TEXT,
  role TEXT,
  spawn_index INTEGER,
  final_score REAL,
  placement INTEGER,
  project_success INTEGER,
  final_blame REAL,
  verified_contribution REAL,
  reputation REAL,
  scapegoat INTEGER,
  rating_before REAL,
  rating_after REAL,
  PRIMARY KEY (match_id, seat_index)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  slug TEXT,
  name TEXT,
  organizer_user_id TEXT,
  contract_address TEXT,
  network TEXT,
  status TEXT,
  ruleset_hash TEXT,
  eligibility_hash TEXT,
  reward_token TEXT,
  reward_token_symbol TEXT,
  token_decimals INTEGER,
  prize_pool_base_units TEXT,
  entry_fee_base_units TEXT,
  payouts_json TEXT,
  registration_close TEXT,
  roster_lock TEXT,
  start_time TEXT,
  challenge_period INTEGER,
  claim_deadline TEXT,
  result_root TEXT,
  payout_root TEXT,
  funded INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id TEXT PRIMARY KEY,
  tournament_id TEXT,
  worker_id TEXT,
  user_id TEXT,
  strategy_version_id TEXT,
  strategy_hash TEXT,
  placement INTEGER,
  reward_base_units TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS reward_claims (
  id TEXT PRIMARY KEY,
  tournament_id TEXT,
  worker_id TEXT,
  user_id TEXT,
  amount_base_units TEXT,
  token TEXT,
  status TEXT,
  tx_hash TEXT,
  claimed_at TEXT
);

CREATE TABLE IF NOT EXISTS chain_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER,
  block_number INTEGER,
  block_hash TEXT,
  tx_hash TEXT,
  log_index INTEGER,
  contract_address TEXT,
  event_name TEXT,
  decoded_json TEXT,
  observed_at TEXT,
  finalized_at TEXT,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS match_batches (
  batch_id INTEGER PRIMARY KEY,
  merkle_root TEXT,
  engine_set_hash TEXT,
  manifest_hash TEXT,
  match_count INTEGER,
  start_time TEXT,
  end_time TEXT,
  manifest_uri TEXT,
  tx_hash TEXT,
  invalidated INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mp_worker ON match_participants(worker_id);
CREATE INDEX IF NOT EXISTS idx_sv_worker ON strategy_versions(worker_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
`);

// 向后兼容：为既有 DB 增量添加列 (node:sqlite 无 IF NOT EXISTS)
for (const c of ['winner_worker_id TEXT', 'mode_id TEXT']) {
  try { db.exec(`ALTER TABLE matches ADD COLUMN ${c}`); } catch {}
}
for (const c of ["agent_tool TEXT DEFAULT 'claude_code'", 'win_streak INTEGER DEFAULT 0', 'best_rating REAL DEFAULT 1200']) {
  try { db.exec(`ALTER TABLE workers ADD COLUMN ${c}`); } catch {}
}

export function now(): string {
  return new Date().toISOString();
}
