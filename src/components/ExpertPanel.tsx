// 红中麻将专家 Tab: 局势评分 + 校正趋势 + 经验库管理 + 个性化建议对比
import { useEffect, useMemo, useState } from 'react';
import type { GameState, AdviceData, UserCorrection } from '../game/types';
import { HUMAN_SEAT } from '../game/constants';
import { tileCode, tileName, isHongZhong, indexToTile } from '../game/types';
import {
  loadCorrections, saveCorrection, clearCorrections, deleteCorrection,
  exportCorrections, importCorrections, getCorrectionTrend, computeSituationScore,
} from '../game/correctionLib';
import type { StrategyContext } from '../game/strategyLib';
import { buildAdvice } from '../game/advisor';

interface Props {
  state: GameState;
  refreshTick: number; // 校正后+1触发重新渲染
}

export function ExpertPanel({ state, refreshTick }: Props) {
  const [corrections, setCorrections] = useState<UserCorrection[]>([]);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedRecent, setExpandedRecent] = useState<Record<string, boolean>>({});

  const refresh = () => setCorrections(loadCorrections());
  useEffect(() => { refresh(); }, [refreshTick, state.round]);
  useEffect(() => { refresh(); }, []);

  // ===== 局势上下文 & 评分 =====
  const { ctx, score, advice } = useMemo(() => {
    const human = state.players[HUMAN_SEAT];
    if (!human || !human.hand || human.hand.length === 0) {
      return {
        ctx: null as StrategyContext | null,
        score: null,
        advice: null as AdviceData | null,
      };
    }
    const phase: 'early' | 'mid' | 'late' =
      state.deck.length > 60 ? 'early' : state.deck.length > 30 ? 'mid' : 'late';
    const hand = human.hand;
    const pairCount = countPairs(hand);
    const hongZhongCount = hand.filter((t) => isHongZhong(t)).length;
    // 尝试生成当前advice(如果正在discard阶段自己的回合,且有13/14张手牌)
    let adviceRes: AdviceData | null = null;
    try {
      if (state.currentSeat === HUMAN_SEAT && state.phase === 'discard') {
        adviceRes = buildAdvice(state, HUMAN_SEAT);
      }
    } catch { /* noop */ }
    const shanten = adviceRes?.shanten ?? 3;
    const isTenpai = adviceRes ? adviceRes.tingTiles.length > 0 : shanten === 0;
    const strategyCtx: StrategyContext = {
      handCode: hand.map(tileCode).sort().join(','),
      phase,
      hongZhongCount,
      pairCount,
      meldsCount: human.melds.length,
      isTenpai,
      shanten,
      seatIsDealer: human.isDealer,
    };
    const scoreRes = computeSituationScore(strategyCtx, corrections);
    return { ctx: strategyCtx, score: scoreRes, advice: adviceRes };
  }, [state, corrections]);

  const trend = useMemo(() => getCorrectionTrend(), [corrections, refreshTick]);

  const showMsg = (text: string, ok: boolean = true) => {
    setMsg(text);
    setMsgType(ok ? 'ok' : 'err');
    setTimeout(() => setMsg(''), 3000);
  };

  const handleExport = () => {
    const json = exportCorrections();
    navigator.clipboard?.writeText(json);
    showMsg(`已复制${corrections.length}条校正经验到剪贴板`);
  };

  const handleImport = () => {
    if (!importText.trim()) { showMsg('请粘贴JSON', false); return; }
    const r = importCorrections(importText);
    showMsg(`导入完成:成功${r.ok}条,失败${r.fail}条`, r.ok > 0);
    setImportText('');
    refresh();
  };

  const handleClear = () => {
    clearCorrections();
    setShowConfirmClear(false);
    refresh();
    showMsg('已清空全部校正经验');
  };

  const handleDelete = (id: string) => {
    deleteCorrection(id);
    refresh();
    showMsg('已删除该条校正');
  };

  // 校正历史搜索过滤
  const recentFiltered = useMemo(() => {
    const list = [...corrections].reverse();
    if (!searchText.trim()) return list.slice(0, 20);
    const q = searchText.trim().toLowerCase();
    return list.filter((c) =>
      (c.systemRecommendName ?? '').toLowerCase().includes(q) ||
      (c.userChoiceName ?? '').toLowerCase().includes(q) ||
      c.userReason.toLowerCase().includes(q) ||
      (c.handCodes ?? []).some((x) => x.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [corrections, searchText]);

  // 个性化 vs 标准建议对比(从advice中candidates排序差看出)
  const compareAdvice = useMemo(() => {
    if (!advice || !advice.candidates || advice.candidates.length < 2) return null;
    const standardTop = advice.candidates[0];
    // 标准candidates应该是按score排序,但如果有校正加权,第1名可能与纯牌效不同
    // 这里简化:展示前3名的牌,作为"系统推荐"
    return {
      standard: advice.candidates[0],
      alternative: advice.candidates.slice(1, 3),
    };
  }, [advice]);

  return (
    <div className="expert-panel">
      <div className="expert-title">🏆 红中麻将专家</div>
      <div className="expert-desc">局势诊断 + 个性化校正 + 你的专属策略大脑</div>

      {/* 1. 局势评分 */}
      <section className="exp-section">
        <div className="sec-title">📡 当前局势评分</div>
        {score && ctx ? (
          <>
            <div className="score-overall">
              综合分: <span className="overall-num">{score.overall}</span> / 100
              <div className="score-tags">
                {score.tags.map((t, i) => <span className="score-tag" key={i}>{t}</span>)}
              </div>
            </div>
            <ScoreBar label="进攻分" color="#ff6b6b" value={score.offense} />
            <ScoreBar label="防守分" color="#4dabf7" value={score.defense} />
            <ScoreBar label="牌效分" color="#ffd43b" value={score.tileEfficiency} />
            <ScoreBar label="红中运用" color="#69db7c" value={score.hongzhongHealth} />
            <div className="score-ctx-meta">
              阶段:{phaseLabel(ctx.phase)} · 红中{ctx.hongZhongCount}张 · 对子{ctx.pairCount}对 ·
              副露{ctx.meldsCount} · 向听{ctx.shanten}
            </div>
          </>
        ) : (
          <div className="empty-s">对局开始后自动分析</div>
        )}
      </section>

      {/* 2. 校正统计 */}
      <section className="exp-section">
        <div className="sec-title">📈 校正趋势(累计 {trend.totalCorrections} 条)</div>
        <div className="trend-grid">
          <div className="trend-cell">
            <div className="trend-num">{Math.round(trend.agreeRate * 100)}%</div>
            <div className="trend-label">认同率</div>
          </div>
          <div className="trend-cell">
            <div className="trend-num">{trend.totalCorrections}</div>
            <div className="trend-label">总校正</div>
          </div>
        </div>
        {trend.topDisagreeCategories.length > 0 && (
          <div className="disagree-cats">
            <b>常见分歧:</b>
            {trend.topDisagreeCategories.map((c, i) => <span key={i} className="cat-chip">{c}</span>)}
          </div>
        )}
        <div className="expert-tips">
          💡 认同率 ≥80%: 系统已贴近你的偏好。常见分歧多的类别会持续加权调整。
        </div>
      </section>

      {/* 3. 标准 vs 个性化建议对比 */}
      {compareAdvice && (
        <section className="exp-section">
          <div className="sec-title">🎯 当前建议(加权)</div>
          <table className="adv-table">
            <thead><tr><th>排名</th><th>建议牌</th><th>向听</th><th>听牌</th><th>备注</th></tr></thead>
            <tbody>
              <tr className="row-top">
                <td>1★</td><td>{compareAdvice.standard.name}</td>
                <td>{compareAdvice.standard.afterShanten}</td>
                <td>{compareAdvice.standard.afterTing.length > 0 ? `${compareAdvice.standard.afterTing.length}张` : '—'}</td>
                <td>{compareAdvice.standard.note}</td>
              </tr>
              {compareAdvice.alternative.map((c, i) => (
                <tr key={i}>
                  <td>{i + 2}</td><td>{c.name}</td>
                  <td>{c.afterShanten}</td>
                  <td>{c.afterTing.length > 0 ? `${c.afterTing.length}张` : '—'}</td>
                  <td>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {advice?.reason && <div className="advice-reason-inline">{advice.reason}</div>}
        </section>
      )}

      {/* 4. 经验库工具 */}
      <section className="exp-section">
        <div className="sec-title">📚 校正经验库管理</div>
        <div className="toolbar-row">
          <button className="exp-btn" onClick={handleExport}>📋 导出JSON</button>
          {!showConfirmClear ? (
            <button className="exp-btn exp-danger" onClick={() => setShowConfirmClear(true)}>🗑 清空</button>
          ) : (
            <>
              <button className="exp-btn exp-danger" onClick={handleClear}>确认清空</button>
              <button className="exp-btn" onClick={() => setShowConfirmClear(false)}>取消</button>
            </>
          )}
        </div>
        <div className="import-area">
          <textarea
            placeholder="粘贴校正经验JSON(支持数组/单条) → 导入后用于跨设备共享"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={2}
          />
          <button className="exp-btn" onClick={handleImport}>导入</button>
        </div>
        {msg && <div className={`msg ${msgType === 'ok' ? 'msg-ok' : 'msg-err'}`}>{msg}</div>}
      </section>

      {/* 5. 校正历史搜索 */}
      <section className="exp-section">
        <div className="sec-title">🧩 校正历史(最近 {recentFiltered.length} 条)</div>
        <input
          className="search-input"
          placeholder="搜索牌名/理由关键词..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <div className="correction-list">
          {recentFiltered.length === 0 && (
            <div className="empty-s">暂无校正记录。可在"辅助"Tab认同或纠正系统建议积累经验。</div>
          )}
          {recentFiltered.map((c) => {
            const isOpen = !!expandedRecent[c.id];
            return (
              <div className="corr-row" key={c.id}>
                <div className="corr-head" onClick={() => setExpandedRecent((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                  <span className={`corr-badge ${c.agree ? 'corr-ok' : 'corr-fix'}`}>
                    {c.agree ? '认同' : '纠正'}
                  </span>
                  <span className="corr-sum">
                    {c.agree
                      ? `【${c.systemRecommendName || '—'}】`
                      : `【${c.systemRecommendName || '—'}】→【${c.userChoiceName || '保留'}】`}
                  </span>
                  <span className="corr-time">{new Date(c.time).toLocaleString()}</span>
                  <button className="mini-btn del" onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>删</button>
                </div>
                {isOpen && (
                  <div className="corr-detail">
                    <div><b>用户理由:</b>{c.userReason}</div>
                    <div><b>局面:</b>{phaseLabel(c.phase)} · 红中{c.hongZhongCount} · 对子{c.pairCount} · 副露{c.meldsCount} · 牌墙剩{c.deckRemaining}</div>
                    <div>
                      <b>当时手牌:</b>
                      {c.handCodes.map((code, i) => (
                        <span className="mini-tile" key={i}>{prettyCode(code)}</span>
                      ))}
                    </div>
                    {c.candidatesAtTime && c.candidatesAtTime.length > 0 && (
                      <details>
                        <summary>候选打分({c.candidatesAtTime.length})</summary>
                        <ul>
                          {c.candidatesAtTime.map((x, i) => (
                            <li key={i}>
                              #{i + 1} <b>{x.name}</b>(得分{x.score}, 向听{x.afterShanten}, {x.afterTing.length > 0 ? `听${x.afterTing.length}张` : '未听'}) — {x.note}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. 说明 */}
      <section className="exp-section exp-privacy">
        <div className="sec-title">🔐 关于校正数据</div>
        <ul>
          <li>数据仅保存在你的浏览器 localStorage, <b>不会上传任何服务器</b></li>
          <li>可随时导出 JSON 做备份/跨设备迁移</li>
          <li>校正后建议会按你的历史偏好自动加权(最近100条影响最大)</li>
          <li>若想重置为出厂默认,点【清空】即可</li>
        </ul>
      </section>
    </div>
  );
}

function ScoreBar({ label, color, value }: { label: string; color: string; value: number }) {
  return (
    <div className="scorebar-row">
      <div className="scorebar-label" style={{ color }}>{label}</div>
      <div className="scorebar-track">
        <div
          className="scorebar-fill"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
        />
      </div>
      <div className="scorebar-val">{value}</div>
    </div>
  );
}

function countPairs(hand: any[]): number {
  const map: Record<string, number> = {};
  for (const t of hand) {
    if (t.suit === 'z' && t.rank === 5) continue;
    const k = `${t.suit}${t.rank}`;
    map[k] = (map[k] ?? 0) + 1;
  }
  return Object.values(map).reduce((s, v) => s + Math.floor(v / 2), 0);
}

function phaseLabel(p: string): string {
  return p === 'early' ? '前期' : p === 'late' ? '后期' : '中期';
}

function prettyCode(code: string): string {
  if (!code || code.length < 2) return code;
  try {
    const idx = codeToIdx(code);
    return tileName(indexToTile(idx));
  } catch {
    return code;
  }
}
function codeToIdx(code: string): number {
  const suit = code[0]; const rank = parseInt(code.slice(1));
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : suit === 's' ? 18 : 27;
  return base + (rank - 1);
}

// 供外部(useGame/App)调用, 直接保存校正并返回记录, 不依赖组件内部
export function saveCorrectionExternally(
  payload: Parameters<typeof saveCorrection>[0]
): UserCorrection {
  return saveCorrection(payload);
}
