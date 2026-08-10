// 根组件: 麻将桌面布局与交互
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGame } from './hooks/useGame';
import { HUMAN_SEAT } from './game/constants';
import { SEAT_NAME, tileCode, tileName, isHongZhong } from './game/types';
import type { UserCorrection, GameState } from './game/types';
import { PlayerSeat } from './components/PlayerSeat';
import { CenterTable } from './components/CenterTable';
import { HandRow } from './components/HandRow';
import { MeldArea } from './components/MeldArea';
import { ActionPanel } from './components/ActionPanel';
import { GameInfo } from './components/GameInfo';
import { LogPanel } from './components/LogPanel';
import { AdvisorPanel } from './components/AdvisorPanel';
import { ReviewPanel } from './components/ReviewPanel';
import { StrategyLibPanel } from './components/StrategyLibPanel';
import { ExpertPanel } from './components/ExpertPanel';
import { SmartAnalysisPanel } from './components/SmartAnalysisPanel';
import { saveCorrection, loadCorrections } from './game/correctionLib';
import { analysisFromHandCodes } from './game/advisor';
import type { ScenarioAnalysis } from './game/types';

type Tab = 'info' | 'advisor' | 'review' | 'strategy' | 'log' | 'expert';

function App() {
  const {
    state, startGame, newRound, humanDiscard, humanReact, humanPass, humanSelfAction, humanPassSelf,
  } = useGame();
  const [showLabel, setShowLabel] = useState(false);
  const [tab, setTab] = useState<Tab>('info');

  // 校正机制相关state
  const [correctionsTick, setCorrectionsTick] = useState(0);
  const [lastCorrection, setLastCorrection] = useState<UserCorrection | null>(null);

  // 横幅&失误浮层 state（不遮挡）
  const [resultCollapsed, setResultCollapsed] = useState(false);
  const [showResultBadge, setShowResultBadge] = useState(false);
  const [mistakeVisible, setMistakeVisible] = useState(true);

  // 辅助决策场景分析(仅用户主动请求时显示)
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);

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

  // 建议打出的牌id(用于手牌标记)
  const recTileId = state.lastAdvice?.recommendDiscard?.tileId ?? null;
  // 失误提醒出现时自动切到辅助tab
  const mistakeActive = state.lastMistake !== null;
  const adviceActive = state.lastAdvice !== null;
  // 校正数统计(专家tab徽标)
  const correctionsCount = useMemo(() => loadCorrections().length, [correctionsTabChangeDeps()]);

  function correctionsTabChangeDeps() {
    // 触发correctionsCount 重新计算
    return correctionsTick + (gameOver ? 1 : 0) + state.round;
  }

  // === 校正回调(AdvisorPanel调用) ===
  const handleCorrect = useCallback((payload: {
    userChoiceCode: string | null;
    userChoiceName: string | null;
    agree: boolean;
    userReason: string;
  }) => {
    const advice = state.lastAdvice;
    if (!advice) return;
    const phase: 'early' | 'mid' | 'late' =
      state.deck.length > 60 ? 'early' : state.deck.length > 30 ? 'mid' : 'late';
    const hand = state.players[HUMAN_SEAT].hand;
    const pairCount = countHandPairs(hand);
    const hzCount = hand.filter((t) => isHongZhong(t)).length;
    const saved = saveCorrection({
      roundId: state.round,
      seat: HUMAN_SEAT,
      systemRecommendCode: advice.recommendDiscard?.code ?? null,
      systemRecommendName: advice.recommendDiscard?.name ?? null,
      systemShanten: advice.shanten,
      systemReason: advice.reason,
      candidatesAtTime: advice.candidates,
      userChoiceCode: payload.userChoiceCode,
      userChoiceName: payload.userChoiceName,
      agree: payload.agree,
      userReason: payload.userReason,
      handCodes: hand.map(tileCode).sort(),
      meldsCount: state.players[HUMAN_SEAT].melds.length,
      hongZhongCount: hzCount,
      pairCount,
      phase,
      isTenpai: advice.tingTiles.length > 0,
      deckRemaining: state.deck.length,
    });
    setLastCorrection(saved);
    setCorrectionsTick((t) => t + 1);
    // 保存校正后,下一次buildAdvice(摸牌/出牌时会自动读新数据,因为phase变化
  }, [state]);

  // === 请求辅助决策: 用户主动触发场景分析 ===
  const handleRequestAnalysis = useCallback(() => {
    if (!canDiscard) return;
    const hand = state.players[HUMAN_SEAT].hand;
    const codes = hand.map(tileCode);
    const result = analysisFromHandCodes(codes);
    setAnalysis(result);
    setShowAnalysis(true);
  }, [canDiscard, state]);

  // === 结束横幅折叠/展开控制 ===
  useEffect(() => {
    if (gameOver) {
      setResultCollapsed(false);
      setShowResultBadge(false);
      const t = window.setTimeout(() => {
        setResultCollapsed(true);
        setShowResultBadge(true);
      }, 6000);
      return () => window.clearTimeout(t);
    }
  }, [gameOver, state.round, state.isDraw, state.winner]);

  useEffect(() => {
    if (state.lastMistake) {
      setMistakeVisible(true);
      const t = window.setTimeout(() => setMistakeVisible(false), 4000);
      return () => window.clearTimeout(t);
    }
  }, [state.lastMistake]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🀄 红中推倒胡麻将训练工具</h1>
        <div className="header-controls">
          <label className="toggle-label">
            <input type="checkbox" checked={showLabel} onChange={(e) => setShowLabel(e.target.checked)} />
            牌型校验
          </label>
          {!started && <button className="start-btn" onClick={startGame}>开始游戏</button>}
          {gameOver && <button className="start-btn" onClick={newRound}>开始新一局</button>}
        </div>
      </header>

      <div className="main-layout">
        {/* 牌桌区 */}
        <div className="table-area">
          {started && state.players[3] && (
            <div className="seat-zone zone-top">
              <PlayerSeat player={state.players[3]} state={state} position="top" showLabel={showLabel} />
            </div>
          )}
          <div className="seat-row">
            <div className="seat-zone zone-left">
              {started && state.players[2] && (
                <PlayerSeat player={state.players[2]} state={state} position="left" showLabel={showLabel} />
              )}
            </div>
            <div className="center-area">
              {started ? (
                <CenterTable state={state} showLabel={showLabel} />
              ) : (
                <div className="welcome">
                  <div className="welcome-title">红中百搭 · 广东推倒胡</div>
                  <div className="welcome-desc">1人对战3AI · 仅自摸胡 · 严禁天胡地胡</div>
                  <div className="welcome-features">
                    ✓ 自动理牌 ✓ 实时建议 ✓ 复盘分析 ✓ 策略库 ✓ 校正学习
                  </div>
                  <button className="start-btn big" onClick={startGame}>开始游戏</button>
                </div>
              )}
            </div>
            <div className="seat-zone zone-right">
              {started && state.players[0] && (
                <PlayerSeat player={state.players[0]} state={state} position="right" showLabel={showLabel} />
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
                <MeldArea melds={human.melds} size={30} showLabel={showLabel} />
                <HandRow
                  hand={human.hand}
                  onDiscard={humanDiscard}
                  interactive={canDiscard}
                  showLabel={showLabel}
                  drawnTileId={state.drawnTileId}
                  recommendTileId={recTileId}
                />
                {canDiscard && !showAnalysis && (
                  <button className="request-analysis-btn" onClick={handleRequestAnalysis}>
                    🧭 请求辅助决策
                  </button>
                )}
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

        {/* 侧栏: 标签切换 */}
        <aside className="side-panel">
          <div className="tab-bar">
            <button className={tab === 'info' ? 'tab active' : 'tab'} onClick={() => setTab('info')}>信息</button>
            <button
              className={tab === 'advisor' ? 'tab active' : 'tab'}
              onClick={() => setTab('advisor')}
            >
              辅助{adviceActive || mistakeActive ? '●' : ''}
            </button>
            <button className={tab === 'review' ? 'tab active' : 'tab'} onClick={() => setTab('review')}>复盘</button>
            <button className={tab === 'strategy' ? 'tab active' : 'tab'} onClick={() => setTab('strategy')}>策略库</button>
            <button className={tab === 'log' ? 'tab active' : 'tab'} onClick={() => setTab('log')}>日志</button>
            <button className={tab === 'expert' ? 'tab active' : 'tab'} onClick={() => setTab('expert')}>
              专家{correctionsCount > 0 ? '●' : ''}
            </button>
          </div>

          <div className="tab-content">
            {tab === 'info' && <GameInfo state={state} onNewRound={newRound} />}
            {tab === 'advisor' && (
              <AdvisorPanel
                advice={state.lastAdvice}
                mistake={state.lastMistake}
                lastCorrection={lastCorrection}
                onCorrect={handleCorrect}
              />
            )}
            {tab === 'review' && (
              state.review ? (
                <ReviewPanel review={state.review} />
              ) : (
                <div className="empty-panel">对局结束后生成复盘报告</div>
              )
            )}
            {tab === 'strategy' && <StrategyLibPanel />}
            {tab === 'log' && <LogPanel state={state} />}
            {tab === 'expert' && (
              <ExpertPanel state={state} refreshTick={correctionsTick + state.round} />
            )}
          </div>
        </aside>
      </div>

      {/* 失误提醒浮层(即时,移到手牌上方300px位置,不遮挡) */}
      {state.lastMistake && mistakeVisible && (
        <div
          className="mistake-toast"
          onClick={() => { setTab('advisor'); setMistakeVisible(false); }}
        >
          <div className="toast-title">⚠️ 失误提醒</div>
          <div className="toast-body">
            打出【{state.lastMistake.discardedName}】: {state.lastMistake.issue}
          </div>
          <div className="toast-action">点击查看详情 →</div>
        </div>
      )}

      {/* 结束横幅(缩小版+折叠) */}
      {gameOver && !resultCollapsed && (
        <div className="result-banner" onClick={() => setResultCollapsed(true)}>
          {state.isDraw ? '流局' : `${SEAT_NAME[state.winner!]} 自摸胡牌！`}
          <div className="result-sub">点击侧栏"复盘"查看完整分析 · 点击横幅快速折叠</div>
          <div className="result-expand-hint">6秒后自动折叠</div>
        </div>
      )}
      {gameOver && showResultBadge && resultCollapsed && (
        <div
          className="result-badge"
          onClick={() => { setResultCollapsed(false); setShowResultBadge(false); }}
          title="点击恢复横幅"
        >
          {state.isDraw ? '📋 流局' : '🏆 ' + SEAT_NAME[state.winner!] + '胡 · 点击恢复'}
        </div>
      )}

      {/* 辅助决策场景分析浮层 */}
      {showAnalysis && analysis && (
        <div className="analysis-overlay" onClick={() => setShowAnalysis(false)}>
          <div className="analysis-container" onClick={(e) => e.stopPropagation()}>
            <SmartAnalysisPanel
              analysis={analysis}
              onClose={() => setShowAnalysis(false)}
              onDiscard={(tileId) => {
                setShowAnalysis(false);
                humanDiscard(tileId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

function countHandPairs(hand: any[]): number {
  const map: Record<string, number> = {};
  for (const t of hand) {
    if (isHongZhong(t)) continue;
    const k = tileCode(t);
    map[k] = (map[k] ?? 0) + 1;
  }
  return Object.values(map).reduce((s, v) => s + Math.floor(v / 2), 0);
}
