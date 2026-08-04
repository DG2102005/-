// 游戏信息面板
import type { GameState } from '../game/types';
import { SEAT_NAME } from '../game/types';

interface Props {
  state: GameState;
  onNewRound: () => void;
}

export function GameInfo({ state, onNewRound }: Props) {
  const remaining = state.deck.length;
  const phaseText = {
    idle: '未开始',
    dealing: '发牌中',
    draw: '摸牌',
    discard: '出牌',
    action: '操作',
    react: '选择操作',
    gameover: state.isDraw ? '流局' : (state.winner !== null ? `${SEAT_NAME[state.winner]}胡牌` : '结束'),
  }[state.phase];

  return (
    <div className="game-info">
      <div className="info-row"><span>局数</span><b>{state.round}</b></div>
      <div className="info-row"><span>庄家</span><b>{state.players.length ? SEAT_NAME[state.banker] : '-'}</b></div>
      <div className="info-row"><span>当前</span><b>{state.players.length ? SEAT_NAME[state.currentSeat] : '-'}</b></div>
      <div className="info-row"><span>阶段</span><b>{phaseText}</b></div>
      <div className="info-row"><span>剩余牌</span><b>{remaining}</b></div>
      {state.phase === 'gameover' && (
        <button className="new-round-btn" onClick={onNewRound}>开始新一局</button>
      )}
    </div>
  );
}
