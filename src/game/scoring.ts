// 自摸积分制度
// 规则(依用户确认):
//   - 自摸胡牌后, 从剩余牌池随机摸一张"计分牌"
//   - 计分牌分值: 1 或红中(中)=10; 2~9=面值; 字牌(东南西北发白)=5
//   - 摸到面值 2 可再摸一张(连锁, 有上限防死循环)
//   - 总分 S = 各计分牌分值之和
//   - 自摸方得 3S, 其他三家输家各扣 S
//   - 积分分两级: 累计积分(永久保留, 验证长期水平) + 当轮积分(可清零)
import { toSkillCode } from './skillEngine';

export const KEY_SCORE = 'redcenter.score';

export interface ScoreCard {
  code: string;   // 牌编码(如 m2 / z5)
  value: number;  // 该牌分值
}

export interface ScoreDraw {
  cards: ScoreCard[];
  total: number;      // S
  winnerGain: number; // 3S
  loserPay: number;   // S
}

export interface ScoreState {
  cumulative: number; // 累计积分(永久)
  round: number;      // 当轮积分
  selfDraws: number;  // 当轮自摸次数(赢)
  totalSelfDraws: number; // 累计自摸次数(赢)
  loseRounds: number; // 当轮输局次数(他自摸, 自己被扣)
  totalLoseRounds: number; // 累计输局次数
}

const MAX_DRAW = 4; // 连锁再摸上限(摸到2可再摸, 防死循环)

// 计分牌分值: 1或红中(中)=10, 2~9=面值, 字牌=5
export function scoreOf(code: string): number {
  const sc = toSkillCode(code);
  if (sc === 50) return 10;          // 红中(中) = 10
  if (sc >= 31 && sc <= 37) return 5; // 东南西北发白 = 5
  const rank = sc % 10;
  if (rank === 1) return 10;         // 1 = 10
  return rank;                       // 2~9 = 面值
}

// 摸到面值2 → 可再摸一张
export function isDoubleDraw(code: string): boolean {
  const sc = toSkillCode(code);
  return sc !== 50 && sc < 30 && sc % 10 === 2;
}

// 从剩余牌池加权随机抽一张, 池空返回 null
function pickFromPool(pool: Record<string, number>): string | null {
  const available: string[] = [];
  for (const code of Object.keys(pool)) {
    const cnt = pool[code];
    if (cnt > 0) for (let i = 0; i < cnt; i++) available.push(code);
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

// 自摸后抽计分牌(连锁), 返回空 cards 表示牌池已空
export function drawScoreCards(pool: Record<string, number>): ScoreDraw {
  const cards: ScoreCard[] = [];
  let code = pickFromPool(pool);
  let guard = 0;
  while (code !== null && guard < MAX_DRAW) {
    cards.push({ code, value: scoreOf(code) });
    pool[code] = (pool[code] ?? 0) - 1; // 计分牌从牌池扣除
    if (!isDoubleDraw(code)) break;
    code = pickFromPool(pool);
    guard++;
  }
  const total = cards.reduce((s, c) => s + c.value, 0);
  return { cards, total, winnerGain: total * 3, loserPay: total };
}

// ─── 持久化 ───────────────────────────────

const defaultScore: ScoreState = { cumulative: 0, round: 0, selfDraws: 0, totalSelfDraws: 0, loseRounds: 0, totalLoseRounds: 0 };

export function loadScore(): ScoreState {
  try {
    const raw = localStorage.getItem(KEY_SCORE);
    if (!raw) return { ...defaultScore };
    return { ...defaultScore, ...(JSON.parse(raw) as Partial<ScoreState>) };
  } catch {
    return { ...defaultScore };
  }
}

export function saveScore(state: ScoreState): boolean {
  try {
    localStorage.setItem(KEY_SCORE, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// 当轮清零(累计保留)
export function resetRoundScore(): ScoreState {
  const state = { ...loadScore(), round: 0, selfDraws: 0, loseRounds: 0 };
  saveScore(state);
  return state;
}

// 累计清零(永久)
export function resetAllScore(): ScoreState {
  const state = { ...defaultScore };
  saveScore(state);
  return state;
}
