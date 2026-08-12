// 根组件: 麻将桌面布局与交互
// 顶部导航: 对弈 / 智能模拟; 侧栏: 信息 / 辅助
import { useState } from 'react';
import { useGame } from './hooks/useGame';
import { HUMAN_SEAT } from './game/constants';
import { SEAT_NAME } from './game/types';
import { PlayerSeat } from './components/PlayerSeat';
import { CenterTable } from './components/CenterTable';
import { HandRow } from './components/HandRow';
import { MeldArea } from './components/MeldArea';
import { ActionPanel } from './components/ActionPanel';
import { GameInfo } from './components/GameInfo';
import { AdvisorTab } from './components/AdvisorTab';
import { Simulator } from './quiz/Simulator';

type View = 'game' | 'simulate';
type SideTab = 'info' | 'advisor';

function App() {
  const game = useGame();
  const [view, setView] = useState<View>('game');
  const [sideTab, setSideTab] = useState<SideTab>('info');

  const {
    state, startGame, newRound, humanDiscard, humanReact, humanPass, humanSelfAction, humanPassSelf,
  } = game;

  const human = state.players[HUMAN_SEAT];
  const started = state.phase !== 'idle';
  const gameOver = state.phase === 'gameover';

  const canDiscard =
    started && !gameOver &&
    state.currentSeat === HUMAN_SEAT &&
    state.phase === 'discard';

  const reactOptions = state.phase === 'react' ? state.pendingOptions : [];
  const selfOptions =
    state.currentSeat === HUMAN_SEAT && state.phase === 'discard' && state.selfActions.length > 0
      ? state.selfActions
      : [];

  return (
    <div className="app">
      <header className="app-header">
        <h1>🀄 红中推倒胡麻将训练工具</h1>
        <div className="header-controls">
          <nav className="nav-switch">
            <button
              className={`nav-btn ${view === 'game' ? 'active' : ''}`}
              onClick={() => setView('game')}
            >
              🀄 对弈
            </button>
            <button
              className={`nav-btn ${view === 'simulate' ? 'active' : ''}`}
              onClick={() => setView('simulate')}
            >
              🧪 智能模拟
            </button>
          </nav>
          {view === 'game' && !started && (
            <button className="start-btn" onClick={startGame}>开始游戏</button>
          )}
          {view === 'game' && gameOver && (
            <button className="start-btn" onClick={newRound}>开始新一局</button>
          )}
        </div>
      </header>

      {view === 'simulate' ? (
        <div className="simulator-page">
          <Simulator onBack={() => setView('game')} />
        </div>
      ) : (
        <div className="main-layout">
          {/* 牌桌区 */}
          <div className="table-area">
            {started && state.players[3] && (
              <div className="seat-zone zone-top">
                <PlayerSeat player={state.players[3]} state={state} position="top" />
              </div>
            )}
            <div className="seat-row">
              <div className="seat-zone zone-left">
                {started && state.players[2] && (
                  <PlayerSeat player={state.players[2]} state={state} position="left" />
                )}
              </div>
              <div className="center-area">
                {started ? (
                  <CenterTable state={state} />
                ) : (
                  <div className="welcome">
                    <div className="welcome-title">红中百搭 · 广东推倒胡</div>
                    <div className="welcome-desc">1人对战3AI · 仅自摸胡 · 严禁天胡地胡</div>
                    <div className="welcome-features">
                      ✓ 自动理牌 ✓ 逆时针出牌 ✓ 侧栏辅助打牌建议
                    </div>
                    <button className="start-btn big" onClick={startGame}>开始游戏</button>
                  </div>
                )}
              </div>
              <div className="seat-zone zone-right">
                {started && state.players[0] && (
                  <PlayerSeat player={state.players[0]} state={state} position="right" />
                )}
              </div>
            </div>
            <div className="seat-zone zone-bottom">
              {started && human && (
                <div className="human-seat">
                  <div className="seat-header">
                    <span className="seat-name">{SEAT_NAME[HUMAN_SEAT]} · {human.name}</span>
                    {human.isDealer && <span className="dealer-mark">庄</span>}
                    {state.currentSeat === HUMAN_SEAT && state.phase === 'discard' && (
                      <span className="turn-indicator">轮到你出牌</span>
                    )}
                  </div>
                  <MeldArea melds={human.melds} size={30} />
                  <HandRow
                    hand={human.hand}
                    onDiscard={humanDiscard}
                    interactive={canDiscard}
                    drawnTileId={state.drawnTileId}
                  />
                  {selfOptions.length > 0 && (
                    <ActionPanel options={selfOptions} mode="self" onChoose={humanSelfAction} onPass={humanPassSelf} />
                  )}
                  {reactOptions.length > 0 && (
                    <ActionPanel options={reactOptions} mode="react" onChoose={humanReact} onPass={humanPass} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 侧栏: 信息 / 辅助 */}
          <aside className="side-panel">
            <div className="tab-bar">
              <button className={`tab ${sideTab === 'info' ? 'active' : ''}`} onClick={() => setSideTab('info')}>
                信息
              </button>
              <button className={`tab ${sideTab === 'advisor' ? 'active' : ''}`} onClick={() => setSideTab('advisor')}>
                🧭 辅助
              </button>
            </div>
            <div className="tab-content">
              {sideTab === 'info' ? (
                <GameInfo state={state} onNewRound={newRound} />
              ) : (
                started && human ? (
                  <AdvisorTab
                    hand={human.hand}
                    meldCount={human.melds.length}
                    canDiscard={canDiscard}
                    onDiscard={humanDiscard}
                  />
                ) : (
                  <div className="empty-panel">开局后即可查看打牌建议</div>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default App;