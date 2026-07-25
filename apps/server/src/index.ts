import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { api } from './routes.js';
import { agentApi } from './agentApi.js';
import { initChain, chainInfo } from './chain/gateway.js';
import { loadReplay } from './services/strategies.js';
import { DEFAULT_RULESET } from '@blame/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ASSETS_DIR = path.join(REPO_ROOT, 'blame_game_8bit_assets_v2');
const AUDIO_DIR = path.join(REPO_ROOT, 'assets_audio');

const PORT = Number(process.env.PORT || 4000);
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 静态：生成的音频（美术全部由前端代码渲染，不再依赖 PNG）
app.use('/audio', express.static(AUDIO_DIR));

app.use('/api', api);
app.use('/v1', agentApi); // PRD 23 Base URL /v1

// 生产环境：serve 前端构建产物
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');
import fs from 'node:fs';
const hasWebDist = fs.existsSync(WEB_DIST);
if (hasWebDist) {
  app.use(express.static(WEB_DIST));
}

app.get('/health', (_req, res) => res.json({ name: 'BLAME GAME API', chain: chainInfo(), status: 'ok' }));

const server = http.createServer(app);

// 实时观战 WebSocket：按 tick 流式推送回放帧 (PRD 45.5)
const wss = new WebSocketServer({ server, path: '/ws/match' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const matchId = url.searchParams.get('id');
  const speed = Math.max(0.25, Math.min(8, Number(url.searchParams.get('speed') || 2)));
  if (!matchId) {
    ws.send(JSON.stringify({ type: 'error', code: 'MISSING_MATCH_ID' }));
    ws.close();
    return;
  }
  const replay = loadReplay(matchId);
  if (!replay) {
    ws.send(JSON.stringify({ type: 'error', code: 'NOT_FOUND' }));
    ws.close();
    return;
  }
  ws.send(JSON.stringify({ type: 'match_start', result: replay.result, totalFrames: replay.frames.length }));
  let i = 0;
  const intervalMs = Math.max(16, DEFAULT_RULESET.tickMs / speed);
  const timelineByTick = new Map<number, any[]>();
  for (const ev of replay.timeline) {
    if (!timelineByTick.has(ev.tick)) timelineByTick.set(ev.tick, []);
    timelineByTick.get(ev.tick)!.push(ev);
  }
  const timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN || i >= replay.frames.length) {
      clearInterval(timer);
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'match_end', result: replay.result }));
      return;
    }
    const frame = replay.frames[i];
    ws.send(JSON.stringify({ type: 'frame', frame, events: timelineByTick.get(frame.tick) || [] }));
    i++;
  }, intervalMs);
  ws.on('close', () => clearInterval(timer));
});

// SPA fallback：所有非 API/静态路径返回 index.html
if (hasWebDist) {
  app.get('*', (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

const mode = initChain();
server.listen(PORT, () => {
  console.log(`\n  《谁来背锅？ / BLAME GAME》 API`);
  console.log(`  ▸ http://localhost:${PORT}`);
  console.log(`  ▸ Chain mode: ${mode} (${chainInfo().name} / chainId ${chainInfo().chainId})`);
  console.log(`  ▸ Web UI: ${hasWebDist ? 'serving from apps/web/dist' : 'not built (dev mode)'}`);
  console.log(`  ▸ Audio: /audio  WS: /ws/match?id=<matchId>\n`);
});
