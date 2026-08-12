// 常量定义
import type { Seat } from './types';

// 玩家总数
export const PLAYER_COUNT = 4;

// 庄家初始手牌张数(14, 含首摸)
export const DEALER_HAND_SIZE = 14;
// 闲家初始手牌张数(13)
export const NORMAL_HAND_SIZE = 13;

// 牌库总数
export const TOTAL_TILES = 136;
// 牌型种类
export const TILE_TYPES = 34;
// 每种牌的数量
export const TILES_PER_TYPE = 4;

// 红中最多张数
export const MAX_HONGZHONG = 4;

// 起手胡校验最大重试次数
export const MAX_DEAL_RETRY = 100;

// AI决策偏差概率(5%-10%)
export const AI_ERROR_RATE_MIN = 0.05;
export const AI_ERROR_RATE_MAX = 0.10;

// AI思考延迟(毫秒)
export const AI_THINK_DELAY = 600;

// 座位方位: 0=东(右) 1=南(下/人类) 2=西(左) 3=北(上)
export const HUMAN_SEAT: Seat = 1;

// 玩家名称
export const PLAYER_NAMES = ['东家AI', '玩家(南)', '西家AI', '北家AI'];

// 下一座位(逆时针: 1南→0东→3北→2西→1南)
export function nextSeat(seat: Seat): Seat {
  return ((seat + 3) % 4) as Seat;
}

// 前一座位
export function prevSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

// 其他三家(按逆时针行动顺序)
export function otherSeats(seat: Seat): Seat[] {
  return [nextSeat(seat), ((seat + 2) % 4) as Seat, prevSeat(seat)];
}
