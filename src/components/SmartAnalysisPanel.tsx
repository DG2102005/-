// 按需辅助决策: 场景分析卡片面板
// 用户点击"请求辅助决策"按钮后弹出, 展示多个弃牌场景对比
import type { ScenarioAnalysis, DiscardScenario, Tile as TileType } from '../game/types';
import { tileCode, tileName } from '../game/types';
import { buildHandFromCodes, codeToIndex } from '../game/advisor';
import { Tile } from './Tile';

interface Props {
  analysis: ScenarioAnalysis;
  onClose: () => void;
  onDiscard?: (tileId: number) => void; // 点击场景卡片可直接出牌(可选)
}

// 向听数转中文描述: -1=已胡, 0=听牌, 1=一向听, 2=二向听...
function shantenText(shanten: number): string {
  if (shanten < 0) return '已胡';
  if (shanten === 0) return '听牌';
  if (shanten === 1) return '一向听';
  if (shanten === 2) return '二向听';
  if (shanten === 3) return '三向听';
  return `${shanten}向听`;
}

// 计算结果文字: 打出后向听数对应的描述
function resultText(shantenAfter: number): string {
  if (shantenAfter < 0) return '已胡';
  if (shantenAfter === 0) return '听牌';
  return `${shantenAfter}轮胡`;
}

// code 转 Tile 对象(用于渲染进牌, 无具体 id)
function codeToTile(code: string): TileType {
  const suit = code[0] as TileType['suit'];
  const rank = parseInt(code.slice(1), 10);
  return { id: -1, suit, rank };
}

// code 转中文名
function nameOf(code: string): string {
  return tileName(codeToTile(code));
}

function dangerText(level: number): string {
  if (level >= 2) return '高危险';
  if (level === 1) return '中等危险';
  return '相对安全';
}

export function SmartAnalysisPanel({ analysis, onClose, onDiscard }: Props) {
  const handTiles = buildHandFromCodes(analysis.handCodes);

  const handleDiscard = (scenario: DiscardScenario): void => {
    if (!onDiscard) return;
    const tile = handTiles.find((t) => tileCode(t) === scenario.discardCode);
    if (tile) onDiscard(tile.id);
  };

  return (
    <div className="smart-analysis-panel">
      {/* 顶部: 标题 + 关闭按钮 */}
      <div className="sap-header">
        <span className="sap-title">辅助决策分析</span>
        <button className="sap-close" onClick={onClose}>✕</button>
      </div>

      {/* 当前状态摘要 */}
      <div className="sap-summary">
        <div className="sap-shanten">
          当前: <b>{shantenText(analysis.currentShanten)}</b>
        </div>
        <div className="sap-summary-text">
          {analysis.scenarios.length > 0
            ? `推荐打【${analysis.scenarios[0].discardName}】, 可${analysis.scenarios[0].shantenAfter === 0 ? '胡' : '进'}${analysis.scenarios[0].categoryCount}门${analysis.scenarios[0].tileCount}张`
            : '暂无有效分析'}
        </div>
      </div>

      {/* 当前手牌展示(排序后的牌面) */}
      <div className="sap-hand">
        <div className="sap-hand-label">手牌:</div>
        <div className="sap-hand-tiles">
          {handTiles.map((t, i) => (
            <Tile key={i} tile={t} size={28} />
          ))}
        </div>
      </div>

      {/* 场景卡片列表 */}
      <div className="sap-scenarios">
        {analysis.scenarios.map((s, i) => (
          <div key={i} className={`scenario-card ${i === 0 ? 'scenario-best' : ''}`}>
            {/* 左侧: 打出哪张牌 */}
            <div className="scenario-discard">
              <div className="scenario-discard-label">打</div>
              <Tile tile={codeToTile(s.discardCode)} size={32} />
              <div className="scenario-discard-name">{s.discardName}</div>
            </div>

            {/* 右侧: 进牌网格 */}
            <div className="scenario-incoming">
              <div className="scenario-incoming-label">
                可进 <b>{s.categoryCount}</b>门 <b>{s.tileCount}</b>张
              </div>
              <div className="scenario-incoming-grid">
                {s.improvementCodes.length > 0 ? (
                  s.improvementCodes.map((code, j) => (
                    <Tile key={j} tile={codeToTile(code)} size={24} />
                  ))
                ) : (
                  <span className="scenario-no-incoming">无进牌</span>
                )}
              </div>
            </div>

            {/* 底部: 计算结果 + 危险度 */}
            <div className="scenario-footer">
              <span className="scenario-result">计算结果: {resultText(s.shantenAfter)}</span>
              <span className={`scenario-danger danger-${s.dangerLevel}`}>{dangerText(s.dangerLevel)}</span>
            </div>
            <div className="scenario-metrics">
              <div className="metric">
                <span className="metric-label">期望价值</span>
                <span className="metric-value">{s.expectedValue.toFixed(1)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">向听</span>
                <span className="metric-value">{shantenText(s.shantenAfter)}</span>
              </div>
            </div>
            <div className="scenario-reasoning">{s.reasoning}</div>

            {/* 点击执行出牌(可选) */}
            {onDiscard && (
              <button
                className="scenario-exec-btn"
                onClick={() => handleDiscard(s)}
              >
                打出此牌
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
