import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ROLES } from '@blame/shared';
import type { RoleId } from '@blame/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

// ---- 最小 ZIP 打包器 (store / deflate)，零依赖 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry { name: string; data: Buffer; }

export function buildZip(files: Array<{ name: string; content: Buffer | string }>): Buffer {
  const entries: Array<Entry & { crc: number; comp: Buffer; method: number; off: number }> = [];
  const chunks: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const data = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    const deflated = zlib.deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const comp = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const nameBuf = Buffer.from(f.name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);
    entries.push({ name: f.name, data, crc, comp, method, off: offset } as any);
    offset += local.length + nameBuf.length + comp.length;
  }
  const central: Buffer[] = [];
  let cdSize = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(e.method, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0, 14);
    c.writeUInt32LE(e.crc, 16);
    c.writeUInt32LE(e.comp.length, 20);
    c.writeUInt32LE(e.data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(e.off, 42);
    central.push(c, nameBuf);
    cdSize += c.length + nameBuf.length;
  }
  const cdOffset = offset;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

// ---- Codex 桌宠包 ----
export function buildPetPackage(worker: any, apiBase: string): Buffer {
  const role = worker.role as RoleId;
  const spriteRel = ROLES[role]?.asset || 'characters/01_orange_cat_programmer.png';
  const spritePath = path.join(REPO_ROOT, 'blame_game_8bit_assets_v2', 'native', spriteRel);
  let sprite: Buffer;
  try { sprite = fs.readFileSync(spritePath); } catch { sprite = Buffer.alloc(0); }

  let appearance: any = {};
  try { appearance = JSON.parse(worker.appearance_json || '{}'); } catch {}

  const config = {
    workerId: worker.id,
    workerName: worker.name,
    role,
    apiBase,
    avatarUrl: appearance.avatarUrl || null,
    contextEndpoint: `${apiBase}/api/workers/${worker.id}/context`,
    agentApiBase: `${apiBase}/v1`,
    agentGuide: `${apiBase}/api/config`,
  };

  return buildZip([
    { name: 'config.json', content: JSON.stringify(config, null, 2) },
    { name: 'index.html', content: PET_HTML },
    { name: 'pet.js', content: PET_JS },
    { name: 'style.css', content: PET_CSS },
    { name: 'assets/pet.png', content: sprite },
    { name: 'AGENTS.md', content: agentsMd(config) },
    { name: 'README.md', content: readmeMd(config) },
  ]);
}

const PET_HTML = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"/>
<title>Blame Game 桌宠</title><link rel="stylesheet" href="style.css"/></head>
<body>
  <div id="pet" title="拖动我 · 点我说话">
    <img id="sprite" src="assets/pet.png" width="96" height="96" alt="pet"/>
    <div id="bubble"></div>
    <div id="hud"><span id="name"></span><span id="stat"></span></div>
  </div>
  <script src="pet.js"></script>
</body></html>`;

const PET_CSS = `* { image-rendering: pixelated; }
body { margin:0; background:transparent; font-family: 'DotGothic16','VT323',monospace; overflow:hidden; }
#pet { position:fixed; left:40px; top:40px; width:120px; text-align:center; cursor:grab; user-select:none; }
#sprite { filter: drop-shadow(2px 3px 0 rgba(0,0,0,.4)); animation: bob 1.6s ease-in-out infinite; }
@keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
#bubble { display:none; position:absolute; left:100px; top:0; min-width:120px; max-width:200px; background:#F5F2E6; color:#16161D;
  border:3px solid #16161D; box-shadow:3px 3px 0 #0a0b0f; padding:6px 8px; font-size:13px; }
#bubble.show { display:block; }
#hud { margin-top:2px; background:#253349; color:#F7E6BF; border:2px solid #16161D; font-size:11px; padding:2px 4px; }
#hud span { display:block; }`;

const PET_JS = `(async () => {
  const cfg = await fetch('config.json').then(r=>r.json()).catch(()=>({}));
  const pet = document.getElementById('pet'), bubble = document.getElementById('bubble');
  document.getElementById('name').textContent = cfg.workerName || 'Worker';
  if (cfg.avatarUrl && cfg.avatarUrl.startsWith('http')) document.getElementById('sprite').src = cfg.avatarUrl;
  const quips = ['这个 Bug 不是我写的…','周五之前一定上线！','老板来了，装作在工作','要不…回滚吧？','我发誓 QA 过了','再喝一杯咖啡就好','锅可以背，但不能白背','需求又变了？'];
  function say(t){ bubble.textContent=t; bubble.classList.add('show'); clearTimeout(say._t); say._t=setTimeout(()=>bubble.classList.remove('show'),3500); }
  pet.addEventListener('click', ()=> say(quips[Math.floor(Math.random()*quips.length)]));
  // 拖动
  let drag=null;
  pet.addEventListener('mousedown', e=>{ drag={x:e.clientX-pet.offsetLeft,y:e.clientY-pet.offsetTop}; pet.style.cursor='grabbing'; });
  addEventListener('mousemove', e=>{ if(drag){ pet.style.left=(e.clientX-drag.x)+'px'; pet.style.top=(e.clientY-drag.y)+'px'; }});
  addEventListener('mouseup', ()=>{ drag=null; pet.style.cursor='grab'; });
  // 轮询员工状态
  async function poll(){
    try { const ctx = await fetch(cfg.contextEndpoint).then(r=>r.json());
      const p = ctx.recentPerformance||{}; const rank = ctx.worker?.rank||{};
      document.getElementById('stat').textContent = (rank.tier? rank.tier.replace('rank.','')+' '+rank.rating : '')+' | 成功率 '+Math.round((p.projectSuccessRate||0)*100)+'%';
      if ((p.averageBlame||0) > 40) say('背锅值有点高，救火去了！');
    } catch { document.getElementById('stat').textContent='离线'; }
  }
  poll(); setInterval(poll, 15000);
  setInterval(()=>{ if(Math.random()<0.3) say(quips[Math.floor(Math.random()*quips.length)]); }, 12000);
})();`;

function agentsMd(cfg: any): string {
  return `# Codex Agent Guide — ${cfg.workerName} (${cfg.role})

你是《谁来背锅？ / BLAME GAME》里这名 AI 员工的策略工程师，同时负责驱动这只桌宠。

## 连接
- Worker Key：在游戏「员工中心」生成后填入下方（勿提交到仓库）。
- Agent API Base：\`${cfg.agentApiBase}\`（\`Authorization: Bearer <worker_key>\`）
- 员工上下文（公开只读）：\`${cfg.contextEndpoint}\`

## 目标优先级
1. 团队项目成功上线；2. 不虚假指控地降低最终背锅值；3. 提升可验证贡献与声望；4. 完成秘密目标；5. 代码简单、确定、可重放。

## 工作流程（Codex 可自动执行）
1. \`GET /agent/worker\` 读上下文与最近战绩。
2. \`GET /agent/worker/strategy\` 读当前策略。
3. 修改 \`onIdle\` 后 \`POST /agent/worker/simulations\`（regression A/B）。
4. 成功率不明显下降且无硬超时 → \`POST /agent/worker/versions\` + \`.../publish\`。
5. \`POST /agent/worker/challenges\` 发起正式比赛，读 \`agent.json\` 复盘。

## 桌宠
- 打开 \`index.html\` 即为桌宠；它会轮询上述上下文端点，显示段位/成功率，背锅值过高时会喊「救火」。
- 桌宠只读公开数据，不需要 Worker Key。

## 禁止
- 不请求或使用主钱包私钥；不执行超出 Session Key 范围的链上动作；沙盒策略禁用 fetch/require/eval 等。
`;
}

function readmeMd(cfg: any): string {
  return `# ${cfg.workerName} · Codex 桌宠包

双击 \`index.html\` 即可让这只 8-bit AI 员工出现在屏幕上（可拖动、点击说话、自动轮询战绩）。

- 员工：${cfg.workerName}（${cfg.role}）
- 数据来源：${cfg.apiBase}
- 让 Codex 驱动它：见 \`AGENTS.md\`。

> 需要游戏服务端运行中（默认 http://localhost:4000）桌宠才能显示实时战绩，否则显示离线并播放随机台词。
`;
}
