// 全局积分面板 — 对弈"信息"侧栏展示
// 累计积分(永久) + 当轮积分(可清零) + 自摸/输局次数
// 结算: 仅统计玩家自己 — 自摸赢 +3S, 他人自摸(自己输) -S
import { useState, useCallback } from 'react';
import {
  loadScore, saveScore, resetRoundScore, resetAllScore,
} from '../game/scoring';
import type { ScoreDraw, ScoreState } from '../game/scoring';
import { codeName } from '../game/skillEngine';
import { Tile as TileComp } from '../components/Tile';
import type { Tile, Suit } from '../game/types';

// 项目编码 → 牌(仅渲染)
function codeToTile(code: string): Tile {
  return { id: -1, suit: code[0] as Suit, rank: parseInt(code.slice(1), 10) };
}

// 积分状态 hook(对弈/模拟共用同一份 localStorage 数据)
export function useScore() {
  const [state, setState] = useState<ScoreState>(() => loadScore());
  const [lastResult, setLastResult] = useState<{ draw: ScoreDraw; kind: 'win' | 'lose' } | null>(null);

  // 结算一局: amount=该局S(牌面总分), isWin=true自摸赢(+3S) / false他人自摸(-S)
  const settle = useCallback((amount: number, isWin: boolean) => {
    setState((prev) => {
      const delta = isWin ? amount * 3 : -amount;
      const next = {
        ...prev,
        cumulative: prev.cumulative + delta,
        round: prev.round + delta,
        ...(isWin
          ? { selfDraws: prev.selfDraws + 1, totalSelfDraws: prev.totalSelfDraws + 1 }
          : { loseRounds: prev.loseRounds + 1, totalLoseRounds: prev.totalLoseRounds + 1 }),
      };
      saveScore(next);
      return next;
    });
  }, []);

  const resetRound = useCallback(() => setState(resetRoundScore()), []);
  const resetAll = useCallback(() => setState(resetAllScore()), []);
  // 重新读取localStorage(供切换视图时同步最新积分)
  const reload = useCallback(() => setState(loadScore()), []);

  return { state, lastResult, setLastResult, settle, resetRound, resetAll, reload };
}

interface Props {
  score: ScoreState;
  result?: { draw: ScoreDraw; kind: 'win' | 'lose' } | null; // 最近一局摸码亮牌结果
  onResetRound: () => void;
  onResetAll: () => void;
}

export function ScorePanel({ score, result, onResetRound, onResetAll }: Props) {
  const detail = result?.draw;
  return (
    <>
      <div className="score-panel">
        <div className="score-panel-item">
          <span className="score-panel-label">🏆 当轮积分</span>
          <span className="score-panel-value">{score.round}</span>
          <span className="score-panel-sub">
            自摸 {score.selfDraws} 次 · 输 {score.loseRounds} 局
          </span>
        </div>
        <div className="score-panel-item">
          <span className="score-panel-label">💾 累计积分</span>
          <span className="score-panel-value cum">{score.cumulative}</span>
          <span className="score-panel-sub">
            累计自摸 {score.totalSelfDraws} 次 · 输 {score.totalLoseRounds} 局(永久保留)
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="quiz-toolbar-btn"
            style={{ fontSize: 11, padding: '2px 10px' }}
            onClick={onResetRound}
            title="清零当轮积分,累计保留"
          >
            ↺ 当轮清零
          </button>
          <button
            className="quiz-toolbar-btn"
            style={{ fontSize: 11, padding: '2px 10px' }}
            onClick={onResetAll}
            title="清零全部积分(含累计)"
          >
            ✕ 累计清零
          </button>
        </div>
      </div>

      {detail && detail.cards.length > 0 && (
        <div className="score-detail">
          <span>🎴 摸码亮牌:</span>
          {detail.cards.map((c) => (
            <span key={c.code} className="score-detail-card">
              <TileComp tile={codeToTile(c.code)} size={26} />
              <b style={{ color: 'var(--gold)' }}>+{c.value}</b>
            </span>
          ))}
          <span>
            S=<b style={{ color: '#2ecc71' }}>{detail.total}</b>
            {result?.kind === 'win'
              ? <>自摸赢 <b style={{ color: '#2ecc71' }}>3×{detail.total}={detail.winnerGain}</b>, 三家各扣 {detail.loserPay}</>
              : <>被扣 <b style={{ color: '#e74c3c' }}>-{detail.loserPay}</b> (自摸者得 {detail.winnerGain})</>}
          </span>
        </div>
      )}
    </>
  );
}