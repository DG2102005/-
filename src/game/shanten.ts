// 精确向听数计算(红中百搭)
//
// 平胡路(标准型): DFS 枚举面子/搭子/雀头组合, 最大化价值 score = 2×面子 + 搭子 + 雀头
//   向听 = (2×needMelds + 1) − bestScore, 约束 面子+搭子 ≤ needMelds
// 七小路(仅无副露): 向听 = 6 − 对子数(红中补对: 1红+1单=1对, 2红=1对)
// 取两者最小值
import type { Tile } from './types';
import { isHongZhong, indexToTile } from './types';
import { buildCounts, canWin } from './win';

const N = 34;

// 七小对向听: 6 - 有效对子数
function sevenPairsShanten(counts: number[], wild: number): number {
  let p0 = 0;
  let s0 = 0;
  for (let i = 0; i < N; i++) {
    const c = counts[i];
    p0 += c >> 1;
    s0 += c & 1;
  }
  const a = Math.min(s0, wild); // 红中+单张 补对
  const b = (wild - a) >> 1;    // 2红中 自凑对
  const pairs = p0 + a + b;
  return Math.max(0, 6 - pairs);
}

// 标准型向听: DFS 最大化 2×面子+搭子+雀头
function stdShanten(counts: number[], wild: number, needMelds: number): number {
  let best = -1;
  const memo = new Map<string, number>();

  function dfs(counts: number[], wild: number, m: number, t: number, h: number): void {
    const score = 2 * m + t + h;
    if (score > best) best = score;
    if (best >= 2 * needMelds + 1) return; // 已听牌, 无法更好
    const groups = m + t;
    if (groups >= needMelds) return;

    const key = counts.join(',') + '|' + wild + '|' + (needMelds - groups) + '|' + (h ? 1 : 0);
    const prev = memo.get(key);
    if (prev !== undefined && prev >= score) return;
    memo.set(key, score);

    // 找最低非空索引(规范优先处理, 保证该牌被消耗或丢弃)
    let c = -1;
    for (let i = 0; i < N; i++) {
      if (counts[i] > 0) { c = i; break; }
    }

    if (c === -1) {
      // 只剩红中: 每3红=1面子, 每2红=1雀头/1搭子
      const f = Math.min(Math.floor(wild / 3), needMelds - groups);
      const rem = wild - f * 3;
      let s = 2 * (m + f) + t + h;
      if (rem >= 2 && groups + f < needMelds) s += 1;
      if (s > best) best = s;
      return;
    }

    const have = counts[c];

    // 分支1: 刻子 take张实牌 + (3-take)张红中
    const maxTake = Math.min(have, 3);
    for (let take = maxTake; take >= 1; take--) {
      const wc = 3 - take;
      if (wild >= wc) {
        counts[c] -= take;
        dfs(counts, wild - wc, m + 1, t, h);
        counts[c] += take;
      }
    }

    // 分支2: 顺子(仅数字牌), c必为实牌, 其余位置实牌/红中枚举
    if (c < 27) {
      const blockStart = Math.floor(c / 9) * 9;
      const blockEnd = blockStart + 9;
      for (let start = Math.max(blockStart, c - 2); start <= c; start++) {
        if (start + 2 >= blockEnd) continue;
        const positions = [start, start + 1, start + 2];
        const cIdx = positions.indexOf(c);
        for (let mask = 0; mask < 4; mask++) {
          let wc = 0;
          let ok = true;
          const useReal: boolean[] = [];
          for (let j = 0; j < 3; j++) {
            if (j === cIdx) { useReal.push(true); continue; }
            const ur = ((mask >> (j > cIdx ? j - 1 : j)) & 1) === 1;
            useReal.push(ur);
            if (ur) {
              if (counts[positions[j]] < 1) { ok = false; break; }
            } else {
              wc++;
            }
          }
          if (!ok || wild < wc) continue;
          for (let j = 0; j < 3; j++) {
            if (j === cIdx || !useReal[j]) continue;
            counts[positions[j]]--;
          }
          counts[c]--;
          dfs(counts, wild - wc, m + 1, t, h);
          counts[c]++;
          for (let j = 0; j < 3; j++) {
            if (j === cIdx || !useReal[j]) continue;
            counts[positions[j]]++;
          }
        }
      }
    }

    // 分支3: 对子 → 雀头或搭子 (2实 或 1实+1红)
    if (have >= 2) {
      counts[c] -= 2;
      if (h === 0) dfs(counts, wild, m, t, 1);
      dfs(counts, wild, m, t + 1, h);
      counts[c] += 2;
    }
    if (wild >= 1) {
      counts[c] -= 1;
      if (h === 0) dfs(counts, wild - 1, m, t, 1);
      dfs(counts, wild - 1, m, t + 1, h);
      counts[c] += 1;
    }

    // 分支4: 孤张丢弃
    counts[c] -= 1;
    dfs(counts, wild, m, t, h);
    counts[c] += 1;
  }

  dfs(counts.slice(), wild, 0, 0, 0);
  return 2 * needMelds + 1 - best;
}

// 模块级缓存(牌型代码 -> 向听), 跨调用共享避免重复搜索
const CORE_CACHE = new Map<string, number>();

function calcShanten13(hand: Tile[], meldsCount: number): number {
  const codes = hand.map((t) => (isHongZhong(t) ? 'z5' : t.suit + t.rank)).sort();
  const key = meldsCount + '|' + codes.join(',');
  const cached = CORE_CACHE.get(key);
  if (cached !== undefined) return cached;

  const { counts, wild } = buildCounts(hand);
  let result: number;
  if (meldsCount === 0) {
    result = Math.min(
      sevenPairsShanten(counts, wild),
      stdShanten(counts, wild, 4),
    );
  } else {
    result = stdShanten(counts, wild, 4 - meldsCount);
  }

  if (CORE_CACHE.size > 8000) CORE_CACHE.clear();
  CORE_CACHE.set(key, result);
  return result;
}

// 向听数核心: 支持13张(正常)与14张(已胡=-1, 否则取弃一牌后最小向听)
export function calcShantenFromBase(hand: Tile[], meldsCount: number): number {
  const needMelds = 4 - meldsCount;
  const baseLen = needMelds * 3 + 1; // 13张(无副露)听牌长度

  if (hand.length === baseLen + 1) {
    // 14张: 已胡=-1, 否则 min over 弃一牌
    if (canWin(hand, meldsCount)) return -1;
    let best = 99;
    const tried = new Set<string>();
    for (const t of hand) {
      if (!isHongZhong(t)) {
        const code = t.suit + t.rank;
        if (tried.has(code)) continue;
        tried.add(code);
      }
      const rest = hand.filter((x) => x.id !== t.id);
      const s = calcShanten13(rest, meldsCount);
      if (s < best) best = s;
      if (best === 0) break;
    }
    return best;
  }

  if (hand.length === baseLen) {
    return calcShanten13(hand, meldsCount);
  }

  if (hand.length === baseLen - 1) {
    // 12张: 标准型公式直接适用; 七小对不可能已胡, 至少1
    const codes = hand.map((t) => (isHongZhong(t) ? 'z5' : t.suit + t.rank)).sort();
    const key = meldsCount + '|' + codes.join(',');
    const cached = CORE_CACHE.get(key);
    if (cached !== undefined) return cached;
    const { counts, wild } = buildCounts(hand);
    let result: number;
    if (meldsCount === 0) {
      result = Math.min(
        Math.max(1, sevenPairsShanten(counts, wild)),
        stdShanten(counts, wild, 4),
      );
    } else {
      result = stdShanten(counts, wild, 4 - meldsCount);
    }
    if (CORE_CACHE.size > 8000) CORE_CACHE.clear();
    CORE_CACHE.set(key, result);
    return result;
  }

  return 99;
}

// 计数数组版向听数(compile 测试用): counts[31] 为红中数量
export function calcShantenFromCounts(counts: number[], meldsCount: number): number {
  const tiles: Tile[] = [];
  let id = -20000;
  const N = 34;
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < counts[i]; k++) {
      const t = indexToTile(i);
      tiles.push({ id: id++, suit: t.suit, rank: t.rank });
    }
  }
  return calcShantenFromBase(tiles, meldsCount);
}