// 内置题库：自动生成 + 固定精选
// 使用 calcShantenFromCounts 做精确向听计算
import { canMelds, calcShantenFromCounts } from '../game/win';
import type { QuizQuestion, QuizCategory, Difficulty } from '../game/quizTypes';

// ─── 常量 ──────────────────────────────────────
const ALL_CATEGORIES: QuizCategory[] = ['搭子取舍', '听牌选择', '红中运用', '对子处理', '金张判断', '综合复杂'];
const SUITS = ['m', 'p', 's'] as const;
const WAN = [0, 1, 2, 3, 4, 5, 6, 7, 8];   // idx 0-8
const TONG = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // idx 9-17
const TIAO = [18, 19, 20, 21, 22, 23, 24, 25, 26]; // idx 18-26
const HONORS = [27, 28, 29, 30, 31, 32, 33];

// ─── 牌索引 ↔ 牌码工具 ────────────────────────
function idxToCode(i: number): string {
  if (i < 0 || i >= 34) return '';
  if (i < 27) {
    const suit = i < 9 ? 'm' : i < 18 ? 'p' : 's';
    return suit + ((i % 9) + 1);
  }
  return ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'][i - 27];
}

function codeToIdx(c: string): number {
  const s = c[0], r = parseInt(c.slice(1), 10);
  return s === 'm' ? r - 1 : s === 'p' ? 8 + r : s === 's' ? 17 + r : 26 + r;
}

function idxToName(i: number): string {
  if (i < 0 || i >= 34) return '';
  if (i < 27) {
    const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const suit = i < 9 ? '万' : i < 18 ? '筒' : '条';
    return cn[i % 9] + suit;
  }
  return ['东', '南', '西', '北', '中', '发', '白'][i - 27];
}

function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

// ─── 向听计算 wrappers ─────────────────────────

// 快速向听：穷举最大面子数 + canMelds 验证将的存在性
// 相比 calcShantenFromCounts 快约 30 倍（canMelds 有 LRU 缓存），适合批量筛选
function fastShanten(counts: number[], wild: number, needMelds: number): number {
  // Step 1: 找到可组成的最大面子数（利用 canMelds 缓存）
  let maxMelds = 0;
  for (let m = 0; m <= needMelds; m++) {
    if (canMelds(counts, wild, m)) maxMelds = m;
  }

  // Step 2: 用 canMelds 验证是否存在一种分配，使得 maxMelds 面子之外还有将
  // 这与 canMelds 的实际分配完全一致，避免贪心重构导致的偏差
  let hasPair = false;
  // 2a) 2 张实牌成对（canMelds(counts,wild,maxMelds) 已缓存命中）
  for (let c = 0; c < 34 && !hasPair; c++) {
    if (counts[c] >= 2) {
      counts[c] -= 2;
      if (canMelds(counts, wild, maxMelds)) hasPair = true;
      counts[c] += 2;
    }
  }
  // 2b) 1 实牌 + 1 红中成对
  if (!hasPair && wild >= 1) {
    for (let c = 0; c < 34 && !hasPair; c++) {
      if (counts[c] >= 1) {
        counts[c] -= 1;
        if (canMelds(counts, wild - 1, maxMelds)) hasPair = true;
        counts[c] += 1;
      }
    }
  }
  // 2c) 2 红中自凑成对
  if (!hasPair && wild >= 2) {
    if (canMelds(counts, wild - 2, maxMelds)) hasPair = true;
  }

  return 2 * (needMelds - maxMelds) - (hasPair ? 1 : 0);
}

// 精确向听校验（用全穷举版本，放在最终校验处）

function codesToCounts(codes: string[]): { counts: number[]; wild: number } {
  const counts = new Array(34).fill(0);
  let wild = 0;
  for (const c of codes) {
    if (c === 'z5') { wild++; continue; }
    const idx = codeToIdx(c);
    if (idx >= 0 && idx < 34) counts[idx]++;
  }
  return { counts, wild };
}

function shantenOf14(codes: string[], meldCount: number): number {
  const { counts, wild } = codesToCounts(codes);
  return fastShanten(counts, wild, 4 - meldCount);
}

function analyze13(codes: string[], meldCount: number): { shanten: number; incoming: number[] } {
  const { counts, wild } = codesToCounts(codes);
  const need = 4 - meldCount;

  // 先用快速算法
  const base = fastShanten(counts, wild, need);

  // 进牌：也只快速估算
  const incoming: number[] = [];
  for (let i = 0; i < 34; i++) {
    counts[i]++;
    if (fastShanten(counts, wild, need) < base) incoming.push(i);
    counts[i]--;
  }

  return { shanten: base, incoming };
}

// 精确校验：确认最佳答案确实对（答题时用）
function verifyDiscard(
  handCodes: string[],
  discardCode: string,
  meldCount: number,
): { shanten: number; incoming: number[] } {
  const remain = [...handCodes];
  const idx = remain.indexOf(discardCode);
  if (idx >= 0) remain.splice(idx, 1);
  const { counts, wild } = codesToCounts(remain);
  const base = calcShantenFromCounts({ counts, wild }, meldCount);
  const incoming: number[] = [];
  for (let i = 0; i < 34; i++) {
    counts[i]++;
    if (calcShantenFromCounts({ counts, wild }, meldCount) < base) incoming.push(i);
    counts[i]--;
  }
  return { shanten: base, incoming };
}

// ─── 手牌生成器（返回 idx 数组 + 红中数）─────────
// 生成 count 张普通牌 + wildCount 张红中

type GeneratedHand = { tiles: number[]; wilds: number[] };

// 随机手牌基线
function randomHand(total: number, wildCount: number): GeneratedHand {
  const tiles: number[] = [];
  const wilds: number[] = [];
  for (let i = 0; i < wildCount; i++) wilds.push(31); // z5 = idx 31
  const nonWild = total - wildCount;
  for (let i = 0; i < nonWild; i++) {
    tiles.push(Math.floor(Math.random() * 27)); // 仅万筒条
  }
  return { tiles, wilds };
}

// 生成带结构的手牌
// pattern: 明确指定有几组刻子、顺子、搭子、对子、孤张
function structuredHand(pattern: {
  triplets: number;   // 刻子数
  sequences: number;  // 顺子数
  pairs: number;       // 对子数
  tatsu: number;       // 搭子数（两面/嵌张/边张）
  singles: number;     // 孤张数
  wilds: number;       // 红中数
}): GeneratedHand {
  const tiles: number[] = [];
  const wilds: number[] = [];
  for (let i = 0; i < pattern.wilds; i++) wilds.push(31); // z5

  // 刻子
  for (let i = 0; i < pattern.triplets; i++) {
    const idx = Math.floor(Math.random() * 27);
    for (let k = 0; k < 3; k++) tiles.push(idx);
  }

  // 顺子（不给带19的边张顺子，免得太简单）
  for (let i = 0; i < pattern.sequences; i++) {
    const suitBase = Math.floor(Math.random() * 3) * 9;
    const start = Math.floor(Math.random() * 7); // 0-6，对应 rank 1-7
    const base = suitBase + start;
    tiles.push(base, base + 1, base + 2);
  }

  // 对子（万筒条中的随机对子）
  for (let i = 0; i < pattern.pairs; i++) {
    const idx = Math.floor(Math.random() * 27);
    tiles.push(idx, idx);
  }

  // 搭子（两面：idx+idx+1 或 嵌张：idx+idx+2）
  for (let i = 0; i < pattern.tatsu; i++) {
    const isRyanmen = Math.random() < 0.65; // 65% 两面，35% 嵌张
    if (isRyanmen) {
      const suitBase = Math.floor(Math.random() * 3) * 9;
      const start = Math.floor(Math.random() * 8); // 0-7
      tiles.push(suitBase + start, suitBase + start + 1);
    } else {
      const suitBase = Math.floor(Math.random() * 3) * 9;
      const start = Math.floor(Math.random() * 7); // 0-6
      tiles.push(suitBase + start, suitBase + start + 2);
    }
  }

  // 孤张
  for (let i = 0; i < pattern.singles; i++) {
    tiles.push(Math.floor(Math.random() * 27));
  }

  return { tiles, wilds };
}

// 将 GeneratedHand 转为 code 数组
function toCodes(gh: GeneratedHand): string[] {
  const out: string[] = [];
  for (const t of gh.tiles) out.push(idxToCode(t));
  for (const w of gh.wilds) out.push('z5');
  return out;
}

// ─── 单题生成 ──────────────────────────────────

function makeQuestion(
  id: string,
  category: string,
  difficulty: Difficulty,
  handCodes: string[],
  meldCount: number,
): QuizQuestion | null {
  // 收集可弃的牌（每种最多出现4次，只要手牌中存在的非红中牌）
  const unique = new Set<string>();
  for (const c of handCodes) {
    if (c !== 'z5') unique.add(c);
  }

  if (unique.size < 4) return null; // 不够4个选项

  // 选4个候选项
  const candidates = [...unique].sort(() => Math.random() - 0.5).slice(0, 4);

  // 先用快速算法初步筛选
  const fastResults = candidates.map((discardCode) => {
    const remain = [...handCodes];
    const idx = remain.indexOf(discardCode);
    remain.splice(idx, 1);
    const { shanten, incoming } = analyze13(remain, meldCount);
    return { code: discardCode, shanten, incoming };
  });

  fastResults.sort((a, b) => a.shanten - b.shanten || b.incoming.length - a.incoming.length);

  const fastBest = fastResults[0];
  const fastSecond = fastResults[1];

  // 如果并列第一，放弃这题
  if (fastBest.shanten === fastSecond.shanten && fastBest.incoming.length === fastSecond.incoming.length) {
    return null;
  }

  // 精确校验最佳答案
  const exactResults = candidates.map((discardCode) => {
    const { shanten, incoming } = verifyDiscard(handCodes, discardCode, meldCount);
    return { code: discardCode, shanten, incoming };
  });

  exactResults.sort((a, b) => a.shanten - b.shanten || b.incoming.length - a.incoming.length);

  const exactBest = exactResults[0];
  const exactSecond = exactResults[1];

  // 精确校验：如果并列，放弃
  if (exactBest.shanten === exactSecond.shanten && exactBest.incoming.length === exactSecond.incoming.length) {
    return null;
  }

  const answerIndex = candidates.indexOf(exactBest.code) as 0 | 1 | 2 | 3;

  // 生成解释
  const answerName = idxToName(codeToIdx(exactBest.code));
  let explanation = '';
  if (exactBest.shanten === 0) {
    explanation = `打${answerName}后直接听牌！`;
    if (exactBest.incoming.length > 0) {
      explanation += `听 ${exactBest.incoming.map((i) => idxToName(i)).join('、')}`;
    }
  } else if (exactBest.shanten === 1) {
    explanation = `打${answerName}后为"一向听"（差1张听牌）。`;
    if (exactBest.incoming.length > 0) {
      explanation += `有 ${exactBest.incoming.length} 种进牌可听牌`;
      if (exactBest.incoming.length >= 4) explanation += '，门数多、改良空间大';
      explanation += '。';
    }
  } else {
    explanation = `打${answerName}后向听${exactBest.shanten}，为最佳选择。`;
    if (exactSecond.shanten > exactBest.shanten) {
      explanation += ` 比其他选项好 ${exactSecond.shanten - exactBest.shanten} 向听。`;
    } else if (exactBest.incoming.length > exactSecond.incoming.length) {
      explanation += ` 虽同向听但门数更多（${exactBest.incoming.length} vs ${exactSecond.incoming.length}）。`;
    }
  }

  const now = Date.now();
  return {
    id, category, difficulty,
    handCodes,
    meldCount,
    question: '看这手牌，打哪一牌最优？',
    optionCodes: candidates,
    answerIndex,
    explanation,
    discardsPool: candidates,
    tags: [],
    version: 2,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── 为指定类别生成1题 ─────────────────────────

function generateOneQuestion(
  id: string,
  category: string,
  difficulty: Difficulty,
): QuizQuestion | null {
  let handCodes: string[];
  let pattern: any;

  switch (category) {
    case '搭子取舍':
      // 2-3 个搭子要取舍
      if (difficulty === 'easy') {
        pattern = { triplets: 1, sequences: 0, pairs: 1, tatsu: 2, singles: 3, wilds: 0 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 3, singles: 2, wilds: 0 };
      } else {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 3, singles: 1, wilds: 1 };
      }
      break;

    case '听牌选择':
      // 接近听牌，可能需要在不同听牌方案间选择
      if (difficulty === 'easy') {
        pattern = { triplets: 1, sequences: 1, pairs: 1, tatsu: 2, singles: 2, wilds: 0 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 2, pairs: 1, tatsu: 2, singles: 1, wilds: 0 };
      } else {
        pattern = { triplets: 0, sequences: 2, pairs: 1, tatsu: 2, singles: 0, wilds: 1 };
      }
      break;

    case '红中运用':
      // 手上至少有 1-2 张红中
      if (difficulty === 'easy') {
        pattern = { triplets: 1, sequences: 0, pairs: 1, tatsu: 1, singles: 6, wilds: 1 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 3, wilds: 2 };
      } else {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 1, wilds: 2 };
      }
      break;

    case '对子处理':
      // 对子偏多，需要抉择拆哪对
      if (difficulty === 'easy') {
        pattern = { triplets: 0, sequences: 1, pairs: 3, tatsu: 1, singles: 2, wilds: 0 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 1, pairs: 3, tatsu: 1, singles: 1, wilds: 1 };
      } else {
        pattern = { triplets: 0, sequences: 0, pairs: 4, tatsu: 2, singles: 0, wilds: 1 };
      }
      break;

    case '金张判断':
      // 有孤立的金张（如1/9/字牌），需要判断保留还是打掉
      if (difficulty === 'easy') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 3, wilds: 1 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 3, wilds: 0 };
      } else {
        pattern = { triplets: 0, sequences: 2, pairs: 1, tatsu: 2, singles: 1, wilds: 0 };
      }
      break;

    case '综合复杂':
    default:
      if (difficulty === 'easy') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 4, wilds: 0 };
      } else if (difficulty === 'medium') {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 2, singles: 2, wilds: 1 };
      } else {
        pattern = { triplets: 0, sequences: 1, pairs: 1, tatsu: 3, singles: 1, wilds: 0 };
      }
      break;
  }

  // 多次尝试生成
  for (let attempt = 0; attempt < 20; attempt++) {
    const gh = structuredHand(pattern);
    const total = gh.tiles.length + gh.wilds.length;

    // 补齐或截断到14张
    const isUnder = total < 14;
    const isOver = total > 14;

    if (isOver) {
      // 丢弃多余的孤张
      const toRemove = total - 14;
      const removeIdxs: number[] = [];
      const counts = countTiles(gh.tiles);
      // 找出现1次的孤张优先
      for (let i = gh.tiles.length - 1; i >= 0 && removeIdxs.length < toRemove; i--) {
        if (counts.get(gh.tiles[i]) === 1) {
          removeIdxs.push(i);
          counts.set(gh.tiles[i], 0);
        }
      }
      // 不够的话，随便删
      for (let i = gh.tiles.length - 1; i >= 0 && removeIdxs.length < toRemove; i--) {
        if (!removeIdxs.includes(i)) removeIdxs.push(i);
      }
      removeIdxs.sort((a, b) => b - a);
      for (const ri of removeIdxs) gh.tiles.splice(ri, 1);
    } else if (isUnder) {
      // 补充孤张
      const need = 14 - total;
      for (let i = 0; i < need; i++) gh.tiles.push(Math.floor(Math.random() * 27));
    }

    handCodes = toCodes(gh);

    // 验证基础约束
    if (handCodes.length !== 14) continue;
    const unique = new Set(handCodes.filter((c) => c !== 'z5'));
    if (unique.size < 4) continue;

    // 验证无重复超出4张
    const cnt: Record<string, number> = {};
    let bad = false;
    for (const c of handCodes) {
      cnt[c] = (cnt[c] || 0) + 1;
      if (cnt[c] > 4) { bad = true; break; }
    }
    if (bad) continue;

    // 验证向听在合理范围
    const s = shantenOf14(handCodes, 0);
    if (s <= 0 || s > 4) continue;

    return makeQuestion(id, category, difficulty, handCodes, 0);
  }

  return null;
}

function countTiles(tiles: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

// ─── 兜底固定题（内联，确保同步可用） ────────────
const FIXED_FALLBACK: QuizQuestion[] = [
  {
    id: 'fix_001', category: '搭子取舍', difficulty: 'easy',
    handCodes: ['m1','m2','m3','m6','m8','p4','p5','p6','p9','p9','s3','s4','s7','s8'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['m6','p9','s7','m8'], answerIndex: 0,
    explanation: '打六万最优。已有123万顺子，六八万是嵌张搭子（坏搭子），不如三七八条的两面搭子好。优先拆坏搭子保留好搭子。',
    discardsPool: ['m6','p9','s7','m8'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'fix_002', category: '对子处理', difficulty: 'medium',
    handCodes: ['m2','m2','m3','m4','p5','p5','p6','p7','s1','s1','s3','s3','s7','s7'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['m3','s7','p6','m2'], answerIndex: 3,
    explanation: '打二万（拆一个对子）最优。手中对子过多（4对），需要拆一对来留空间进搭子和顺子。拆二万边张对子对整体结构影响最小。',
    discardsPool: ['m3','s7','p6','m2'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'fix_003', category: '红中运用', difficulty: 'medium',
    handCodes: ['m5','m6','m7','p3','p4','p6','p8','p8','s2','s2','s5','s6','z5','z5'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['p3','p6','s5','m7'], answerIndex: 3,
    explanation: '两个红中做百搭，五六七万已凑成顺子，七万是多余孤立牌，打掉最合理。保留三四筒搭子等待进牌效果更好。',
    discardsPool: ['p3','p6','s5','m7'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'fix_004', category: '综合复杂', difficulty: 'hard',
    handCodes: ['m4','m5','m6','m7','m8','p2','p3','p6','p6','s1','s2','s3','s8','s9'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['m8','p6','s8','p2'], answerIndex: 3,
    explanation: '打二筒最优！45678万是三面待牌（极好搭子），1289条各是搭子，六筒对是将，二筒是多余孤张，必须打掉。',
    discardsPool: ['m8','p6','s8','p2'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'fix_005', category: '听牌选择', difficulty: 'medium',
    handCodes: ['m1','m2','m3','m4','m5','p2','p2','p3','p4','s6','s6','s7','s8','s9'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['m5','p3','s9','p2'], answerIndex: 0,
    explanation: '打五万最优！12345万待牌3456万，但拆掉搭子保留完整的6789条搭子更高效。二筒对做将已经定好方向。',
    discardsPool: ['m5','p3','s9','p2'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
  {
    id: 'fix_006', category: '对子处理', difficulty: 'easy',
    handCodes: ['m1','m1','m4','m5','p3','p4','p5','p7','p7','p9','p9','s2','s3','s4'],
    meldCount: 0, question: '看这手牌，打哪一牌最优？',
    optionCodes: ['p9','m4','p7','m5'], answerIndex: 0,
    explanation: '打九筒最优！手中有三万对、七筒对、九筒对，九筒对是边张对子，价值最低，优先拆边张对保留中张搭子。',
    discardsPool: ['p9','m4','p7','m5'], tags: [], version: 2,
    createdAt: Date.now(), updatedAt: Date.now(),
  },
];

// ─── 公接口：BUILTIN_QUESTIONS ──────────────────
export let BUILTIN_QUESTIONS: QuizQuestion[] = [];

// ─── 同步生成 ───────────────────────────────────
// 每种类别/难度的分配量（总计 100）

interface Spec { cat: string; diff: Difficulty; want: number }

const SPECS: Spec[] = [
  { cat: '搭子取舍', diff: 'easy', want: 8 },
  { cat: '搭子取舍', diff: 'medium', want: 8 },
  { cat: '搭子取舍', diff: 'hard', want: 4 },
  { cat: '听牌选择', diff: 'easy', want: 7 },
  { cat: '听牌选择', diff: 'medium', want: 7 },
  { cat: '听牌选择', diff: 'hard', want: 4 },
  { cat: '红中运用', diff: 'easy', want: 7 },
  { cat: '红中运用', diff: 'medium', want: 7 },
  { cat: '红中运用', diff: 'hard', want: 4 },
  { cat: '对子处理', diff: 'easy', want: 6 },
  { cat: '对子处理', diff: 'medium', want: 6 },
  { cat: '对子处理', diff: 'hard', want: 4 },
  { cat: '金张判断', diff: 'easy', want: 6 },
  { cat: '金张判断', diff: 'medium', want: 5 },
  { cat: '金张判断', diff: 'hard', want: 3 },
  { cat: '综合复杂', diff: 'easy', want: 6 },
  { cat: '综合复杂', diff: 'medium', want: 6 },
  { cat: '综合复杂', diff: 'hard', want: 2 },
];

function generateBuiltinQuestionsSync(): QuizQuestion[] {
  const result: QuizQuestion[] = [];
  let idSeq = 0;

  for (const spec of SPECS) {
    for (let i = 0; i < spec.want; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const q = generateOneQuestion(`gen_${idSeq}`, spec.cat, spec.diff);
        if (q) { result.push(q); idSeq++; break; }
      }
    }
  }

  // 补齐到至少 100
  while (result.length < 100) {
    const spec = SPECS[idSeq % SPECS.length];
    for (let attempt = 0; attempt < 30; attempt++) {
      const q = generateOneQuestion(`gen_${idSeq}`, spec.cat, spec.diff);
      if (q) { result.push(q); idSeq++; break; }
    }
  }

  return result;
}

// 模块加载时题库为空，由用户导入或手动加载示例题库
// （避免同步生成100题导致首次进入卡顿）

// ─── 异步加载（供 UI 手动加载示例题库使用） ─────────────────

type ProgressCb = (count: number) => void;
let _progressCb: ProgressCb | null = null;

export function onBuiltinQuestionsProgress(cb: ProgressCb) {
  _progressCb = cb;
  return () => { _progressCb = null; };
}

export async function loadBuiltinQuestions(): Promise<void> {
  BUILTIN_QUESTIONS = generateBuiltinQuestionsSync();
  _progressCb?.(BUILTIN_QUESTIONS.length);
}

/** 将当前内置题库重置为空 */
export function clearBuiltinQuestions(): void {
  BUILTIN_QUESTIONS = [];
  _progressCb?.(0);
}

/** 用用户导入的题目覆盖内置题库 */
export function setBuiltinQuestions(questions: QuizQuestion[]): void {
  BUILTIN_QUESTIONS = questions;
  _progressCb?.(BUILTIN_QUESTIONS.length);
}

// ─── 验证函数（供测试） ─────────────────────────

export function verifyBuiltinQuestions(): {
  ok: boolean;
  errors: string[];
  stats: {
    total: number;
    byDifficulty: Record<string, number>;
    byCategory: Record<string, number>;
  };
} {
  const errors: string[] = [];
  const byDiff: Record<string, number> = {};
  const byCat: Record<string, number> = {};

  for (let i = 0; i < BUILTIN_QUESTIONS.length; i++) {
    const q = BUILTIN_QUESTIONS[i];

    // handCodes 长度
    if (q.handCodes.length !== 14) {
      errors.push(`Q#${i}: handCodes.length=${q.handCodes.length} (expect 14)`);
    }

    // optionCodes 长度
    if (q.optionCodes.length !== 4) {
      errors.push(`Q#${i}: optionCodes.length=${q.optionCodes.length} (expect 4)`);
    }

    // answerIndex 范围
    if (q.answerIndex < 0 || q.answerIndex > 3) {
      errors.push(`Q#${i}: answerIndex=${q.answerIndex} out of range`);
    }

    // 答案在选项列表中
    const answerCode = q.optionCodes[q.answerIndex];
    if (!q.handCodes.includes(answerCode)) {
      errors.push(`Q#${i}: answer code ${answerCode} not in handCodes`);
    }

    // 无重复超出4张
    const cnt: Record<string, number> = {};
    for (const c of q.handCodes) {
      cnt[c] = (cnt[c] || 0) + 1;
      if (cnt[c] > 4) {
        errors.push(`Q#${i}: code ${c} appears ${cnt[c]} times (>4)`);
      }
    }
    const hzCount = q.handCodes.filter((c) => c === 'z5').length;
    if (hzCount > 4) {
      errors.push(`Q#${i}: 红中数量=${hzCount} (>4)`);
    }

    // 统计
    byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    byCat[q.category] = (byCat[q.category] || 0) + 1;
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      total: BUILTIN_QUESTIONS.length,
      byDifficulty: byDiff,
      byCategory: byCat,
    },
  };
}
