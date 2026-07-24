import { sha256Hex } from './hash.js';

// 确定性 PRNG (mulberry32) + 基于种子的独立子流 (PRD 21.3)
export class Rng {
  private s: number;
  public calls = 0;

  constructor(seedHex: string) {
    // 取哈希前 8 hex 作为 32-bit 种子
    const h = sha256Hex(seedHex);
    this.s = parseInt(h.slice(0, 8), 16) >>> 0;
  }

  next(): number {
    this.calls++;
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 整数含端点 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** bps 概率命中 (0-10000) */
  chance(bps: number): boolean {
    return this.next() * 10000 < bps;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 加权抽取 */
  weighted<T>(items: T[], weightOf: (t: T) => number): T {
    let total = 0;
    for (const it of items) total += weightOf(it);
    let r = this.next() * total;
    for (const it of items) {
      r -= weightOf(it);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
}

/** 为每个 Agent 派生独立子流，避免调用次数互相干扰 (PRD 21.3) */
export function subStreamSeed(finalSeed: string, label: string): string {
  return sha256Hex(finalSeed + '::' + label);
}
