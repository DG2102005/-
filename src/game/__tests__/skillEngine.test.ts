// skill 引擎对拍测试 — 用例全部来自 mahjong.py --selftest
import { describe, it, expect } from 'vitest';
import {
  parseHandText, makeCounts, countsToList,
  isWin, shanten, winningTiles, analyzeHand, analyzePartialHand,
  LAIZI,
} from '../skillEngine';

const c9 = () => {
  const c: Record<number, number> = {};
  for (let i = 1; i <= 9; i++) c[i] = 1;
  return c;
};

describe('parse (来自 skill selftest)', () => {
  it('解析 1万2万3万456筒红中东东', () => {
    const c = parseHandText('1万2万3万456筒 红中 东东');
    expect(c).toEqual({ 1: 1, 2: 1, 3: 1, 14: 1, 15: 1, 16: 1, [LAIZI]: 1, 31: 2 });
  });
  it('解析 中文数字与连写', () => {
    const c = parseHandText('一万二万三万 九筒 红中红中 东南西北');
    expect(c[1]).toBe(1);
    expect(c[3]).toBe(1);
    expect(c[19]).toBe(1);
    expect(c[LAIZI]).toBe(2);
    expect(c[31]).toBe(1);
    expect(c[32]).toBe(1);
    expect(c[33]).toBe(1);
    expect(c[34]).toBe(1);
  });
  it('makeCounts / countsToList 往返', () => {
    const codes = ['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 'z1', 'z5'];
    const counts = makeCounts(codes);
    expect(counts[1]).toBe(1);
    expect(counts[14]).toBe(1);
    expect(counts[31]).toBe(1);
    expect(counts[LAIZI]).toBe(1);
    expect(countsToList(counts)).toEqual(['m1', 'm2', 'm3', 'p4', 'p5', 'p6', 'z1', 'z5']);
  });
});

describe('胡牌判定 14张 (来自 skill selftest)', () => {
  it('123/456/789万+东东+红中x3 可胡 (红中当刻子)', () => {
    expect(isWin({ ...c9(), 31: 2 }, 3)).toBe(true);
  });
  it('123/456/789万+红中x3+东+红中 可胡 (红中当东作将)', () => {
    expect(isWin({ ...c9(), 31: 1 }, 4)).toBe(true);
  });
  it('东东东南南南北北北+发发+红中x3 可胡 (字牌刻子)', () => {
    expect(isWin({ 31: 3, 32: 3, 33: 3, 36: 2 }, 3)).toBe(true);
  });
  it('123/456/789万+东东+红中x1 不可胡 (缺面子)', () => {
    expect(isWin({ ...c9(), 31: 2 }, 1)).toBe(false);
  });
  it('556万23458条268筒+红中x3 不可胡 (回归: 丢弃浮牌误判)', () => {
    expect(isWin({ 5: 2, 6: 1, 22: 1, 23: 1, 24: 1, 25: 1, 28: 1, 12: 1, 16: 1, 18: 1 }, 3)).toBe(false);
  });
});

describe('副露扩展胡牌 (melds>0)', () => {
  it('melds=1: 123万+东东(雀头) 共5张+红中x2 可胡 (11张=3面子+1将?)', () => {
    // 手牌: 123万(面子) 东东(雀头)? → 仅1面子+1雀头，缺2面子 → 不可胡
    expect(isWin({ 1: 1, 2: 1, 3: 1, 31: 2 }, 0, 1)).toBe(false);
  });
  it('melds=1: 123万456万789万+东东 11张 可胡', () => {
    expect(isWin({ ...c9(), 31: 2 }, 0, 1)).toBe(true);
  });
  it('melds=2: 123万456万+东东 8张 可胡', () => {
    expect(isWin({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 31: 2 }, 0, 2)).toBe(true);
  });
  it('melds=2: 123万456万+东(孤) 7张 不可胡', () => {
    expect(isWin({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 31: 1 }, 0, 2)).toBe(false);
  });
});

describe('向听数 13张 (来自 skill selftest)', () => {
  it('123/456/789万+东东东+西 单骑听 向听=0', () => {
    expect(shanten({ ...c9(), 31: 3, 33: 1 }, 0)).toBe(0);
  });
  it('123/456/789万+东东+西+北 3面子+将+2浮 向听=1', () => {
    expect(shanten({ ...c9(), 31: 2, 33: 1, 34: 1 }, 0)).toBe(1);
  });
  it('123/456/789万+东+红中x3 (红中当将/补面子) 向听=0', () => {
    expect(shanten({ ...c9(), 31: 1 }, 3)).toBe(0);
  });
  it('123/456万+东东东+西西+1万+红中 向听=0', () => {
    expect(shanten({ 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 31: 3, 33: 2 }, 1)).toBe(0);
  });
  it('123/456万+东东东+西西+1万+9筒 向听=1', () => {
    expect(shanten({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 31: 3, 33: 2, 9: 1 }, 0)).toBe(1);
  });
  it('123/456万+东东东+789条+红中 单骑听红中 向听=0', () => {
    expect(shanten({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 31: 3, 27: 1, 28: 1, 29: 1 }, 1)).toBe(0);
  });
});

describe('听牌张数 (来自 skill selftest)', () => {
  it('123/456/789万+东+红中x3 → 听 1-9万/东/红中', () => {
    const counts = { ...c9(), 31: 1 };
    const laizi = 3;
    expect(shanten(counts, laizi)).toBe(0);
    const wins = winningTiles(counts, laizi);
    const codes = wins.map((w) => w.code);
    expect(codes).toContain('z1');  // 东
    expect(codes).toContain('z5');  // 红中
    expect(codes).toContain('m1');  // 1万
    expect(codes.length).toBeGreaterThanOrEqual(9);
  });
});

describe('完整分析 14张 (来自 skill selftest)', () => {
  it('123万456万789万 东东 红中红中 东 → 打东即听牌', () => {
    const counts = parseHandText('123万456万789万 东东 红中红中 东');
    const codes = countsToList(counts);
    const analysis = analyzeHand(codes);
    expect(analysis.handCodes.length).toBe(14);
    expect(analysis.scenarios.length).toBeGreaterThan(0);
    const dong = analysis.scenarios.find((s) => s.discardCode === 'z1');
    expect(dong).toBeDefined();
    expect(dong!.isTenpai).toBe(true);
    expect(analysis.isWinNow).toBe(false);
  });
  it('打红中也保留为候选 (跟随 skill)', () => {
    const counts = parseHandText('123万456万789万 东东 红中红中 东');
    const analysis = analyzeHand(countsToList(counts));
    const hz = analysis.scenarios.find((s) => s.discardCode === 'z5');
    expect(hz).toBeDefined();
  });
  it('已胡手牌 → isWinNow', () => {
    const codes = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'z1', 'z1', 'z5', 'z5', 'z5'];
    const analysis = analyzeHand(codes);
    expect(analysis.isWinNow).toBe(true);
    expect(analysis.currentShanten).toBe(-1);
  });
  it('张数校验: 13张抛错', () => {
    expect(() => analyzeHand(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'z1', 'z1', 'z5', 'z5'])).toThrow();
  });
});

describe('副露 + 完整分析', () => {
  it('melds=1: 11张手牌可分析(打后向听)', () => {
    // 手牌: 123万456万789万+东东+红中 = 10张+1癞子
    const codes = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'z1', 'z5'];
    const analysis = analyzeHand(codes, 1);
    const dong = analysis.scenarios.find((s) => s.discardCode === 'z1');
    expect(dong).toBeDefined();
    expect(dong!.isTenpai).toBe(true); // 打东后: 3面子+红中单骑
  });
});

describe('analyzePartialHand (13-3*melds 张)', () => {
  it('听牌状态返回可胡牌面', () => {
    const codes = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'z1', 'z1', 'z1', 's1'];
    const r = analyzePartialHand(codes);
    expect(r.isTenpai).toBe(true);
    expect(r.shanten).toBe(0);
    expect(r.tiles.some((t) => t.code === 's1')).toBe(true);
  });
  it('非听状态返回有效进张', () => {
    const codes = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'z1', 'z1', 'z1', 'z2', 'z2', 's1', 's9'];
    const r = analyzePartialHand(codes);
    expect(r.isTenpai).toBe(false);
    expect(r.shanten).toBe(1);
    expect(r.tiles.length).toBeGreaterThan(0);
    expect(r.tileCount).toBeGreaterThan(0);
  });
});