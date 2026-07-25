// 《Advx 极速版》会场区域常量 —— simulate/context 共用（zone id 沿用旧地图 id）
export const WORKSTATION_ZONES = new Set(['devDesk', 'designDesk', 'qa', 'serverRoom']); // 端点A/B/C/D
export const ENDPOINT_ZONES = ['devDesk', 'designDesk', 'qa', 'serverRoom'];
export const REST_ZONE = 'meeting';       // 蓝盒子休息区：回部分精力，最多 3 个位置
export const CANTEEN_ZONE = 'hr';         // 食堂：等 5s 加灵感+精力
export const HOTEL_ZONE = 'release';      // 酒店排队区：一个一个排，补满精力，30s 冷却
export const WORKSHOP_ZONE = 'bossOffice';  // 工作坊：加灵感（原工作人员站）
export const SPONSOR_ZONE = 'pantry';       // 赞助商展台：发道具→提速buff+灵感
export const RESTROOM_ZONE = 'restroom';    // 厕所：减压安全区
export const REST_SLOTS = 3;
export const CANTEEN_WAIT_TICKS = 25;     // 5s @5Hz
export const HOTEL_SERVE_TICKS = 15;      // 3s @5Hz
export const HOTEL_COOLDOWN_TICKS = 150;  // 30s @5Hz
export const SPONSOR_CD_TICKS = 110;        // 展商发道具冷却 ~22s
export const SPONSOR_QODER_TICKS = 90;      // 展商提速buff时长 ~18s
