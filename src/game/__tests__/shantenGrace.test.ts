// 回归测试: 嵌张搭子(i,i+2)识别 — 用例来自用户实战反馈
// 手牌: 247万 13689筒 5679条 白白 (14张)
// 正确: 打9条 → 24万/13筒/68筒 三个嵌张搭子, 向听=2 (2进听)
//       打1筒 → 仅 24万+89筒 两个搭子, 向听=3 (3进听)
import { describe, it, expect } from 'vitest';
import { analyzeHand } from '../skillEngine';

function findScenario(analysis: ReturnType<typeof analyzeHand>, discard: string) {
  return analysis.scenarios.find((s) => s.discardCode === discard);
}

describe('嵌张搭子识别 (用户实战回归)', () => {
  const hand = ['m2', 'm4', 'm7', 'p1', 'p3', 'p6', 'p8', 'p9', 's5', 's6', 's7', 's9', 'z7', 'z7'];

  it('打9条: 24万+13筒+68筒 三嵌张 → 向听=2 (2进听)', () => {
    const analysis = analyzeHand(hand);
    const s9 = findScenario(analysis, 's9');
    expect(s9).toBeDefined();
    expect(s9!.shantenAfter).toBe(2);
  });

  it('打1筒: 仅 24万+89筒 → 向听=3 (3进听), 差于打9条', () => {
    const analysis = analyzeHand(hand);
    const p1 = findScenario(analysis, 'p1');
    expect(p1).toBeDefined();
    expect(p1!.shantenAfter).toBe(3);
  });

  it('推荐舍牌应为9条(向听改善最大)', () => {
    const analysis = analyzeHand(hand);
    const best = analysis.scenarios[0];
    expect(best.discardCode).toBe('s9');
  });

  it('无红中纯嵌张: 24万+123456条+东东东+99筒 → 单骑听3万 → 向听=0', () => {
    // 打白后: 3面子(123/456条/东东东)+将(99筒)+嵌张搭子(24万) → 听牌, 进3万即胡
    const codes = ['m2', 'm4', 's1', 's2', 's3', 's4', 's5', 's6', 'z1', 'z1', 'z1', 'p9', 'p9', 'z7'];
    const analysis = analyzeHand(codes);
    const z7 = findScenario(analysis, 'z7');
    expect(z7).toBeDefined();
    expect(z7!.shantenAfter).toBe(0);
    expect(z7!.isTenpai).toBe(true);
  });
});