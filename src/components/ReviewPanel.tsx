// 复盘面板: 局终展示全部手牌 + 关键决策 + 改进建议
import { useState } from 'react';
import type { ReviewReport } from '../game/types';
import { tileName, SEAT_NAME } from '../game/types';
import { formatReviewText } from '../game/review';
import { Tile } from './Tile';

interface Props {
  review: ReviewReport;
}

export function ReviewPanel({ review }: Props) {
  const [showAll, setShowAll] = useState(true);

  const handleCopy = () => {
    navigator.clipboard?.writeText(formatReviewText(review));
  };

  return (
    <div className="review-panel">
      <div className="review-title">📊 复盘报告 - 第{review.round}局</div>
      <div className="review-summary">{review.summary}</div>

      <div className="review-section">
        <div className="section-header" onClick={() => setShowAll((s) => !s)}>
          <span>{showAll ? '▼' : '▶'} 终局各家手牌(全部公开)</span>
        </div>
        {showAll && (
          <div className="review-hands">
            {review.finalHands.map((h) => (
              <div className="review-hand-row" key={h.seat}>
                <div className="rh-name">
                  {SEAT_NAME[h.seat]} · {h.name}
                  {review.winner === h.seat && <span className="winner-tag">胡</span>}
                </div>
                <div className="rh-hand">
                  {h.hand.map((t, i) => (
                    <Tile key={i} tile={t} size={24} />
                  ))}
                </div>
                {h.melds.length > 0 && (
                  <div className="rh-melds">
                    副露: {h.melds.map((m, mi) => (
                      <span key={mi} className="meld-tag">
                        {m.type}:{m.tiles.map((t) => tileName(t)).join('')}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rh-discards">
                  弃牌: {h.discards.map((t) => tileName(t)).join(' ') || '无'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="review-section">
        <div className="section-title">关键决策点分析</div>
        <div className="review-decisions">
          {review.keyDecisions.length === 0 && <div className="empty">无</div>}
          {review.keyDecisions.map((d, i) => (
            <div className="decision-row" key={i}>
              <div className="dec-head">[{d.time}] {SEAT_NAME[d.seat]} {d.action}</div>
              <div className="dec-analysis">{d.analysis}</div>
              <div className="dec-suggestion">→ {d.suggestion}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="review-section">
        <div className="section-title">改进建议</div>
        <ul className="improvements">
          {review.improvements.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <button className="copy-btn" onClick={handleCopy}>复制完整复盘</button>
    </div>
  );
}
