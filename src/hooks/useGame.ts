// 游戏状态Hook: 管理状态 + 驱动AI自动行动
import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, ActionOption, Seat } from '../game/types';
import { HUMAN_SEAT, AI_THINK_DELAY } from '../game/constants';
import {
  createInitialState, startNewRound, drawTile, discardTile,
  applyAction, applySelfAction, humanPassReact, humanPassSelfAction, aiPlayTurn,
} from '../game/gameEngine';

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const timerRef = useRef<number | null>(null);

  // 判断是否需要自动推进
  const needAutoAdvance = useCallback((s: GameState): boolean => {
    if (s.phase === 'idle' || s.phase === 'gameover') return false;
    if (s.phase === 'react') return false; // 等人类选择
    if (s.phase === 'discard' && s.currentSeat === HUMAN_SEAT) return false; // 等人类出牌
    return true; // draw阶段(无论人/AI) 或 AI的discard 自动推进
  }, []);

  // 单步推进
  const advanceOne = useCallback((s: GameState): GameState => {
    if (s.phase === 'draw') {
      // 摸牌(人/AI都自动摸)
      return drawTile(s, s.currentSeat);
    }
    if (s.phase === 'discard' && s.currentSeat !== HUMAN_SEAT) {
      return aiPlayTurn(s);
    }
    return s;
  }, []);

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
    setState((prev) => applySelfAction(prev, option));
  }, []);

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
  };
}
