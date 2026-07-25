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

// 每个动作用到的道具 / 特效贴图（native 8-bit，透明背景）——一组图片共同驱动动态效果（黑客松主题：开热点 build 冲项目）
const PET_PROPS: Record<string, string> = {
  work: 'props/08_laptop.png',
  fix: 'props/14_wrench.png',
  coffee: 'props/05_coffee_mug.png',
  hotspot: 'props/16_wifi_router.png',
  alarm: 'props/17_alarm_siren.png',
  rollback: 'props/15_rollback_arrow.png',
};
const PET_VFX: Record<string, string> = {
  sparks: 'vfx/01_hotfix_green_sparks.png',
  bossAlert: 'vfx/04_boss_alert_cone.png',
  shield: 'vfx/05_blue_shield.png',
  boost: 'vfx/07_coffee_speed_boost.png',
  ping: 'vfx/08_evidence_ping.png',
  smoke: 'vfx/09_incident_smoke.png',
};

function readNative(rel: string): Buffer | null {
  try { return fs.readFileSync(path.join(REPO_ROOT, 'blame_game_8bit_assets_v2', 'native', rel)); }
  catch { return null; }
}

export function buildPetPackage(worker: any, apiBase: string): Buffer {
  const role = worker.role as RoleId;
  const spriteRel = ROLES[role]?.asset || 'characters/01_orange_cat_programmer.png';
  const sprite = readNative(spriteRel) || Buffer.alloc(0);

  let appearance: any = {};
  try { appearance = JSON.parse(worker.appearance_json || '{}'); } catch {}

  // 打包动作贴图，并把成功打包的清单交给 pet.js（缺失的自动跳过，桌宠仍可降级运行）
  const extraFiles: Array<{ name: string; content: Buffer }> = [];
  const props: Record<string, string> = {};
  for (const [key, rel] of Object.entries(PET_PROPS)) {
    const buf = readNative(rel);
    if (buf) { const name = `assets/props/${key}.png`; extraFiles.push({ name, content: buf }); props[key] = name; }
  }
  const vfx: Record<string, string> = {};
  for (const [key, rel] of Object.entries(PET_VFX)) {
    const buf = readNative(rel);
    if (buf) { const name = `assets/vfx/${key}.png`; extraFiles.push({ name, content: buf }); vfx[key] = name; }
  }

  const config = {
    workerId: worker.id,
    workerName: worker.name,
    role,
    apiBase,
    avatarUrl: appearance.avatarUrl || null,
    contextEndpoint: `${apiBase}/api/workers/${worker.id}/context`,
    agentApiBase: `${apiBase}/v1`,
    agentGuide: `${apiBase}/api/config`,
    sprite: 'assets/pet.png',
    props,
    vfx,
  };

  return buildZip([
    { name: 'config.json', content: JSON.stringify(config, null, 2) },
    { name: 'index.html', content: PET_HTML },
    { name: 'pet.js', content: PET_JS },
    { name: 'style.css', content: PET_CSS },
    { name: 'assets/pet.png', content: sprite },
    ...extraFiles,
    { name: 'AGENTS.md', content: agentsMd(config) },
    { name: 'README.md', content: readmeMd(config) },
  ]);
}

const PET_HTML = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"/>
<title>Advx 极速版 · 桌宠</title><link rel="stylesheet" href="style.css"/></head>
<body>
  <div id="pet" title="拖动我 · 点我说话 · 双击换动作">
    <div id="stage">
      <img id="vfx" alt="" onerror="this.classList.remove('show')"/>
      <img id="sprite" src="assets/pet.png" width="96" height="96" alt="pet"/>
      <img id="prop" alt="" onerror="this.classList.remove('show')"/>
    </div>
    <div id="bubble"></div>
    <div id="hud"><span id="name"></span><span id="act"></span><span id="stat"></span></div>
  </div>
  <script src="pet.js"></script>
</body></html>`;

const PET_CSS = `* { image-rendering: pixelated; }
body { margin:0; background:transparent; font-family: 'DotGothic16','VT323',monospace; overflow:hidden; }
#pet { position:fixed; left:40px; top:40px; width:120px; text-align:center; cursor:grab; user-select:none; }
#stage { position:relative; width:96px; height:96px; margin:0 auto; }
#stage.flip { transform:scaleX(-1); }
#sprite { display:block; margin:0 auto; filter: drop-shadow(2px 3px 0 rgba(0,0,0,.4)); }
#vfx,#prop { position:absolute; opacity:0; pointer-events:none; }
#vfx { width:76px; height:76px; left:50%; top:48%; margin:-38px 0 0 -38px; }
#vfx.show { opacity:1; animation: vfxpulse .7s ease-out infinite; }
#prop { width:40px; height:40px; right:-4px; bottom:4px; }
#prop.show { opacity:1; animation: propbob 1s ease-in-out infinite; }
#bubble { display:none; position:absolute; left:104px; top:0; min-width:120px; max-width:200px; background:#F5F2E6; color:#16161D;
  border:3px solid #16161D; box-shadow:3px 3px 0 #0a0b0f; padding:6px 8px; font-size:13px; z-index:5; }
#bubble.show { display:block; }
#hud { margin-top:2px; background:#253349; color:#F7E6BF; border:2px solid #16161D; font-size:11px; padding:2px 4px; }
#hud span { display:block; }
#act { color:#8CE0B0; font-weight:bold; }
#pet.offline #act { color:#E0A96D; }

.a-idle { animation: bob 1.6s ease-in-out infinite; }
.a-work { animation: work .5s steps(3) infinite; }
.a-fix { animation: fixshake .16s linear infinite; }
.a-coffee { animation: lean 1.4s ease-in-out infinite; }
.a-peek { animation: peek 1.2s ease-in-out infinite; }
.a-celebrate { animation: hop .6s ease-in-out infinite; }
.a-shake { animation: hshake .12s linear infinite; }
.a-sleep { animation: breathe 2.6s ease-in-out infinite; }
.a-walk { animation: walkbob .4s ease-in-out infinite; }
#pet.panic #sprite { animation: fixshake .1s linear infinite, redflash .5s ease-in-out infinite; }

@keyframes bob {0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes work {0%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-2px) rotate(2deg)}100%{transform:translateY(0) rotate(-2deg)}}
@keyframes fixshake {0%{transform:translate(-1px,0) rotate(-4deg)}50%{transform:translate(1px,-1px) rotate(4deg)}100%{transform:translate(-1px,0) rotate(-4deg)}}
@keyframes lean {0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg) translateY(-2px)}}
@keyframes peek {0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.08) translateY(-3px)}}
@keyframes hop {0%{transform:translateY(0) rotate(0)}30%{transform:translateY(-16px) rotate(10deg)}60%{transform:translateY(-16px) rotate(-10deg)}100%{transform:translateY(0) rotate(0)}}
@keyframes hshake {0%{transform:translateX(-3px)}50%{transform:translateX(3px)}100%{transform:translateX(-3px)}}
@keyframes breathe {0%,100%{transform:scaleY(1) translateY(0)}50%{transform:scaleY(.93) translateY(3px)}}
@keyframes walkbob {0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-4px) rotate(3deg)}}
@keyframes vfxpulse {0%{opacity:.25;transform:scale(.7)}50%{opacity:1;transform:scale(1.12)}100%{opacity:.3;transform:scale(.9)}}
@keyframes propbob {0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-4px) rotate(6deg)}}
@keyframes redflash {0%,100%{filter:drop-shadow(2px 3px 0 rgba(0,0,0,.4))}50%{filter:drop-shadow(0 0 6px #ff3b3b) drop-shadow(2px 3px 0 rgba(0,0,0,.4))}}`;

const PET_JS = `(async () => {
  const cfg = await fetch('config.json').then(r=>r.json()).catch(()=>({}));
  const $ = function(id){ return document.getElementById(id); };
  const pet=$('pet'), stage=$('stage'), sprite=$('sprite'), prop=$('prop'), vfx=$('vfx'), bubble=$('bubble');
  $('name').textContent = cfg.workerName || 'Worker';
  if (cfg.avatarUrl && (''+cfg.avatarUrl).indexOf('http')===0) sprite.src = cfg.avatarUrl;
  const PROPS = cfg.props||{}, VFX = cfg.vfx||{};

  // 动作表：每个动作 = 角色动画(cls) + 道具贴图(prop) + 特效贴图(vfx) + 台词（黑客松主题：在端点偷开热点 build 冲项目）
  const ACTIONS = {
    idle:      { cls:'a-idle', label:'待命', quips:['……','网怎么这么卡','工作人员来了，假装路过'] },
    build:     { cls:'a-work', prop:'work', label:'偷偷build', quips:['偷偷 build 一波🛠','这行我来写','别催，正在编译'] },
    hotspot:   { cls:'a-peek', prop:'hotspot', vfx:'ping', label:'开热点', quips:['开热点中📶','信号满格，冲！','就靠这点流量了'] },
    fix:       { cls:'a-fix', prop:'fix', vfx:'sparks', label:'修状况', quips:['修修修！','现场状况我来解决','稳住，能修'] },
    coffee:    { cls:'a-coffee', prop:'coffee', vfx:'boost', label:'干饭续命', quips:['干饭+灵感😋','奶茶续命～','续到 DDL 那一刻'] },
    ship:      { cls:'a-celebrate', vfx:'sparks', label:'提交项目', quips:['项目提交🚀','冲榜！','这波稳了'] },
    lurk:      { cls:'a-idle', vfx:'bossAlert', label:'潜伏', quips:['假装路过…','工作人员来了，低调','别盯我，我在散步'] },
    ddl:       { cls:'a-fix', prop:'alarm', vfx:'smoke', panic:true, label:'赶DDL', quips:['全场断网，赶DDL！','冲刺！要来不及了','提交倒计时！'] },
    guard:     { cls:'a-idle', vfx:'shield', label:'稳住', quips:['稳住别慌','先保住进度','别炸别炸'] },
    rest:      { cls:'a-sleep', label:'躺蓝盒子', quips:['躺蓝盒子😴','休息区回血','睡一下再战'] }
  };
  const FLAVORS = ['build','hotspot','fix','coffee','ship','lurk','ddl','rest'];
  const state = { perf:{}, rank:{} };
  let cur='idle', holdUntil=0, walking=false, drag=null;

  function say(t){ bubble.textContent=t; bubble.classList.add('show'); clearTimeout(say._t); say._t=setTimeout(function(){ bubble.classList.remove('show'); },3200); }
  function overlay(el, key, map){ var src = key && map[key]; if(src){ el.src=src; el.classList.add('show'); } else { el.classList.remove('show'); el.removeAttribute('src'); } }
  function play(id, holdMs){
    var a = ACTIONS[id]; if(!a) return;
    cur = id;
    sprite.className=''; void sprite.offsetWidth; sprite.className=a.cls; // 重启动画
    pet.classList.toggle('panic', !!a.panic);
    overlay(prop, a.prop, PROPS);
    overlay(vfx, a.vfx, VFX);
    $('act').textContent = a.label||'';
    if (a.quips && Math.random()<0.85) say(a.quips[Math.floor(Math.random()*a.quips.length)]);
    holdUntil = Date.now() + (holdMs!=null ? holdMs : (id==='idle'?0:4200));
  }
  function toIdle(){ play('idle',0); }
  window.pet = { play: play, actions: Object.keys(ACTIONS) }; // 供 Codex / 手动驱动

  // 走动巡逻
  function walkTo(x, done){
    walking = true;
    var from = pet.offsetLeft, goingLeft = x < from;
    stage.classList.toggle('flip', goingLeft);
    sprite.className='a-walk';
    overlay(prop, null, PROPS); overlay(vfx, null, VFX); pet.classList.remove('panic');
    $('act').textContent = '巡逻';
    var dist = Math.abs(x-from), dur = Math.min(6, Math.max(1.2, dist/90));
    pet.style.transition = 'left '+dur+'s linear';
    pet.style.left = x+'px';
    clearTimeout(walkTo._t);
    walkTo._t = setTimeout(function(){ pet.style.transition=''; stage.classList.remove('flip'); walking=false; toIdle(); if(done)done(); }, dur*1000+60);
  }

  // 拖动
  pet.addEventListener('mousedown', function(e){ drag={x:e.clientX-pet.offsetLeft,y:e.clientY-pet.offsetTop,moved:false}; pet.style.transition=''; pet.style.cursor='grabbing'; walking=false; clearTimeout(walkTo._t); });
  addEventListener('mousemove', function(e){ if(drag){ drag.moved=true; pet.style.left=(e.clientX-drag.x)+'px'; pet.style.top=(e.clientY-drag.y)+'px'; }});
  addEventListener('mouseup', function(){ if(drag){ drag=null; pet.style.cursor='grab'; holdUntil=0; } });
  pet.addEventListener('click', function(){ if(drag&&drag.moved) return; var a=ACTIONS[cur]||ACTIONS.idle; var q=a.quips||ACTIONS.idle.quips; say(q[Math.floor(Math.random()*q.length)]); });
  pet.addEventListener('dblclick', function(){ play(FLAVORS[Math.floor(Math.random()*FLAVORS.length)]); });

  // 根据真实战绩决定下一个动作（黑客松主题）
  function decide(){
    var p = state.perf||{};
    if((p.averageBlame||0) > 40) return 'lurk'; // 被工作人员盯上 → 潜伏
    var wr = p.winRate!=null ? p.winRate : (p.projectSuccessRate||0);
    var r = Math.random();
    if(wr >= 0.7) return r<0.4?'ship':(r<0.7?'build':'hotspot');
    if(wr > 0) return r<0.4?'hotspot':(r<0.7?'build':'fix');
    return r<0.5?'build':(r<0.8?'coffee':'rest');
  }

  // 主循环：待命 / 情绪动作 / 走动 交替
  function loop(){
    var delay = 4200;
    if(!drag && !walking && Date.now()>=holdUntil){
      var roll = Math.random();
      if(roll < 0.30){ walkTo(Math.round(Math.random()*Math.max(20, innerWidth-150))); delay = 5200; }
      else if(roll < 0.5){ toIdle(); delay = 3200; }
      else { play(decide()); delay = 4600; }
    }
    setTimeout(loop, delay);
  }

  // 轮询员工状态
  async function poll(){
    try {
      var ctx = await fetch(cfg.contextEndpoint).then(function(r){ return r.json(); });
      state.perf = ctx.recentPerformance||{}; state.rank = (ctx.worker&&ctx.worker.rank)||{};
      var rk = state.rank, wr = state.perf.winRate!=null ? state.perf.winRate : (state.perf.projectSuccessRate||0);
      $('stat').textContent = (rk.tier ? (''+rk.tier).replace('rank.','')+' '+rk.rating+' · ' : '') + '胜率 ' + Math.round(wr*100) + '%';
      pet.classList.remove('offline');
      if((state.perf.averageBlame||0) > 40 && cur!=='lurk' && !drag && !walking){ play('lurk', 6000); }
    } catch(e) { $('stat').textContent='离线（随机演示）'; pet.classList.add('offline'); }
  }

  toIdle();
  poll(); setInterval(poll, 15000);
  setTimeout(loop, 2600);
})();`;

function agentsMd(cfg: any): string {
  return `# Codex Agent Guide — ${cfg.workerName} (${cfg.role})

你是《Advx 极速版 / ADVX TURBO》黑客松里这名 AI 选手的策略工程师，同时负责驱动这只桌宠。

## 连接
- Worker Key：在游戏「选手中心」生成后填入下方（勿提交到仓库）。
- Agent API Base：\`${cfg.agentApiBase}\`（\`Authorization: Bearer <worker_key>\`）
- 选手上下文（公开只读）：\`${cfg.contextEndpoint}\`

## 目标优先级
1. 在端点偷开热点、把项目 build 到 100% 并提交；2. 别被工作人员逐到（避免取消资格）；3. 提升可验证贡献与声望；4. 完成秘密目标；5. 代码简单、确定、可重放。

## 工作流程（Codex 可自动执行）
1. \`GET /agent/worker\` 读上下文与最近战绩。
2. \`GET /agent/worker/strategy\` 读当前策略。
3. 修改 \`onIdle\` 后 \`POST /agent/worker/simulations\`（regression A/B）。
4. 成功率不明显下降且无硬超时 → \`POST /agent/worker/versions\` + \`.../publish\`。
5. \`POST /agent/worker/challenges\` 发起正式比赛，读 \`agent.json\` 复盘。

## 桌宠（多动作 · 一组 8-bit 贴图）
- 打开 \`index.html\` 即为桌宠：角色精灵 + 一组道具/特效贴图（\`assets/props\`、\`assets/vfx\`）组合出「偷偷build / 开热点 / 修状况 / 干饭续命 / 提交项目 / 潜伏 / 赶DDL / 躺蓝盒子 / 巡逻走动」等动作。
- 它轮询上述上下文端点，按真实胜率自动切换动作（胜率高→提交项目，被工作人员盯上→潜伏）；离线时随机演示。
- 交互：拖动移动、单击说话、双击随机换动作；也可用 \`window.pet.play('ship')\` 由 Codex 主动驱动（动作名见 \`window.pet.actions\`）。
- 桌宠只读公开数据，不需要 Worker Key。

## 禁止
- 不请求或使用主钱包私钥；不执行超出 Session Key 范围的链上动作；沙盒策略禁用 fetch/require/eval 等。
`;
}

function readmeMd(cfg: any): string {
  return `# ${cfg.workerName} · Codex 桌宠包

双击 \`index.html\` 即可让这只 8-bit AI 选手出现在屏幕上：由角色精灵 + 一组道具/特效贴图组合出多种动作（偷偷build / 开热点 / 修状况 / 干饭续命 / 提交项目 / 潜伏 / 赶DDL / 躺蓝盒子 / 巡逻走动），并按实时战绩自动切换。

- 员工：${cfg.workerName}（${cfg.role}）
- 数据来源：${cfg.apiBase}
- 交互：拖动移动 · 单击说话 · 双击随机换动作 · \`window.pet.play('<动作>')\` 由 Codex 驱动
- 让 Codex 驱动它：见 \`AGENTS.md\`。

> 需要游戏服务端运行中（默认 http://localhost:4000）桌宠才能显示实时战绩，否则显示「离线（随机演示）」并随机切换动作与台词。
`;
}
