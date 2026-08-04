// 辅助决策面板: 实时建议 + 失误提醒 + 用户校正入口
import { useState } from 'react';
import type { AdviceData, MistakeAlert, UserCorrection } from '../game/types';
import { tileName } from '../game/types';
import { indexToTile } from '../game/types';

interface Props {
  advice: AdviceData | null;
  mistake: MistakeAlert | null;
  lastCorrection?: UserCorrection | null;
  onCorrect?: (payload: {
    userChoiceCode: string | null;
    userChoiceName: string | null;
    agree: boolean;
    userReason: string;
  }) => void;
}

const PHASE_TEXT: Record<number, string> = {
  [-1]: '已胡牌',
  0: '听牌',
  1: '一向听',
  2: '二向听',
  3: '三向听',
};

export function AdvisorPanel({ advice, mistake, lastCorrection, onCorrect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [correctionMode, setCorrectionMode] = useState<'idle' | 'agree' | 'disagree'>('idle');
  const [userChoiceCode, setUserChoiceCode] = useState<string>('');
  const [userReason, setUserReason] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const candidates = advice?.candidates ?? [];
  const sysCode = advice?.recommendDiscard?.code ?? null;
  const sysName = advice?.recommendDiscard?.name ?? null;

  const handleAgree = () => {
    if (!onCorrect || !advice) return;
    onCorrect({
      userChoiceCode: sysCode,
      userChoiceName: sysName,
      agree: true,
      userReason: '认同系统建议',
    });
    setSaveMsg('✅ 已记录认同,系统将继续学习你的偏好');
    setCorrectionMode('idle');
    setUserReason('');
    setUserChoiceCode('');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleSubmitCorrection = () => {
    if (!onCorrect || !advice) return;
    if (correctionMode === 'disagree') {
      if (!userChoiceCode) { setSaveMsg('请选择你认为更优的牌'); return; }
      if (userReason.trim().length < 2) { setSaveMsg('请简要填写校正理由(2字以上)'); return; }
      const chosen = candidates.find((c) => c.code === userChoiceCode);
      onCorrect({
        userChoiceCode,
        userChoiceName: chosen?.name ?? userChoiceCode,
        agree: false,
        userReason: userReason.trim(),
      });
    }
    setSaveMsg('✅ 已保存校正经验,将用于后续个性化建议');
    setCorrectionMode('idle');
    setUserReason('');
    setUserChoiceCode('');
    setTimeout(() => setSaveMsg(''), 3500);
  };

  const openDisagree = () => {
    // 默认选"候选排第2"作为起点(如果有)
    if (candidates.length >= 2) setUserChoiceCode(candidates[1].code);
    else if (candidates.length > 0) setUserChoiceCode(candidates[0].code);
    setCorrectionMode('disagree');
  };

  return (
    <div className="advisor-panel">
      <div className="advisor-title">🧭 辅助决策</div>

      {/* 上次校正摘要 */}
      {lastCorrection && (
        <div className="last-correction-note">
          <b>上次校正:</b>
          {lastCorrection.agree
            ? `认同系统建议打【${lastCorrection.systemRecommendName || '—'}】`
            : `纠正【${lastCorrection.systemRecommendName || '—'}】→【${lastCorrection.userChoiceName || '保留'}】`}
          <div className="lc-reason">理由: {lastCorrection.userReason}</div>
        </div>
      )}

      {/* 保存成功提示 */}
      {saveMsg && <div className="correction-save-msg">{saveMsg}</div>}

      {/* 失误提醒(优先展示) */}
      {mistake && (
        <div className="mistake-alert">
          <div className="mistake-header">⚠️ 失误提醒</div>
          <div className="mistake-body">
            您打出【{mistake.discardedName}】: {mistake.issue}
          </div>
          <div className="mistake-suggest">
            建议: 打出【{mistake.betterName}】 — {mistake.reason}
          </div>
        </div>
      )}

      {/* 实时建议 */}
      {advice ? (
        <>
          <div className="advice-shanten">
            当前: <b>{PHASE_TEXT[advice.shanten] ?? `${advice.shanten}向听`}</b>
            {advice.tingTiles.length > 0 && (
              <span className="ting-list">
                {' '}听 {advice.tingTiles.map((c) => tileName(indexToTile(codeToIdx(c)))).join('、')}
              </span>
            )}
          </div>
          {advice.recommendDiscard && (
            <div className="advice-rec">
              建议打出: <b className="rec-tile">{advice.recommendDiscard.name}</b>
            </div>
          )}
          <div className="advice-reason">{advice.reason}</div>
          <button className="expand-btn" onClick={() => setExpanded((e) => !e)}>
            {expanded ? '收起候选' : '展开候选详情'}
          </button>
          {expanded && (
            <div className="advice-candidates">
              {candidates.map((c, i) => (
                <label
                  className={`candidate-row ${correctionMode === 'disagree' && c.code === userChoiceCode ? 'cand-selected' : ''}`}
                  key={c.code}
                >
                  {correctionMode === 'disagree' && (
                    <input
                      type="radio"
                      name="user_choice"
                      checked={c.code === userChoiceCode}
                      onChange={() => setUserChoiceCode(c.code)}
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <span className="c-name">
                    {i === 0 && '★ '}{c.name}
                    {sysCode === c.code && correctionMode !== 'disagree' && <span className="sys-badge">系统推</span>}
                  </span>
                  <span className="c-shanten">向听{c.afterShanten}</span>
                  <span className="c-ting">{c.afterTing.length > 0 ? `听${c.afterTing.length}张` : '-'}</span>
                  <span className="c-note">{c.note}</span>
                </label>
              ))}
            </div>
          )}

          {/* 校正入口(只在有候选时显示) */}
          {candidates.length > 0 && (
            <div className="correction-area">
              <div className="correction-title">🤝 校正系统建议(帮助个性化学习)</div>
              {correctionMode === 'idle' && (
                <div className="correction-row">
                  <button className="cor-btn cor-agree" onClick={handleAgree}>
                    ✓ 我认同此建议
                  </button>
                  <button className="cor-btn cor-disagree" onClick={openDisagree}>
                    ✎ 我来纠正
                  </button>
                </div>
              )}
              {correctionMode === 'disagree' && (
                <div className="correction-form">
                  <div className="cor-tip">
                    请从上方候选中选择你认为更优的牌(单选radio),填写理由后提交
                  </div>
                  <textarea
                    className="cor-reason-input"
                    placeholder="为什么选这张? 例如: 这张是孤张/对手需要/想走七小对路线..."
                    value={userReason}
                    onChange={(e) => setUserReason(e.target.value)}
                    rows={2}
                  />
                  <div className="cor-form-actions">
                    <button className="cor-btn cor-submit" onClick={handleSubmitCorrection}>
                      提交校正
                    </button>
                    <button
                      className="cor-btn cor-cancel"
                      onClick={() => {
                        setCorrectionMode('idle');
                        setUserChoiceCode('');
                        setUserReason('');
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 策略库匹配提示(多条专业建议) */}
          {advice.strategyHints && advice.strategyHints.length > 0 && (
            <div className="strategy-hints">
              <div className="strategy-hints-title">📚 策略库匹配 ({advice.strategyHints.length}条)</div>
              {advice.strategyHints.slice(0, 5).map((h, i) => (
                <div className="strategy-hint-row" key={i}>
                  <span className="s-category">[{h.category}]</span>
                  <span className="s-tip">{h.tip}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="advice-empty">等待您的回合生成建议…</div>
      )}
    </div>
  );
}

function codeToIdx(code: string): number {
  const suit = code[0];
  const rank = parseInt(code.slice(1));
  const base = suit === 'm' ? 0 : suit === 'p' ? 9 : suit === 's' ? 18 : 27;
  return base + (rank - 1);
}
