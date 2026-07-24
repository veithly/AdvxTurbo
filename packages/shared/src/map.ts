// PRD 8.2 MVP 地图《开放式地狱 / Open Office Hell》 20×14 Tile
import type { RoleId, TaskType } from './types.js';

export interface Zone {
  id: string;
  nameKey: string;
  rect: [number, number, number, number]; // x, y, w, h
  spot: [number, number]; // 工作/交互中心格
  taskTypes?: TaskType[];
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 14;

export const ZONES: Zone[] = [
  { id: 'devDesk', nameKey: 'zone.devDesk', rect: [1, 1, 5, 3], spot: [3, 2], taskTypes: ['code'] },
  { id: 'designDesk', nameKey: 'zone.designDesk', rect: [1, 5, 5, 3], spot: [3, 6], taskTypes: ['design'] },
  { id: 'qa', nameKey: 'zone.qa', rect: [1, 9, 5, 3], spot: [3, 10], taskTypes: ['qa'] },
  { id: 'meeting', nameKey: 'zone.meeting', rect: [7, 1, 6, 3], spot: [10, 2], taskTypes: ['product'] },
  { id: 'pantry', nameKey: 'zone.pantry', rect: [14, 1, 5, 3], spot: [16, 2] },
  { id: 'restroom', nameKey: 'zone.restroom', rect: [14, 5, 3, 3], spot: [15, 6] },
  { id: 'hr', nameKey: 'zone.hr', rect: [7, 5, 4, 3], spot: [9, 6], taskTypes: ['docs'] },
  { id: 'release', nameKey: 'zone.release', rect: [12, 5, 3, 3], spot: [13, 6] },
  { id: 'serverRoom', nameKey: 'zone.serverRoom', rect: [7, 9, 6, 3], spot: [10, 10], taskTypes: ['ops'] },
  { id: 'bossOffice', nameKey: 'zone.bossOffice', rect: [14, 9, 5, 3], spot: [16, 10] },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export const BOSS_PATROL: string[] = ['meeting', 'pantry', 'restroom', 'bossOffice', 'serverRoom', 'devDesk', 'designDesk', 'qa'];

// 出生点 (座位 -> tile)
export const SPAWN_POINTS: Array<[number, number]> = [
  [10, 2], // meeting center-ish
  [9, 3],
  [11, 3],
  [10, 3],
  [8, 2],
  [12, 2],
];

export const BOSS_SPAWN: [number, number] = [16, 10];
export const RELEASE_SPOT: [number, number] = [13, 6];

/** 整个内部为可行走地板；周界为墙。确定性 BFS 保证连通。 */
export function buildWalkable(): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const wall = x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1;
      row.push(!wall);
    }
    grid.push(row);
  }
  return grid;
}

export function zoneAt(x: number, y: number): string {
  for (const z of ZONES) {
    const [zx, zy, zw, zh] = z.rect;
    if (x >= zx && x < zx + zw && y >= zy && y < zy + zh) return z.id;
  }
  return 'floor';
}

export function roleHomeZone(role: RoleId): string {
  switch (role) {
    case 'engineer':
      return 'devDesk';
    case 'pm':
      return 'meeting';
    case 'qa':
      return 'qa';
    case 'sre':
      return 'serverRoom';
    case 'designer':
      return 'designDesk';
    case 'intern':
      return 'hr';
  }
}
