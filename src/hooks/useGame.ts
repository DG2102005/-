// 游戏状态Hook: 管理状态 + 驱动AI自动行动
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, ActionOption, Seat } from '../game/types';
import { tileCode } from '../game/types';
import { HUMAN_SEAT, AI_THINK_DELAY } from '../game/constants';
import {
  createInitialState, startNewRound, drawTile, discardTile,
  applyAction, applySelfAction, humanPassReact, humanPassSelfAction, aiPlayTurn,
} from '../game/gameEngine';
import { drawScoreCards } from '../game/scoring';
import type { ScoreDraw } from '../game/scoring';
import { useScore } from '../quiz/ScorePanel';

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const timerRef = useRef<number | null>(null);

  // 全局积分(对弈/模拟共享)
  const score = useScore();
  const pendingScoreRef = useRef<{ kind: 'win' | 'lose'; draw: ScoreDraw } | null>(null);

  // 从剩余牌墙构造计分池
  const poolFromDeck = useCallback((deck: GameState['deck']): Record<string, number> => {
    const pool: Record<string, number> = {};
    for (const t of deck) {
      const c = tileCode(t);
      pool[c] = (pool[c] ?? 0) + 1;
    }
    return pool;
  }, []);

  // 判断是否需要自动推进
  const needAutoAdvance = useCallback((s: GameState): boolean => {
    if (s.phase === 'idle' || s.phase === 'gameover') return false;
    if (s.phase === 'react') return false; // 等人类选择
    if (s.phase === 'discard' && s.currentSeat === HUMAN_SEAT) return false; // 等人类出牌
    return true; // draw阶段(无论人/AI) 或 AI的discard 自动推进
  }, []);

  // 单步推进
  const advanceOne = useCallback((s: GameState): GameState => {
    let next: GameState = s;
    if (s.phase === 'draw') {
      // 摸牌(人/AI都自动摸)
      next = drawTile(s, s.currentSeat);
    } else if (s.phase === 'discard' && s.currentSeat !== HUMAN_SEAT) {
      next = aiPlayTurn(s);
    }
    // AI自摸胜局 → 人类作为输家, 摸码扣分(在effect中结算)
    if (next.phase === 'gameover' && !next.isDraw && next.winner !== null && next.winner !== HUMAN_SEAT) {
      const draw = drawScoreCards(poolFromDeck(next.deck));
      pendingScoreRef.current = { kind: 'lose', draw };
    }
    return next;
  }, [poolFromDeck]);

  // 状态变化时驱动
  useEffect(() => {
    if (!needAutoAdvance(state)) return;
    timerRef.current = window.setTimeout(() => {
      setState((prev) => {
        const next = advanceOne(prev);
        return next;
      });
    }, AI_THINK_DELAY);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [state, needAutoAdvance, advanceOne]);

  // ===== 暴露的人类操作 =====
  const startGame = useCallback(() => {
    setState((prev) => startNewRound(prev, HUMAN_SEAT));
  }, []);

  const newRound = useCallback(() => {
    setState((prev) => {
      const banker: Seat = prev.winner !== null ? (prev.winner as Seat) : prev.banker;
      return startNewRound(prev, banker);
    });
  }, []);

  const humanDiscard = useCallback((tileId: number) => {
    setState((prev) => discardTile(prev, HUMAN_SEAT, tileId));
  }, []);

  const humanReact = useCallback((option: ActionOption) => {
    setState((prev) => applyAction(prev, option, true));
  }, []);

  const humanPass = useCallback(() => {
    setState((prev) => humanPassReact(prev));
  }, []);

  const humanSelfAction = useCallback((option: ActionOption) => {
    setState((prev) => {
      // 人类自摸胡 → 从剩余牌墙抽计分牌(在effect中结算, 避免setState副作用)
      if (option.type === 'hu') {
        const draw = drawScoreCards(poolFromDeck(prev.deck));
        pendingScoreRef.current = { kind: 'win', draw };
      }
      return applySelfAction(prev, option);
    });
  }, [poolFromDeck]);

  // 结算一局得分(状态更新完成后): 自摸赢 +3S / 他人自摸自己输 -S
  useEffect(() => {
    const pending = pendingScoreRef.current;
    if (!pending) return;
    pendingScoreRef.current = null;
    if (pending.draw.cards.length > 0) score.settle(pending.draw.total, pending.kind === 'win');
    score.setLastResult({ draw: pending.draw, kind: pending.kind });
  }, [state, score]);

  // 人类放弃自摸胡(从selfActions移除hu选项, 保留暗杠/补杠)
  const humanPassSelf = useCallback(() => {
    setState((prev) => humanPassSelfAction(prev));
  }, []);

  return {
    state,
    startGame,
    newRound,
    humanDiscard,
    humanReact,
    humanPass,
    humanSelfAction,
    humanPassSelf,
    scoreState: score.state,
    scoreResult: score.lastResult,
    scoreResetRound: score.resetRound,
    scoreResetAll: score.resetAll,
    scoreReload: score.reload,
  };
}
