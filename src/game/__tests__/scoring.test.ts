// 自摸积分制度测试
// 规则: 计分牌分值(1或红中=10, 2-9=面值, 字牌=5), 摸到2可连锁再摸
// S=总分, 自摸方得3S, 三家各扣S; 累计积分永久保留, 当轮可清零
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { scoreOf, isDoubleDraw, drawScoreCards, resetRoundScore } from '../scoring';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('计分牌分值 scoreOf', () => {
  it('1 = 10 (最大)', () => {
    expect(scoreOf('m1')).toBe(10);
    expect(scoreOf('p1')).toBe(10);
    expect(scoreOf('s1')).toBe(10);
  });
  it('2~9 = 面值', () => {
    expect(scoreOf('m2')).toBe(2);
    expect(scoreOf('m9')).toBe(9);
    expect(scoreOf('p5')).toBe(5);
  });
  it('红中(中) = 10', () => {
    expect(scoreOf('z5')).toBe(10);
  });
  it('字牌(东南西北发白) = 5', () => {
    expect(scoreOf('z1')).toBe(5);
    expect(scoreOf('z4')).toBe(5);
    expect(scoreOf('z6')).toBe(5);
    expect(scoreOf('z7')).toBe(5);
  });
});

describe('摸到2连锁再摸 isDoubleDraw', () => {
  it('万/筒/条 面值2 触发再摸', () => {
    expect(isDoubleDraw('m2')).toBe(true);
    expect(isDoubleDraw('p2')).toBe(true);
    expect(isDoubleDraw('s2')).toBe(true);
  });
  it('非2或字牌/红中不触发', () => {
    expect(isDoubleDraw('m3')).toBe(false);
    expect(isDoubleDraw('m1')).toBe(false);
    expect(isDoubleDraw('z2')).toBe(false);
    expect(isDoubleDraw('z5')).toBe(false);
  });
});

describe('drawScoreCards 结算', () => {
  it('摸到2万后再摸红中 → S=2+10=12, 赢家得36, 输家各扣12', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // 始终抽池中第一张
    const pool = { m2: 1, z5: 2 };
    const draw = drawScoreCards(pool);
    expect(draw.cards.map((c) => c.value)).toEqual([2, 10]);
    expect(draw.total).toBe(12);
    expect(draw.winnerGain).toBe(36);
    expect(draw.loserPay).toBe(12);
  });

  it('连锁: 2万→2条→红中 → S=2+2+10=14, 赢家得42', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pool = { m2: 1, s2: 1, z5: 2 };
    const draw = drawScoreCards(pool);
    expect(draw.cards.map((c) => c.value)).toEqual([2, 2, 10]);
    expect(draw.total).toBe(14);
    expect(draw.winnerGain).toBe(42);
  });

  it('摸到非2即停', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pool = { z7: 3 };
    const draw = drawScoreCards(pool);
    expect(draw.cards.length).toBe(1);
    expect(draw.total).toBe(5);
    expect(draw.winnerGain).toBe(15);
  });

  it('牌池为空 → 无计分(不崩)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const draw = drawScoreCards({});
    expect(draw.cards.length).toBe(0);
    expect(draw.total).toBe(0);
  });

  it('计分牌从牌池扣除', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pool = { z7: 3, m5: 1 };
    drawScoreCards(pool);
    expect(pool.z7).toBe(2); // 抽了一张
    expect(pool.m5).toBe(1);
  });
});

describe('积分持久化 resetRoundScore', () => {
  it('当轮清零保留累计', () => {
    localStorage.setItem('redcenter.score', JSON.stringify({
      cumulative: 100, round: 30, selfDraws: 2, totalSelfDraws: 5,
    }));
    const state = resetRoundScore();
    expect(state.round).toBe(0);
    expect(state.selfDraws).toBe(0);
    expect(state.cumulative).toBe(100);
    expect(state.totalSelfDraws).toBe(5);
  });
});