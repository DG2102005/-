// 手牌排列算法
// 规则: 同类聚合 万→筒→条→字，同类按点数升序，字牌顺序 东南西北中发白
// 红中(z5)作为字牌一员，按字牌内部顺序排在"中"位(z5在z4北与z6发之间)
// 相同的牌放置在一起形成牌组(同代码连续)
import type { Tile } from './types';
import { tileCode } from './types';

// 牌排序权重(用于全局排序)
function sortWeight(t: Tile): number {
  const base = t.suit === 'm' ? 0 : t.suit === 'p' ? 100 : t.suit === 's' ? 200 : 300;
  return base + t.rank;
}

// 排列手牌(返回新数组，不修改原数组)
// 同代码牌连续放置，形成牌组(如三张5万紧挨)
export function sortHand(hand: Tile[]): Tile[] {
  return hand.slice().sort((a, b) => {
    const w = sortWeight(a) - sortWeight(b);
    if (w !== 0) return w;
    // 同代码稳定排序保持原相对顺序(实例id递增)
    return a.id - b.id;
  });
}

// 原地排列(返回同一引用)
export function sortHandInPlace(hand: Tile[]): Tile[] {
  hand.sort((a, b) => {
    const w = sortWeight(a) - sortWeight(b);
    if (w !== 0) return w;
    return a.id - b.id;
  });
  return hand;
}

// 将新摸的牌追加到手牌末尾(不参与排序)，返回新手牌引用
// 用于"摸牌后新牌置最右，等待玩家确认出牌后再整理"
export function appendDrawnTile(hand: Tile[], tile: Tile): Tile[] {
  hand.push(tile);
  return hand;
}

// 判定两张牌是否同代码(用于视觉分组提示)
export function isSameCode(a: Tile, b: Tile): boolean {
  return tileCode(a) === tileCode(b);
}
