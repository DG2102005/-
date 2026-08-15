// 侧栏辅助决策面板 — 基于 skill 引擎（轻量，非 advisor）
// 可视化：打哪张 → 计算结果(几进听) → 可听/可进 N 门 N 张 → 进张牌面
import { useMemo } from 'react';
import type { Tile } from '../game/types';
import { tileCode, isHongZhong } from '../game/types';
import {
  analyzeHand, analyzePartialHand, codeName, toSkillCode,
  type SkillAnalysis, type SkillScenario,
} from '../game/skillEngine';
import { Tile as TileComp } from './Tile';

// ─── 工具 ──────────────────────────────────

export function codeToTile(code: string): Tile {
  const suit = code[0] as Tile['suit'];
  const rank = parseInt(code.slice(1), 10);
  return { id: -1, suit, rank };
}

export function shantenText(s: number): string {
  if (s < 0) return '已胡';
  if (s === 0) return '听牌';
  return `${s}进听`; // 进听 = 还需进s张有效牌即可听牌(标准向听数)
}

// ─── 场景卡片列表（供侧栏 / Simulator 弹层复用） ──

interface ScenariosProps {
  analysis: SkillAnalysis;
  onPick?: (discardCode: string) => void; // 点击"打出此牌"
}

export function AdvisorScenarios({ analysis, onPick }: ScenariosProps) {
  // 红中不可打出（与游戏规则一致），排除后按引擎排序展示
  const scenarios = useMemo(
    () => analysis.scenarios.filter((s) => s.discardCode !== 'z5'),
    [analysis],
  );

  return (
    <div className="adv">
      {/* 手牌预览 */}
      <div className="adv-hand">
        <div className="adv-hand-label">手牌({analysis.handCodes.length}张)</div>
        <div className="adv-hand-tiles">
          {analysis.handCodes.map((c, i) => (
            <TileComp key={i} tile={codeToTile(c)} size={26} />
          ))}
        </div>
      </div>

      {/* 场景卡片 */}
      <div className="adv-scenarios">
        {scenarios.length === 0 && (
          <div className="adv-empty">全部手牌均为红中，无法打出</div>
        )}
        {scenarios.slice(0, 6).map((s, i) => (
          <ScenarioCard key={s.discardCode} scenario={s} best={i === 0} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario, best, onPick,
}: {
  scenario: SkillScenario;
  best: boolean;
  onPick?: (code: string) => void;
}) {
  const { discardCode, discardName, shantenAfter, isTenpai, tiles, categoryCount, tileCount } = scenario;
  const limit = 12; // 进张牌面最多展示 12 张
  return (
    <div className={`adv-card ${best ? 'adv-card-best' : ''}`}>
      {/* 左侧: 打出的牌 */}
      <div className="adv-card-left">
        <div className="adv-card-label">{best ? '★ 打' : '打'}</div>
        <TileComp tile={codeToTile(discardCode)} size={40} />
        <div className="adv-card-name">{discardName}</div>
      </div>

      {/* 右侧: 分析结果 */}
      <div className="adv-card-right">
        <div className="adv-card-result">
          计算结果: <b className={shantenAfter === 0 ? 'adv-ting' : ''}>{shantenText(shantenAfter)}</b>
        </div>
        <div className="adv-card-ting">
          {isTenpai ? '可听' : '可进'}
          <b>{categoryCount}</b>门<b>{tileCount}</b>张
        </div>
        <div className="adv-card-tiles">
          {tiles.slice(0, limit).map((t, j) => (
            <div key={j} className="adv-card-tile">
              <TileComp tile={codeToTile(t.code)} size={26} />
              <span className="adv-card-remain">{t.remain}</span>
            </div>
          ))}
          {tiles.length > limit && (
            <span className="adv-more">+{tiles.length - limit}</span>
          )}
        </div>
        {onPick && (
          <button className="adv-card-btn" onClick={() => onPick(discardCode)}>
            打出此牌
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 侧栏面板（绑定对弈局人类手牌） ──

interface Props {
  hand: Tile[];            // 人类手牌
  meldCount: number;       // 副露数
  canDiscard: boolean;     // 当前可出牌
  onDiscard: (tileId: number) => void;
  seenTiles?: Tile[];      // 已见牌(各家舍牌/副露), 用于扣除剩余张数
}

export function AdvisorTab({ hand, meldCount, canDiscard, onDiscard, seenTiles }: Props) {
  const expectLen = 14 - 3 * meldCount;

  // 已见牌计数(skill码): 各家已舍出的 + 副露明牌; 自己手牌已含在分析中
  const seenCounts = useMemo(() => {
    const sc: Record<number, number> = {};
    if (!seenTiles) return sc;
    for (const t of seenTiles) {
      const k = toSkillCode(tileCode(t));
      sc[k] = (sc[k] ?? 0) + 1;
    }
    return sc;
  }, [seenTiles]);

  const { status, analysis, partial } = useMemo(() => {
    const codes = hand.map((t) => (isHongZhong(t) ? 'z5' : tileCode(t)));
    if (codes.length === expectLen) {
      try {
        const a = analyzeHand(codes, meldCount, seenCounts);
        return { status: 'full' as const, analysis: a, partial: null };
      } catch {
        return { status: 'empty' as const, analysis: null, partial: null };
      }
    }
    if (codes.length === expectLen - 1) {
      const p = analyzePartialHand(codes, meldCount, seenCounts);
      return { status: 'partial' as const, analysis: null, partial: p };
    }
    return { status: 'empty' as const, analysis: null, partial: null };
  }, [hand, expectLen, meldCount, seenCounts]);

  const handlePick = (discardCode: string): void => {
    if (!canDiscard) return;
    const tile = hand.find((t) => (isHongZhong(t) ? 'z5' : tileCode(t)) === discardCode);
    if (tile) onDiscard(tile.id);
  };

  // 推荐展示取第一个非红中候选（红中不可打出）
  const recommendCode = useMemo(
    () => analysis?.scenarios.find((s) => s.discardCode !== 'z5')?.discardCode ?? null,
    [analysis],
  );

  return (
    <div className="adv-tab">
      <div className="adv-tab-title">
        🧭 辅助决策
        <span className="adv-tab-note">标准胡型 · 红中可当任意牌</span>
      </div>

      {status === 'empty' && (
        <div className="empty-panel">开局后即可查看打牌建议</div>
      )}

      {status === 'full' && analysis && (
        <>
          <div className="adv-summary">
            <span>
              当前: <b className={analysis.isWinNow ? 'adv-win-txt' : ''}>{analysis.isWinNow ? '已胡!' : shantenText(analysis.currentShanten)}</b>
            </span>
            {!analysis.isWinNow && recommendCode && (
              <span className="adv-summary-rec">
                推荐打【{codeName(recommendCode)}】
              </span>
            )}
          </div>
          {analysis.isWinNow ? (
            <div className="adv-win">🎉 当前手牌已满足胡牌条件(4面子+1将)，直接胡牌</div>
          ) : (
            <AdvisorScenarios analysis={analysis} onPick={canDiscard ? handlePick : undefined} />
          )}
        </>
      )}

      {status === 'partial' && partial && (
        <div className="adv-summary">
          <span>
            已舍牌 · 当前: <b className={partial.isTenpai ? 'adv-ting' : ''}>{shantenText(partial.shanten)}</b>
          </span>
          <span className="adv-summary-rec">
            {partial.isTenpai ? `可胡${partial.tiles.length}门${partial.tileCount}张` : `可进${partial.tiles.length}门${partial.tileCount}张`}
          </span>
          <div className="adv-card-tiles" style={{ marginTop: 6 }}>
            {partial.tiles.slice(0, 12).map((t, j) => (
              <div key={j} className="adv-card-tile">
                <TileComp tile={codeToTile(t.code)} size={26} />
                <span className="adv-card-remain">{t.remain}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
