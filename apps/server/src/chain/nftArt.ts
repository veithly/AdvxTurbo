// ============================================================================
// NFT 护照卡片生成器 —— 服务端 SVG 版 drawCharacter（与 web/src/pixelart.ts 同源画法）
// 产出「8-bit 形象 + 名字」的 SVG 卡片，并编码为完全上链的 data:URI tokenURI，
// MetaMask / Blockscout 无需访问我们的服务器即可显示图片。
// ============================================================================
import { ethers } from 'ethers';

const P: Record<string, string> = {
  o: '#171922', w: '#F7F2E8', c: '#F2D6A2', r: '#E84B3C', g: '#5DBB63', b: '#3498DB',
  y: '#F5C542', p: '#8E5AC8', dg: '#39414D', db: '#18324B', br: '#9B653F', cy: '#5AD2E6',
};

interface CharSpec { species: string; fur: string; shirt: string; accessory: string }

// 与 web 端 pixelart.ts 保持一致（configs/assets.json）
const CHARACTERS: Record<string, CharSpec> = {
  orange_cat_programmer: { species: 'cat', fur: '#F28C28', shirt: '#172231', accessory: 'laptop' },
  capybara_product_manager: { species: 'capybara', fur: '#A66F45', shirt: '#F1EFE8', accessory: 'clipboard' },
  goose_qa_tester: { species: 'goose', fur: '#F7F2E8', shirt: '#1F4C73', accessory: 'magnifier' },
  raccoon_devops: { species: 'raccoon', fur: '#8B929B', shirt: '#1B2635', accessory: 'wrench' },
  shiba_designer: { species: 'shiba', fur: '#E99B37', shirt: '#252B35', accessory: 'coffee' },
  hamster_intern: { species: 'hamster', fur: '#C98B57', shirt: '#2367A6', accessory: 'backpack' },
  bulldog_boss: { species: 'bulldog', fur: '#B18A68', shirt: '#1E2228', accessory: 'tie' },
};

const ROLE_TO_CHARACTER: Record<string, string> = {
  engineer: 'orange_cat_programmer',
  pm: 'capybara_product_manager',
  qa: 'goose_qa_tester',
  sre: 'raccoon_devops',
  designer: 'shiba_designer',
  intern: 'hamster_intern',
  boss: 'bulldog_boss',
};

const ROLE_LABEL: Record<string, string> = {
  engineer: 'ENGINEER', pm: 'PRODUCT MANAGER', qa: 'QA TESTER', sre: 'DEVOPS / SRE',
  designer: 'DESIGNER', intern: 'INTERN', boss: 'BOSS',
};

// ---- SVG 版 PixelRenderer（坐标语义与 canvas 版一致） ----
class SvgR {
  parts: string[] = [];
  px(x: number, y: number, w: number, h: number, fill: string) {
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
  }
  box(x: number, y: number, w: number, h: number, fill: string) {
    this.px(x - 1, y - 1, w + 2, h + 2, P.o);
    this.px(x, y, w, h, fill);
  }
  // PIL 风格含端点：rect(x0..x1, y0..y1)
  ellipse(x0: number, y0: number, x1: number, y1: number, fill?: string, outline?: string, width = 1) {
    const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
    const f = fill ? `fill="${fill}"` : 'fill="none"';
    const s = outline ? `stroke="${outline}" stroke-width="${width}"` : '';
    this.parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${f} ${s}/>`);
  }
  line(pts: number[], stroke: string, width = 1) {
    const d = pts.map((v, i) => (i % 2 === 0 ? `${i === 0 ? 'M' : 'L'}${v + 0.5}` : `${v + 0.5}`)).join(' ');
    this.parts.push(`<path d="${d}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`);
  }
}

// drawCharacter 的逐笔移植（50×48 画布）
function drawCharacterSvg(r: SvgR, c: CharSpec) {
  const s = c.species, fur = c.fur, shirt = c.shirt, acc = c.accessory || 'laptop';
  r.px(10, 42, 28, 3, '#00000055');
  r.box(15, 34, 7, 8, shirt); r.box(27, 34, 7, 8, shirt); r.box(12, 20, 25, 17, shirt);
  if (s === 'cat' || s === 'shiba' || s === 'raccoon') {
    r.px(11, 7, 8, 8, P.o); r.px(31, 7, 8, 8, P.o); r.box(10, 10, 30, 17, fur);
  } else if (s === 'goose') {
    r.box(16, 7, 17, 20, P.w); r.px(8, 15, 11, 6, P.o); r.px(9, 16, 10, 4, P.y);
  } else {
    r.box(9, 10, 31, 18, fur); r.px(10, 8, 7, 6, P.o); r.px(32, 8, 7, 6, P.o);
  }
  if (s !== 'goose') {
    r.px(16, 15, 4, 4, P.o); r.px(30, 15, 4, 4, P.o); r.px(22, 20, 6, 4, P.c); r.px(24, 20, 2, 2, P.o);
  } else {
    r.px(25, 13, 3, 3, P.o);
  }
  if (s === 'raccoon') { r.px(13, 14, 10, 6, P.dg); r.px(27, 14, 10, 6, P.dg); }
  r.box(6, 23, 7, 12, shirt); r.box(37, 23, 7, 12, shirt);
  if (acc === 'laptop') { r.box(25, 27, 18, 11, P.dg); r.px(32, 31, 5, 2, P.cy); }
  else if (acc === 'clipboard') { r.box(32, 22, 10, 15, P.c); r.px(35, 20, 4, 3, P.o); }
  else if (acc === 'magnifier') { r.ellipse(31, 21, 39, 29, P.cy, P.o); r.line([38, 28, 43, 35], P.o, 2); }
  else if (acc === 'wrench') { r.line([33, 22, 40, 35], '#888', 3); r.px(31, 20, 5, 4, P.o); }
  else if (acc === 'coffee') { r.box(32, 26, 9, 8, P.w); r.px(41, 28, 3, 4, P.o); }
  else if (acc === 'backpack') { r.box(35, 22, 9, 15, P.b); }
  else if (acc === 'tie') { r.px(23, 22, 4, 11, P.r); }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveSpec(role: string, spec?: Partial<CharSpec>): CharSpec {
  const base = CHARACTERS[ROLE_TO_CHARACTER[role]] || CHARACTERS.orange_cat_programmer;
  return { ...base, ...(spec || {}) };
}

/** 护照卡片 SVG（400×400）：8-bit 形象 + 名字 + 角色 */
export function passportCardSvg(name: string, role: string, spec?: Partial<CharSpec>): string {
  const c = resolveSpec(role, spec);
  const r = new SvgR();
  drawCharacterSvg(r, c);
  const roleLabel = ROLE_LABEL[role] || role.toUpperCase();
  // 名字过长时缩小字号，保证不溢出
  const nm = name.slice(0, 24);
  const fontSize = nm.length <= 8 ? 34 : nm.length <= 14 ? 26 : 20;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`,
    `<rect width="400" height="400" fill="${P.db}"/>`,
    `<rect x="10" y="10" width="380" height="380" fill="${P.o}" stroke="${P.y}" stroke-width="4"/>`,
    `<text x="200" y="42" text-anchor="middle" font-family="monospace" font-size="15" letter-spacing="2" fill="${P.y}">BLAME GAME &#183; AGENT PASSPORT</text>`,
    // 形象：50×48 放大 5.6 倍 = 280×268.8，居中
    `<g transform="translate(60,58) scale(5.6)" shape-rendering="crispEdges">${r.parts.join('')}</g>`,
    `<text x="200" y="356" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="${P.w}">${esc(nm)}</text>`,
    `<text x="200" y="381" text-anchor="middle" font-family="monospace" font-size="14" letter-spacing="3" fill="${P.cy}">${esc(roleLabel)}</text>`,
    `</svg>`,
  ].join('');
}

export interface PassportArtInput {
  name: string;
  role: string;
  spec?: Partial<CharSpec>;
  workerHash: string;
}

/** ERC-721 metadata（图片内嵌 SVG data:URI，整体再编码为 data:URI，完全上链、零外部依赖） */
export function passportMetadata(input: PassportArtInput): { json: string; tokenURI: string; metadataHash: string } {
  const svg = passportCardSvg(input.name, input.role, input.spec);
  const image = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  const c = resolveSpec(input.role, input.spec);
  const meta = {
    name: `${input.name} · BLAME GAME Agent`,
    description: `BLAME GAME on-chain Agent Passport (soulbound). Role: ${input.role}. Worker hash: ${input.workerHash}`,
    image,
    attributes: [
      { trait_type: 'Role', value: input.role },
      { trait_type: 'Species', value: c.species },
      { trait_type: 'Fur', value: c.fur },
      { trait_type: 'Shirt', value: c.shirt },
      { trait_type: 'Accessory', value: c.accessory },
    ],
  };
  const json = JSON.stringify(meta);
  const tokenURI = 'data:application/json;base64,' + Buffer.from(json, 'utf8').toString('base64');
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(json));
  return { json, tokenURI, metadataHash };
}

// ============================================================================
// 商店装饰品 NFT 卡片 —— 与 web/src/pixelart.ts drawProp 同源画法（50×50 画布）
// ============================================================================
function drawPropSvg(r: SvgR, n: string) {
  if (n.includes('bug')) {
    const col: Record<string, string> = { red_bug: P.r, green_bug: P.g, purple_bug: P.p, hidden_bug: P.dg };
    r.box(10, 12, 28, 24, col[n] || P.r);
    for (const [x, y] of [[7, 18], [38, 18], [7, 27], [38, 27]]) r.px(x, y, 5, 3, P.o);
    r.px(15, 18, 5, 5, P.o); r.px(30, 18, 5, 5, P.o);
  } else if (n === 'coffee') { r.box(13, 14, 22, 25, P.w); r.px(35, 20, 6, 10, P.o); r.px(16, 17, 16, 5, '#5C3826'); }
  else if (n === 'ticket') { r.box(9, 8, 32, 34, P.c); for (const y of [14, 20, 26, 32]) r.px(14, y, 20, 2, '#7A828E'); }
  else if (n === 'ppt') { r.box(8, 10, 34, 29, P.w); r.px(12, 14, 12, 5, P.r); r.px(12, 23, 24, 3, P.y); }
  else if (n === 'server') { r.box(12, 6, 26, 38, P.dg); for (const y of [10, 18, 26, 34]) { r.px(16, y, 15, 4, '#101217'); r.px(33, y, 2, 2, P.g); } }
  else { r.box(10, 12, 28, 24, P.y); } // 未知道具回退：黄色方块
}

/** 装饰品卡片 SVG（400×400）：8-bit 道具 + 名字 */
export function itemCardSvg(prop: string, itemName: string): string {
  const r = new SvgR();
  drawPropSvg(r, prop);
  const nm = itemName.slice(0, 26);
  const fontSize = nm.length <= 12 ? 28 : nm.length <= 20 ? 22 : 18;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">`,
    `<rect width="400" height="400" fill="${P.db}"/>`,
    `<rect x="10" y="10" width="380" height="380" fill="${P.o}" stroke="${P.cy}" stroke-width="4"/>`,
    `<text x="200" y="42" text-anchor="middle" font-family="monospace" font-size="15" letter-spacing="2" fill="${P.cy}">ADVX TURBO &#183; STORE ITEM</text>`,
    // 道具：50×50 放大 5.2 倍 = 260×260，居中
    `<g transform="translate(70,66) scale(5.2)" shape-rendering="crispEdges">${r.parts.join('')}</g>`,
    `<text x="200" y="362" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${fontSize}" fill="${P.w}">${esc(nm)}</text>`,
    `<text x="200" y="384" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="3" fill="${P.y}">COSMETIC NFT</text>`,
    `</svg>`,
  ].join('');
}

/** 装饰品 ERC-721 metadata（data:URI，完全上链，钱包/浏览器可直接显示图片） */
export function itemMetadata(prop: string, itemName: string, priceCp: number): { json: string; tokenURI: string; metadataHash: string } {
  const svg = itemCardSvg(prop, itemName);
  const image = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  const meta = {
    name: `${itemName} · ADVX Item`,
    description: `ADVX TURBO decorative store item (cosmetic only, no win-rate). Bought with ${priceCp} Coffee Points.`,
    image,
    attributes: [
      { trait_type: 'Kind', value: 'cosmetic' },
      { trait_type: 'Prop', value: prop },
      { trait_type: 'Price (CP)', value: priceCp },
    ],
  };
  const json = JSON.stringify(meta);
  const tokenURI = 'data:application/json;base64,' + Buffer.from(json, 'utf8').toString('base64');
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(json));
  return { json, tokenURI, metadataHash };
}
