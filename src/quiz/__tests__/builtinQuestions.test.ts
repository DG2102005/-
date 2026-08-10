// 内置题库生成验证测试
import { describe, it, expect, beforeAll } from 'vitest';
import { BUILTIN_QUESTIONS, loadBuiltinQuestions, verifyBuiltinQuestions } from '../builtinQuestions';

// 确保题库生成完成
beforeAll(async () => {
  await loadBuiltinQuestions();
}, 30000);

describe('builtinQuestions - 基础验证', () => {
  it('生成至少 100 道题', () => {
    expect(BUILTIN_QUESTIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('所有题目的 handCodes 长度为 14', () => {
    for (const q of BUILTIN_QUESTIONS) {
      expect(q.handCodes.length).toBe(14);
    }
  });

  it('所有题目的 optionCodes 长度为 4', () => {
    for (const q of BUILTIN_QUESTIONS) {
      expect(q.optionCodes.length).toBe(4);
    }
  });

  it('answerIndex 在 0-3 范围内', () => {
    for (const q of BUILTIN_QUESTIONS) {
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThanOrEqual(3);
    }
  });

  it('同 code 不超过 4 张, 红中不超过 4 张', () => {
    for (const q of BUILTIN_QUESTIONS) {
      const counts: Record<string, number> = {};
      let hz = 0;
      for (const c of q.handCodes) {
        counts[c] = (counts[c] || 0) + 1;
        expect(counts[c]).toBeLessThanOrEqual(4);
        if (c === 'z5') hz++;
      }
      expect(hz).toBeLessThanOrEqual(4);
    }
  });

  it('答案指向的选项牌在手牌中存在', () => {
    for (const q of BUILTIN_QUESTIONS) {
      const answerCode = q.optionCodes[q.answerIndex];
      expect(q.handCodes).toContain(answerCode);
    }
  });

  it('verifyBuiltinQuestions 返回 ok', () => {
    const result = verifyBuiltinQuestions();
    if (!result.ok) {
      console.log('验证错误:', result.errors.slice(0, 5));
    }
    expect(result.ok).toBe(true);
  });
}, 30000);

describe('builtinQuestions - 分布验证', () => {
  it('难度分布: easy>=40, medium>=40, hard>=20', () => {
    const result = verifyBuiltinQuestions();
    expect(result.stats.byDifficulty.easy || 0).toBeGreaterThanOrEqual(40);
    expect(result.stats.byDifficulty.medium || 0).toBeGreaterThanOrEqual(40);
    expect(result.stats.byDifficulty.hard || 0).toBeGreaterThanOrEqual(20);
  });

  it('分类至少覆盖 5 个类别', () => {
    const result = verifyBuiltinQuestions();
    const cats = Object.keys(result.stats.byCategory);
    expect(cats.length).toBeGreaterThanOrEqual(5);
  });
}, 30000);
