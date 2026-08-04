// AI决策引擎 (模拟普通棋牌室玩家)
// 视野: 仅自己的手牌 + 桌面公共明牌(各家弃牌/碰杠)
// 策略: 价值评估 + 阶段攻防 + 随机偏差，非完美最优
import type { PlayerState, GameState, Tile, ActionOption, Seat } from './types';
import { tileCode, isHongZhong, tileIndex } from './types';
import { checkTing } from './win';
import { AI_ERROR_RATE_MIN, AI_ERROR_RATE_MAX } from './constants';

// 随机偏差因子
function rand01(): number {
  return Math.random();
}
function errorRate(): number {
  return AI_ERROR_RATE_MIN + Math.random() * (AI_ERROR_RATE_MAX - AI_ERROR_RATE_MIN);
}

// 统计桌面已见牌(各家弃牌+碰杠明牌+自己手牌)
function buildSeen(state: GameState, self: PlayerState): number[] {
  const seen = new Array(34).fill(0);
  for (const t of self.hand) {
    if (!isHongZhong(t)) seen[tileIndex(t)]++;
  }
  for (const p of state.players) {
    for (const t of p.discards) {
      if (!isHongZhong(t)) seen[tileIndex(t)]++;
    }
    for (const m of p.melds) {
      for (const t of m.tiles) {
        if (!isHongZhong(t)) seen[tileIndex(t)]++;
      }
    }
  }
  return seen;
}

// 手牌中某代码数量(非红中)
function countCode(hand: Tile[], code: string): number {
  let c = 0;
  for (const t of hand) {
    if (!isHongZhong(t) && tileCode(t) === code) c++;
  }
  return c;
}

// 单张牌的保留价值(越高越该留)
function keepScore(tile: Tile, hand: Tile[]): number {
  if (isHongZhong(tile)) return 999; // 百搭，绝不轻易打
  const code = tileCode(tile);
  const cnt = countCode(hand, code);
  let score = 0;
  if (cnt >= 4) score += 90;
  else if (cnt === 3) score += 80;
  else if (cnt === 2) score += 50;
  else score += 0;

  if (tile.suit !== 'z') {
    const rank = tile.rank;
    const prev = hand.some((t) => !isHongZhong(t) && tileCode(t) === `${tile.suit}${rank - 1}`);
    const next = hand.some((t) => !isHongZhong(t) && tileCode(t) === `${tile.suit}${rank + 1}`);
    if (prev && next) score += 40;
    else if (prev || next) score += 25;
    else {
      if (rank === 1 || rank === 9) score += 0;
      else if (rank === 2 || rank === 8) score += 5;
      else score += 10;
    }
  } else {
    if (cnt === 1) score += 5; // 孤张字牌
  }
  return score;
}

// 判断是否后期(牌堆所剩不多)
function isLateGame(state: GameState): boolean {
  return state.deck.length < 30;
}

// 是否有人接近听牌(粗略: 副露多或牌堆少)
function someoneNearTenpai(state: GameState): boolean {
  for (const p of state.players) {
    if (p.melds.length >= 2) return true;
  }
  return state.deck.length < 40;
}

// 选择出牌
export function aiDecideDiscard(player: PlayerState, state: GameState): number {
  const hand = player.hand;
  const seen = buildSeen(state, player);
  const late = isLateGame(state);
  const near = someoneNearTenpai(state);

  let best = hand[0];
  let bestScore = -Infinity;

  for (const t of hand) {
    let desirability = -keepScore(t, hand); // 越没用越想打出(负值得分大)

    // 听牌奖励: 弃此牌后是否听牌
    const remain = hand.filter((x) => x.id !== t.id);
    const ting = checkTing(remain, player.melds.length);
    if (ting.length > 0) {
      desirability += 60 + ting.length * 8; // 听牌则倾向保留该形态
    }

    // 安全性(后期): 已见多的牌更安全
    if (late) {
      const code = tileCode(t);
      const idx = tileIndex(t);
      const seenCount = seen[idx];
      // 已见越多越安全(打出去不易点炮，但本玩法仅自摸，安全主要避免破坏自己)
      if (seenCount >= 2) desirability += 15;
      else if (seenCount === 0 && t.suit !== 'z' && !isHongZhong(t)) desirability -= 10;
    }

    // 多家接近听牌时偏保守: 倾向打已见过的牌
    if (near && late) {
      const idx = tileIndex(t);
      if (seen[idx] >= 1) desirability += 5;
    }

    // 随机偏差
    desirability += (Math.random() - 0.5) * (errorRate() * 200);

    if (desirability > bestScore) {
      bestScore = desirability;
      best = t;
    }
  }
  return best.id;
}

// 他人出牌后的碰/杠决策
export function aiDecideAction(
  options: ActionOption[],
  player: PlayerState,
  state: GameState
): ActionOption | 'pass' {
  // 优先级: 杠 > 碰
  // 先评估碰/杠对听牌的影响
  const beforeTing = checkTing(player.hand, player.melds.length);

  // 随机失误: 直接放弃
  if (Math.random() < errorRate() * 0.5) return 'pass';

  // 评估碰
  const pengOpt = options.find((o) => o.type === 'peng');
  const gangOpt = options.find((o) => o.type === 'minggang');

  // 杠: 多数情况接受(得到副露+补牌)
  if (gangOpt) {
    if (Math.random() < 0.85) return gangOpt;
  }

  if (pengOpt) {
    // 模拟碰后手牌
    const simHand = player.hand.filter((t) => {
      // 移除2张该代码
      return true;
    });
    // 简化评估: 该代码在手牌中的张数
    const code = tileCode(pengOpt.tile!);
    const cnt = countCode(player.hand, code);
    // 计算碰后是否更接近听牌
    const afterHand = removeFirstN(player.hand, code, 2);
    const afterTing = checkTing(afterHand, player.melds.length + 1);
    const improves = afterTing.length > beforeTing.length || afterTing.length >= 1;
    if (cnt === 2 && improves) {
      // 有利碰
      if (Math.random() < 0.8) return pengOpt;
    } else if (cnt === 2) {
      // 中性碰
      if (Math.random() < 0.4) return pengOpt;
    }
  }
  return 'pass';
}

// 移除手牌中前n张指定代码(返回新数组)
function removeFirstN(hand: Tile[], code: string, n: number): Tile[] {
  const result = hand.slice();
  let removed = 0;
  for (let i = result.length - 1; i >= 0 && removed < n; i--) {
    if (!isHongZhong(result[i]) && tileCode(result[i]) === code) {
      result.splice(i, 1);
      removed++;
    }
  }
  return result;
}

// 自摸操作决策(暗杠/补杠)
export function aiDecideSelfAction(
  options: ActionOption[],
  player: PlayerState,
  state: GameState
): ActionOption | 'pass' {
  if (Math.random() < errorRate() * 0.3) return 'pass';
  // 暗杠: 通常有利(4张同款变副露+补牌)
  const angang = options.find((o) => o.type === 'angang');
  if (angang && Math.random() < 0.9) return angang;
  // 补杠: 多数接受
  const bugang = options.find((o) => o.type === 'bugang');
  if (bugang && Math.random() < 0.85) return bugang;
  return 'pass';
}
