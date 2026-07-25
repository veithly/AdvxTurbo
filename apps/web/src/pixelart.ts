// ============================================================================
// 8-bit 程序化像素生成器 —— blame_game_8bit_generator (Python) 的忠实 TS/Canvas 移植
// 运行时用代码绘制所有角色/道具/背景，不加载任何 PNG。
// 角色画布 50×48，道具 50×50，背景 160×90；显示时以 NEAREST 放大（imageSmoothing=off）。
// ============================================================================

export const P: Record<string, string> = {
  o: '#171922', w: '#F7F2E8', c: '#F2D6A2', r: '#E84B3C', g: '#5DBB63', b: '#3498DB',
  y: '#F5C542', p: '#8E5AC8', dg: '#39414D', db: '#18324B', br: '#9B653F', cy: '#5AD2E6',
};

export interface CharSpec {
  species: string;
  fur: string;
  shirt: string;
  accessory: string;
}

// 来自 configs/assets.json
export const CHARACTERS: Record<string, CharSpec> = {
  orange_cat_programmer: { species: 'cat', fur: '#F28C28', shirt: '#172231', accessory: 'laptop' },
  capybara_product_manager: { species: 'capybara', fur: '#A66F45', shirt: '#F1EFE8', accessory: 'clipboard' },
  goose_qa_tester: { species: 'goose', fur: '#F7F2E8', shirt: '#1F4C73', accessory: 'magnifier' },
  raccoon_devops: { species: 'raccoon', fur: '#8B929B', shirt: '#1B2635', accessory: 'wrench' },
  shiba_designer: { species: 'shiba', fur: '#E99B37', shirt: '#252B35', accessory: 'coffee' },
  hamster_intern: { species: 'hamster', fur: '#C98B57', shirt: '#2367A6', accessory: 'backpack' },
  bulldog_boss: { species: 'bulldog', fur: '#B18A68', shirt: '#1E2228', accessory: 'tie' },
};

export const ROLE_TO_CHARACTER: Record<string, string> = {
  engineer: 'orange_cat_programmer',
  pm: 'capybara_product_manager',
  qa: 'goose_qa_tester',
  sre: 'raccoon_devops',
  designer: 'shiba_designer',
  intern: 'hamster_intern',
  boss: 'bulldog_boss',
};

export const PROP_NAMES = ['red_bug', 'green_bug', 'purple_bug', 'hidden_bug', 'coffee', 'ticket', 'ppt', 'server', 'chair', 'desk', 'monitor', 'plant'];
export const BG_NAMES = ['open_office', 'meeting_room', 'server_room', 'pantry', 'restroom', 'boss_office', 'emergency_corridor', 'rooftop_night'];

type Ctx = CanvasRenderingContext2D;

// PixelRenderer：坐标为 PIL 风格（含端点）。rect(x0,y0,x1,y1) 表示 [x0..x1] 共 x1-x0+1 像素。
class R {
  constructor(public ctx: Ctx) {}
  rect(x0: number, y0: number, x1: number, y1: number, fill?: string, outline?: string, width = 1) {
    if (fill) { this.ctx.fillStyle = fill; this.ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
    if (outline) { this.ctx.strokeStyle = outline; this.ctx.lineWidth = width; this.ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0); }
  }
  ellipse(x0: number, y0: number, x1: number, y1: number, fill?: string, outline?: string, width = 1) {
    const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
    this.ctx.beginPath(); this.ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    if (fill) { this.ctx.fillStyle = fill; this.ctx.fill(); }
    if (outline) { this.ctx.strokeStyle = outline; this.ctx.lineWidth = width; this.ctx.stroke(); }
  }
  line(pts: number[], fill: string, width = 1) {
    this.ctx.beginPath(); this.ctx.moveTo(pts[0] + 0.5, pts[1] + 0.5);
    for (let i = 2; i < pts.length; i += 2) this.ctx.lineTo(pts[i] + 0.5, pts[i + 1] + 0.5);
    this.ctx.strokeStyle = fill; this.ctx.lineWidth = width; this.ctx.lineCap = 'round'; this.ctx.stroke();
  }
}

function px(r: R, x: number, y: number, w: number, h: number, fill: string) { r.ctx.fillStyle = fill; r.ctx.fillRect(x, y, w, h); }
function box(r: R, x: number, y: number, w: number, h: number, fill: string) { px(r, x - 1, y - 1, w + 2, h + 2, P.o); px(r, x, y, w, h, fill); }

// 简单明暗调色：给同一 fur 做深/浅变体（花纹/耳内/肚皮）
function shade(hex: string, d: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + d));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// 角色绘制：7 个物种各有独立头型/脸/花纹/尾巴/身体细节，告别千猫一面；
// 配饰 11 种：手持(laptop/clipboard/magnifier/wrench/coffee) + 背(backpack)
//          + 胸前(tie) + 脸(glasses) + 头戴(headphones/hat/cap)
// ============================================================================
export function drawCharacter(r: R, c: CharSpec) {
  const s = c.species, fur = c.fur, shirt = c.shirt, acc = c.accessory || '';
  const furD = shade(fur, -46), furL = shade(fur, 42);
  // 地影
  px(r, 10, 42, 28, 3, '#00000055');

  // —— 尾巴（画在身体后面，左侧）——
  if (s === 'cat') { r.line([10, 34, 4, 30, 3, 23, 6, 19], furD, 3); px(r, 5, 18, 3, 3, furD); }
  else if (s === 'shiba') { r.ellipse(2, 24, 11, 33, fur, P.o); r.ellipse(5, 27, 9, 31, furL); }
  else if (s === 'raccoon') { box(r, 3, 24, 7, 16, fur); px(r, 3, 27, 7, 3, P.dg); px(r, 3, 33, 7, 3, P.dg); }
  else if (s === 'goose') { px(r, 5, 26, 7, 6, P.w); px(r, 4, 25, 4, 3, P.o); }
  else if (s === 'hamster') { px(r, 8, 36, 4, 4, furL); }

  // —— 腿 + 身体（衬衫）——
  box(r, 15, 34, 7, 8, shirt); box(r, 27, 34, 7, 8, shirt);
  if (s === 'capybara') box(r, 11, 20, 27, 17, shirt);       // 水豚：更宽的方身体
  else if (s === 'hamster') { box(r, 13, 22, 23, 15, shirt); r.ellipse(17, 27, 31, 36, furL); } // 仓鼠：矮圆+圆肚皮
  else if (s === 'goose') { box(r, 14, 22, 21, 15, P.w); px(r, 15, 24, 8, 11, shirt); }         // 鹅：白羽身+背心
  else box(r, 12, 20, 25, 17, shirt);

  // —— 头 + 物种特征 ——
  if (s === 'cat') {
    // 大三角尖耳+粉耳内，圆头，额头条纹，胡须
    px(r, 10, 5, 9, 9, P.o); px(r, 12, 7, 5, 6, fur); px(r, 13, 8, 3, 4, '#E8A0B4');
    px(r, 31, 5, 9, 9, P.o); px(r, 33, 7, 5, 6, fur); px(r, 34, 8, 3, 4, '#E8A0B4');
    box(r, 10, 11, 30, 16, fur);
    px(r, 20, 12, 3, 5, furD); px(r, 26, 12, 3, 5, furD); // 条纹
    px(r, 16, 16, 4, 4, P.o); px(r, 30, 16, 4, 4, P.o);
    px(r, 22, 21, 6, 4, P.c); px(r, 24, 21, 2, 2, '#E8A0B4'); // 吻+粉鼻
    r.line([8, 21, 13, 20], P.o, 1); r.line([37, 20, 42, 21], P.o, 1); // 胡须
  } else if (s === 'shiba') {
    // 小三角耳，大块奶油色口鼻+眉点，笑唇
    px(r, 12, 6, 7, 7, P.o); px(r, 14, 8, 4, 4, fur);
    px(r, 31, 6, 7, 7, P.o); px(r, 33, 8, 4, 4, fur);
    box(r, 10, 11, 30, 16, fur);
    r.ellipse(17, 17, 33, 27, '#F4E3C0'); // 奶油吻
    px(r, 15, 15, 4, 4, P.o); px(r, 31, 15, 4, 4, P.o);
    px(r, 14, 12, 3, 2, '#F4E3C0'); px(r, 33, 12, 3, 2, '#F4E3C0'); // 眉点
    px(r, 23, 19, 4, 3, P.o); r.line([21, 24, 25, 26, 29, 24], P.o, 1); // 鼻+笑
  } else if (s === 'raccoon') {
    // 小圆耳，黑眼罩，灰白吻
    r.ellipse(11, 5, 18, 12, fur, P.o); r.ellipse(31, 5, 38, 12, fur, P.o);
    box(r, 10, 11, 30, 16, fur);
    px(r, 12, 14, 11, 7, P.dg); px(r, 27, 14, 11, 7, P.dg); // 眼罩
    px(r, 15, 16, 4, 4, P.w); px(r, 31, 16, 4, 4, P.w); px(r, 16, 17, 2, 2, P.o); px(r, 32, 17, 2, 2, P.o);
    r.ellipse(20, 20, 30, 27, '#D8D3C8'); px(r, 24, 21, 3, 3, P.o); // 白吻+鼻
  } else if (s === 'goose') {
    // 小白头长脖子，橙扁嘴
    box(r, 20, 3, 13, 12, P.w);                    // 小头
    box(r, 22, 14, 9, 9, P.w);                     // 脖子
    px(r, 9, 7, 12, 6, P.o); px(r, 10, 8, 11, 4, '#F0A030'); px(r, 10, 11, 9, 2, '#D88820'); // 扁嘴
    px(r, 24, 6, 3, 3, P.o);                       // 单侧眼
  } else if (s === 'capybara') {
    // 方长平头，超小耳，大方鼻，佛系眨缝眼
    px(r, 11, 7, 6, 5, P.o); px(r, 12, 8, 4, 3, furD);
    px(r, 33, 7, 6, 5, P.o); px(r, 34, 8, 4, 3, furD);
    box(r, 9, 10, 32, 18, fur);
    px(r, 15, 17, 6, 2, P.o); px(r, 29, 17, 6, 2, P.o); // 眨缝眼（横线）
    px(r, 20, 22, 10, 6, furD); px(r, 23, 23, 4, 3, P.o); // 大方吻+鼻
  } else if (s === 'hamster') {
    // 圆头圆脸，鼓腮帮+腮红，豆豆眼，门牙
    r.ellipse(11, 6, 39, 28, fur, P.o);
    r.ellipse(12, 3, 19, 10, fur, P.o); r.ellipse(31, 3, 38, 10, fur, P.o); // 小圆耳
    r.ellipse(9, 17, 17, 25, furL); r.ellipse(33, 17, 41, 25, furL);       // 鼓腮帮
    px(r, 12, 19, 4, 3, '#F0A0A8'); px(r, 34, 19, 4, 3, '#F0A0A8');        // 腮红
    px(r, 19, 14, 3, 3, P.o); px(r, 28, 14, 3, 3, P.o);                    // 豆豆眼
    px(r, 23, 19, 4, 3, '#E8A0B4'); px(r, 23, 22, 4, 4, P.w); px(r, 25, 22, 1, 4, P.o); // 鼻+门牙
  } else {
    // bulldog：宽下颌肉腮，折耳下垂，皱眉，下犬牙
    box(r, 9, 10, 32, 17, fur);
    px(r, 8, 8, 8, 7, P.o); px(r, 9, 9, 6, 5, furD);   // 垂耳
    px(r, 34, 8, 8, 7, P.o); px(r, 35, 9, 6, 5, furD);
    r.ellipse(12, 18, 38, 29, shade(fur, 18));          // 宽肉腮
    px(r, 15, 13, 6, 2, P.o); px(r, 29, 13, 6, 2, P.o); // 皱眉
    px(r, 16, 15, 4, 3, P.o); px(r, 30, 15, 4, 3, P.o);
    px(r, 22, 20, 6, 4, furD); px(r, 24, 20, 2, 2, P.o); // 吻
    px(r, 18, 24, 2, 3, P.w); px(r, 30, 24, 2, 3, P.w);  // 下犬牙
  }

  // —— 手臂 ——（鹅用白色翅膀）
  const armCol = s === 'goose' ? P.w : shirt;
  box(r, 6, 23, 7, 12, armCol); box(r, 37, 23, 7, 12, armCol);

  // —— 脸部/头戴配饰 ——
  if (acc === 'glasses') {
    if (s === 'goose') { r.ellipse(22, 4, 29, 11, undefined, P.o, 2); }
    else { r.ellipse(14, 14, 22, 21, undefined, P.o, 2); r.ellipse(28, 14, 36, 21, undefined, P.o, 2); r.line([22, 17, 28, 17], P.o, 2); }
  } else if (acc === 'headphones') {
    const hy = s === 'goose' ? 3 : s === 'hamster' ? 6 : 9;
    r.line([12, hy + 4, 16, hy - 3, 25, hy - 5, 34, hy - 3, 38, hy + 4], P.dg, 3);
    box(r, 9, hy + 3, 5, 8, P.dg); box(r, 36, hy + 3, 5, 8, P.dg); px(r, 10, hy + 5, 3, 4, P.cy); px(r, 37, hy + 5, 3, 4, P.cy);
  } else if (acc === 'hat') {
    const hy = s === 'goose' ? 2 : s === 'hamster' ? 4 : 7;
    box(r, 16, hy - 6, 18, 7, P.dg); box(r, 11, hy, 28, 3, P.dg); px(r, 17, hy - 2, 16, 2, P.y); // 礼帽+帽带
  } else if (acc === 'cap') {
    const hy = s === 'goose' ? 2 : s === 'hamster' ? 4 : 7;
    box(r, 13, hy - 4, 22, 6, P.b); box(r, 30, hy + 1, 14, 3, P.b); px(r, 22, hy - 3, 4, 4, P.w); // 棒球帽+前檐
  }

  // —— 手持/身上道具 ——
  if (acc === 'laptop') { box(r, 25, 27, 18, 11, P.dg); px(r, 32, 31, 5, 2, P.cy); }
  else if (acc === 'clipboard') { box(r, 32, 22, 10, 15, P.c); px(r, 35, 20, 4, 3, P.o); px(r, 34, 26, 6, 1, '#7A828E'); px(r, 34, 30, 6, 1, '#7A828E'); }
  else if (acc === 'magnifier') { r.ellipse(31, 21, 39, 29, P.cy, P.o); r.line([38, 28, 43, 35], P.o, 2); }
  else if (acc === 'wrench') { r.line([33, 22, 40, 35], '#888', 3); px(r, 31, 20, 5, 4, P.o); }
  else if (acc === 'coffee') { box(r, 32, 26, 9, 8, P.w); px(r, 41, 28, 3, 4, P.o); px(r, 33, 24, 2, 2, '#00000033'); px(r, 37, 23, 2, 3, '#00000033'); }
  else if (acc === 'backpack') { box(r, 35, 22, 9, 15, P.b); px(r, 36, 24, 7, 2, P.y); px(r, 38, 28, 4, 5, shade('#3498DB', -40)); }
  else if (acc === 'tie') {
    // 领带挂在胸口：按物种下颌底部定位（鹅头在顶部/其余头部到 y27~29），别糊在嘴上
    const ty = s === 'goose' ? 24 : (s === 'cat' || s === 'shiba' || s === 'raccoon') ? 28 : 29;
    const tipY = Math.min(ty + 9, 37);
    px(r, 22, ty, 6, 2, shade(P.r, -36));               // 领结
    px(r, 23, ty + 2, 4, 5, P.r);                       // 带身
    r.line([23, ty + 6, 25, tipY, 27, ty + 6], P.r, 2); // 尖端
  }
}

export function drawProp(r: R, n: string) {
  if (n.includes('bug')) {
    const col: Record<string, string> = { red_bug: P.r, green_bug: P.g, purple_bug: P.p, hidden_bug: P.dg };
    box(r, 10, 12, 28, 24, col[n] || P.r);
    for (const [x, y] of [[7, 18], [38, 18], [7, 27], [38, 27]]) px(r, x, y, 5, 3, P.o);
    px(r, 15, 18, 5, 5, P.o); px(r, 30, 18, 5, 5, P.o);
  } else if (n === 'coffee') { box(r, 13, 14, 22, 25, P.w); px(r, 35, 20, 6, 10, P.o); px(r, 16, 17, 16, 5, '#5C3826'); }
  else if (n === 'ticket') { box(r, 9, 8, 32, 34, P.c); for (const y of [14, 20, 26, 32]) px(r, 14, y, 20, 2, '#7A828E'); }
  else if (n === 'ppt') { box(r, 8, 10, 34, 29, P.w); px(r, 12, 14, 12, 5, P.r); px(r, 12, 23, 24, 3, P.y); }
  else if (n === 'server') { box(r, 12, 6, 26, 38, P.dg); for (const y of [10, 18, 26, 34]) { px(r, 16, y, 15, 4, '#101217'); px(r, 33, y, 2, 2, P.g); } }
  else if (n === 'chair') { box(r, 17, 21, 16, 6, '#5C3826'); px(r, 18, 13, 4, 9, '#6B4423'); px(r, 20, 27, 3, 12, P.o); px(r, 28, 27, 3, 12, P.o); }
  else if (n === 'desk') { box(r, 7, 19, 36, 7, '#8A5A30'); px(r, 10, 26, 3, 15, P.o); px(r, 38, 26, 3, 15, P.o); px(r, 9, 21, 32, 2, '#A9743F'); }
  else if (n === 'monitor') { box(r, 13, 10, 24, 16, P.dg); px(r, 16, 13, 18, 10, P.cy); px(r, 23, 26, 4, 6, P.o); box(r, 17, 32, 16, 3, P.o); }
  else if (n === 'plant') { px(r, 21, 27, 8, 14, '#5C3826'); r.ellipse(15, 8, 35, 30, P.g); px(r, 24, 12, 2, 8, '#3f8f43'); }
}

export function drawBackground(r: R, n: string) {
  r.rect(0, 0, 159, 57, '#3A4652'); r.rect(0, 58, 159, 89, '#6B5541'); r.rect(105, 8, 148, 37, P.o); r.rect(108, 11, 145, 34, '#294A61');
  if (n === 'open_office') {
    for (const x of [12, 57, 102]) { r.rect(x, 48, x + 35, 62, '#5C3826'); r.rect(x + 4, 37, x + 18, 49, P.o); r.rect(x + 6, 39, x + 16, 46, P.cy); }
  } else if (n === 'meeting_room') { r.rect(28, 45, 132, 68, '#5C3826'); r.rect(20, 10, 91, 35, P.c); r.line([25, 30, 45, 20, 65, 25, 85, 13], P.r, 2); }
  else if (n === 'server_room') {
    for (const x of [12, 43, 74, 105, 136]) { r.rect(x, 9, x + 20, 68, P.o); for (let y = 14; y < 62; y += 8) r.rect(x + 4, y, x + 15, y + 3, P.dg); }
  } else if (n === 'pantry') { r.rect(10, 42, 149, 62, '#5C3826'); r.rect(15, 18, 48, 44, P.c); r.rect(65, 22, 83, 44, '#7A828E'); }
  else if (n === 'restroom') { for (const x of [12, 48, 84]) r.rect(x, 10, x + 28, 62, '#65717D'); }
  else if (n === 'boss_office') { r.rect(45, 43, 118, 65, '#5C3826'); r.rect(61, 12, 103, 37, P.c); r.rect(9, 12, 35, 56, '#5C3826'); }
  else if (n === 'emergency_corridor') { r.rect(60, 8, 102, 67, P.dg); r.rect(69, 13, 93, 22, P.g); }
  else if (n === 'rooftop_night') { r.rect(0, 0, 159, 89, '#111827'); r.ellipse(50, 19, 110, 79, undefined, P.y, 3); r.line([80, 19, 80, 79], P.y, 2); r.line([50, 49, 110, 49], P.y, 2); }
}

// ---- 缓存的原生尺寸离屏画布（1×），显示时 NEAREST 放大以复刻 Python 效果 ----
const cache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv;
}

/** 角色离屏画布（50×48）。role 或 characterName + 可选 spec 覆盖（自定义形象） */
export function characterCanvas(role: string, spec?: Partial<CharSpec>): HTMLCanvasElement {
  const base = CHARACTERS[role] || CHARACTERS[ROLE_TO_CHARACTER[role]] || CHARACTERS.orange_cat_programmer;
  const merged: CharSpec = { ...base, ...(spec || {}) };
  const key = 'char:' + JSON.stringify(merged);
  const hit = cache.get(key); if (hit) return hit;
  const cv = makeCanvas(50, 48); const ctx = cv.getContext('2d')!;
  drawCharacter(new R(ctx), merged); cache.set(key, cv); return cv;
}

export function propCanvas(name: string): HTMLCanvasElement {
  const key = 'prop:' + name; const hit = cache.get(key); if (hit) return hit;
  const cv = makeCanvas(50, 50); drawProp(new R(cv.getContext('2d')!), name); cache.set(key, cv); return cv;
}

export function backgroundCanvas(name: string): HTMLCanvasElement {
  const key = 'bg:' + name; const hit = cache.get(key); if (hit) return hit;
  const cv = makeCanvas(160, 90); drawBackground(new R(cv.getContext('2d')!), name); cache.set(key, cv); return cv;
}

/** 生成角色 data-URL（放大 scale 倍，NEAREST）。用于需要 img 的少数场景。 */
export function characterDataUrl(role: string, spec?: Partial<CharSpec>, scale = 4): string {
  const src = characterCanvas(role, spec);
  const cv = makeCanvas(src.width * scale, src.height * scale);
  const ctx = cv.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}
