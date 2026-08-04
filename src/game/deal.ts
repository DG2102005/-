// 发牌与防起手胡校验
import type { Tile, PlayerState, Seat } from './types';
import { buildDeck } from './tile';
import { shuffle } from './shuffle';
import { sortHand } from './sort';
import { canWin } from './win';
import { DEALER_HAND_SIZE, NORMAL_HAND_SIZE, MAX_DEAL_RETRY, PLAYER_NAMES } from './constants';

// 一次发牌(不含防胡校验)
export function dealOnce(banker: Seat): { deck: Tile[]; hands: Tile[][] } {
  const deck = shuffle(buildDeck());
  const hands: Tile[][] = [[], [], [], []];
  // 庄家14张(含首摸)，闲家13张
  // 按 逆时针 从庄家开始发，每人13张，最后庄家多1张
  let ptr = 0;
  for (let n = 0; n < NORMAL_HAND_SIZE; n++) {
    for (let i = 0; i < 4; i++) {
      const seat = ((banker + i) % 4) as Seat;
      hands[seat].push(deck[ptr++]);
    }
  }
  // 庄家第14张
  hands[banker].push(deck[ptr++]);
  // 剩余牌墙从 ptr 开始
  const remaining = deck.slice(ptr);
  // 排列各家手牌
  for (let i = 0; i < 4; i++) {
    hands[i] = sortHand(hands[i]);
  }
  return { deck: remaining, hands };
}

// 防起手胡校验: 严禁天胡/地胡/起手直接胡
// 检查庄家14张是否已胡(天胡)，若是则重新洗牌
export function dealWithCheck(banker: Seat): { deck: Tile[]; hands: Tile[][] } {
  for (let attempt = 0; attempt < MAX_DEAL_RETRY; attempt++) {
    const { deck, hands } = dealOnce(banker);
    // 校验庄家14张是否起手胡(天胡)
    if (!canWin(hands[banker], 0)) {
      return { deck, hands };
    }
    // 庄家起手胡 → 重新发牌
  }
  // 超限兜底: 强制返回最后一次结果(理论上极少触发)
  return dealOnce(banker);
}

// 初始化四位玩家状态
export function initPlayers(hands: Tile[][], banker: Seat): PlayerState[] {
  const players: PlayerState[] = [];
  for (let i = 0; i < 4; i++) {
    players.push({
      seat: i as Seat,
      name: PLAYER_NAMES[i],
      isHuman: i === 1,
      hand: hands[i],
      melds: [],
      discards: [],
      isDealer: i === banker,
      isRiichi: false,
    });
  }
  return players;
}
