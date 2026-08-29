// 辅助决策面板: 竞品布局(打+计算结果+可听N门N张)
import type { ScenarioAnalysis, DiscardScenario, Tile as TileType } from '../game/types';
import { tileCode, tileName } from '../game/types';
import { buildHandFromCodes } from '../game/advisor';
import { Tile } from './Tile';

interface Props {
  analysis: ScenarioAnalysis;
  onClose: () => void;
  onDiscard?: (tileId: number) => void;
}

function shantenText(shanten: number): string {
  if (shanten < 0) return '已胡';
  if (shanten === 0) return '听牌';
  return `${shanten}进听`;
}

function codeToTile(code: string): TileType {
  const suit = code[0] as TileType['suit'];
  const rank = parseInt(code.slice(1), 10);
  return { id: -1, suit, rank };
}

export function SmartAnalysisPanel({ analysis, onClose, onDiscard }: Props) {
  const handTiles = buildHandFromCodes(analysis.handCodes);

  const handleDiscard = (scenario: DiscardScenario): void => {
    if (!onDiscard) return;
    const tile = handTiles.find((t) => tileCode(t) === scenario.discardCode);
    if (tile) onDiscard(tile.id);
  };

  // 取最优方案生成摘要
  const best = analysis.scenarios[0];

  return (
    <div className="sap">
      {/* 标题栏 */}
      <div className="sap-header">
        <span className="sap-title">辅助决策分析</span>
        <button className="sap-close" onClick={onClose}>✕</button>
      </div>

      {/* 当前状态 */}
      <div className="sap-summary">
        <span>当前: <b>{shantenText(analysis.currentShanten)}</b></span>
        {best && (
          <span className="sap-summary-rec">
            推荐打【{best.discardName}】, 可进{best.categoryCount}门{best.tileCount}张
          </span>
        )}
      </div>

      {/* 手牌展示 */}
      <div className="sap-hand">
        <div className="sap-hand-label">手牌({handTiles.length}张)</div>
        <div className="sap-hand-tiles">
          {handTiles.map((t, i) => (
            <Tile key={i} tile={t} size={30} />
          ))}
        </div>
      </div>

      {/* 场景卡片列表 */}
      <div className="sap-scenarios">
        {analysis.scenarios.map((s, i) => (
          <div key={i} className={`sap-card ${i === 0 ? 'sap-card-best' : ''}`}>
            {/* 左侧: 打出的牌 */}
            <div className="sap-card-left">
              <div className="sap-card-label">打</div>
              <Tile tile={codeToTile(s.discardCode)} size={36} />
            </div>

            {/* 右侧: 分析结果 */}
            <div className="sap-card-right">
              {/* 计算结果行 */}
              <div className="sap-card-result">
                计算结果: <b>{shantenText(s.shantenAfter)}</b>
              </div>

              {/* 可进张数 + 牌面 */}
              <div className="sap-card-ting">
                {s.tingTiles.length > 0 ? (
                  <>
                    <span>可听<b>{s.tingTiles.length}</b>门<b>{s.tileCount}</b>张</span>
                    <div className="sap-card-ting-tiles">
                      {s.tingTiles.map((code, j) => (
                        <Tile key={j} tile={codeToTile(code)} size={26} />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span>可进<b>{s.categoryCount}</b>门<b>{s.tileCount}</b>张</span>
                    <div className="sap-card-ting-tiles">
                      {s.improvementCodes.map((code, j) => (
                        <Tile key={j} tile={codeToTile(code)} size={26} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 打出此牌按钮 */}
              {onDiscard && (
                <button className="sap-card-btn" onClick={() => handleDiscard(s)}>
                  打出此牌
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
