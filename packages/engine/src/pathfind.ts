import { MAP_WIDTH, MAP_HEIGHT } from '@blame/shared';

export type Grid = boolean[][];

/** 确定性 BFS：返回从 start 迈向 goal 的下一步 (每 Tick 移动 1 格)。找不到路径返回 null。 */
export function nextStep(grid: Grid, start: [number, number], goal: [number, number]): [number, number] | null {
  const [sx, sy] = start;
  const [gx, gy] = goal;
  if (sx === gx && sy === gy) return null;
  const key = (x: number, y: number) => y * MAP_WIDTH + x;
  const visited = new Set<number>([key(sx, sy)]);
  const prev = new Map<number, number>();
  const queue: Array<[number, number]> = [[sx, sy]];
  // 固定邻居顺序保证确定性: 上、右、下、左
  const dirs: Array<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    if (cx === gx && cy === gy) {
      // 回溯到 start 的第一步
      let cur = key(gx, gy);
      const path: number[] = [cur];
      while (prev.has(cur)) {
        cur = prev.get(cur)!;
        path.push(cur);
      }
      path.reverse();
      if (path.length < 2) return null;
      const stepKey = path[1];
      return [stepKey % MAP_WIDTH, Math.floor(stepKey / MAP_WIDTH)];
    }
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_HEIGHT) continue;
      if (!grid[ny][nx]) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);
      prev.set(k, key(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function manhattan(a: [number, number], b: [number, number]): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/** 老板视锥：半径 6，约 100° 朝向锥形；此处用曼哈顿距离 + 朝向点积近似 (PRD 12.3) */
export function bossSees(
  bossPos: [number, number],
  facing: [number, number],
  target: [number, number],
  radius = 6
): boolean {
  const dx = target[0] - bossPos[0];
  const dy = target[1] - bossPos[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return true;
  if (dist > radius) return false;
  const fLen = Math.sqrt(facing[0] * facing[0] + facing[1] * facing[1]) || 1;
  const dot = (dx * facing[0] + dy * facing[1]) / (dist * fLen);
  // cos(50°) ≈ 0.64 —— 半角 50° => 视锥 100°
  return dot >= 0.5;
}
