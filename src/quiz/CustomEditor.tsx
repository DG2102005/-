// 自定义题目编辑器(创建/编辑)
import { useMemo, useState } from 'react';
import type { QuizQuestion, QuizCategory, Difficulty } from '../game/quizTypes';
import { Tile } from '../components/Tile';
import { buildHandFromCodes, analysisFromHandCodes } from '../game/advisor';
import { indexToTile, tileCode } from '../game/types';
import { sortHand } from '../game/sort';
import { canWin } from '../game/win';
import { updateCustomQuestion, generateCustomId } from './storage';
import type { ScenarioAnalysis } from '../game/types';

interface Props {
  questionId?: string;
  existing?: QuizQuestion;
  onSaved: (q: QuizQuestion) => void;
  onCancel: () => void;
  onPreview: (q: QuizQuestion) => void;
}

const CATEGORIES: QuizCategory[] = ['搭子取舍', '听牌选择', '红中运用', '对子处理', '金张判断', '综合复杂'];

const ALL_CODES: string[] = (() => {
  const codes: string[] = [];
  for (let i = 0; i < 34; i++) {
    const t = indexToTile(i);
    codes.push(tileCode(t));
  }
  return codes;
})();

const ROWS: { label: string; codes: string[] }[] = [
  { label: '万', codes: ALL_CODES.slice(0, 9) },
  { label: '筒', codes: ALL_CODES.slice(9, 18) },
  { label: '条', codes: ALL_CODES.slice(18, 27) },
  { label: '字', codes: ALL_CODES.slice(27, 34) },
];

type OptionMode = 'auto' | 'manual';

export function CustomEditor({ existing, onSaved, onCancel, onPreview }: Props) {
  const [category, setCategory] = useState<string>(existing?.category ?? '搭子取舍');
  const [difficulty, setDifficulty] = useState<Difficulty>(existing?.difficulty ?? 'easy');
  const [handCodes, setHandCodes] = useState<string[]>(existing?.handCodes ?? []);
  const [meldCount, setMeldCount] = useState<number>(existing?.meldCount ?? 0);
  const [question, setQuestion] = useState<string>(existing?.question ?? '红中麻将中打哪一张牌胡牌最快?');
  const [optionMode, setOptionMode] = useState<OptionMode>('auto');
  const [optionCodes, setOptionCodes] = useState<string[]>(existing?.optionCodes ?? []);
  const [answerIndex, setAnswerIndex] = useState<0 | 1 | 2 | 3>(existing?.answerIndex ?? 0);
  const [explanation, setExplanation] = useState<string>(existing?.explanation ?? '');
  const [discardsPool, setDiscardsPool] = useState<string[]>(existing?.discardsPool ?? []);
  const [errors, setErrors] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);

  // 计算牌池剩余张数(初始 4 - 手牌已用)
  const poolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of ALL_CODES) counts[c] = 4;
    for (const c of handCodes) {
      if (counts[c] !== undefined) counts[c]--;
    }
    return counts;
  }, [handCodes]);

  const sortedHandTiles = useMemo(() => sortHand(buildHandFromCodes(handCodes)), [handCodes]);

  const handFull = handCodes.length >= 14;

  // 点击牌池: 加入手牌
  const handlePoolClick = (code: string) => {
    if (handFull) return;
    if (poolCounts[code] <= 0) return;
    setHandCodes((prev) => [...prev, code]);
    setErrors([]);
  };

  // 自动填充随机 14 张
  const handleAutoFill = () => {
    const all: string[] = [];
    for (const c of ALL_CODES) for (let i = 0; i < 4; i++) all.push(c);
    // 洗牌
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    setHandCodes(all.slice(0, 14));
    setErrors([]);
  };

  const handleClearHand = () => {
    setHandCodes([]);
    setOptionCodes([]);
    setErrors([]);
  };

  // 自动生成选项(基于 analysis 取前4)
  const handleAutoOptions = () => {
    if (handCodes.length !== 14) {
      setErrors(['手牌必须 14 张才能自动生成选项']);
      return;
    }
    const a = analysisFromHandCodes(handCodes, meldCount, discardsPool);
    setAnalysis(a);
    const top4 = a.scenarios.slice(0, 4).map((s) => s.discardCode);
    if (top4.length < 4) {
      setErrors(['可弃牌场景不足 4 个,请调整手牌结构']);
      return;
    }
    setOptionCodes(top4);
    setAnswerIndex(0);
    setErrors([]);
  };

  // 自动判定答案
  const handleAutoAnswer = () => {
    if (optionCodes.length !== 4) {
      setErrors(['请先生成或选择 4 个选项']);
      return;
    }
    const a = analysis ?? analysisFromHandCodes(handCodes, meldCount, discardsPool);
    setAnalysis(a);
    // 找到 score 最高的选项
    let bestIdx = 0;
    let bestScore = -Infinity;
    optionCodes.forEach((code, i) => {
      const s = a.scenarios.find((x) => x.discardCode === code);
      if (s && s.score > bestScore) { bestScore = s.score; bestIdx = i; }
    });
    setAnswerIndex(bestIdx as 0 | 1 | 2 | 3);
    setErrors([]);
  };

  // 自动生成解析
  const handleAutoExplain = () => {
    if (optionCodes.length !== 4) {
      setErrors(['请先生成或选择 4 个选项']);
      return;
    }
    const a = analysis ?? analysisFromHandCodes(handCodes, meldCount, discardsPool);
    setAnalysis(a);
    const bestCode = optionCodes[answerIndex];
    const best = a.scenarios.find((s) => s.discardCode === bestCode);
    if (!best) {
      setErrors(['未找到对应弃牌场景']);
      return;
    }
    const tingText = best.shantenAfter === 0 && best.incomingNames.length > 0
      ? `听牌,可胡: ${best.incomingNames.join('、')}(共${best.tileCount}张)`
      : `${best.shantenAfter}向听,可进${best.categoryCount}门${best.tileCount}张`;
    const text = `最优打法: 打出【${best.discardName}】。\n打出后${tingText}。\n${best.reasoning}\n关键: ${best.dangerLevel > 1 ? '注意该牌危险度较高,需谨慎。' : '该牌为相对安全的弃张。'}`;
    setExplanation(text);
    setErrors([]);
  };

  // 手动选择选项(从手牌点选 4 张)
  const handleManualOptionClick = (code: string) => {
    if (optionCodes.includes(code)) {
      // 取消
      setOptionCodes((prev) => prev.filter((c) => c !== code));
    } else if (optionCodes.length < 4) {
      setOptionCodes((prev) => [...prev, code]);
    }
    setErrors([]);
  };

  // 移除手牌中第 N 次出现的指定 code(用于精确移除排序后手牌的某一张)
  const handleRemoveHandTile = (code: string, occurrence: number) => {
    let removed = 0;
    const next = handCodes.filter((c) => {
      if (c === code && removed === occurrence) { removed++; return false; }
      if (c === code) removed++;
      return true;
    });
    // 同步移除该 code 对应的选项(若存在)
    if (optionCodes.includes(code)) {
      setOptionCodes((prev) => prev.filter((c) => c !== code));
    }
    setHandCodes(next);
    setErrors([]);
  };

  // 校验
  const validate = (): string[] => {
    const errs: string[] = [];
    if (handCodes.length !== 14) errs.push(`手牌必须 14 张(当前 ${handCodes.length})`);
    const counts: Record<string, number> = {};
    let hz = 0;
    for (const c of handCodes) {
      counts[c] = (counts[c] || 0) + 1;
      if (counts[c] > 4) errs.push(`牌 ${c} 超过 4 张`);
      if (c === 'z5') hz++;
    }
    if (hz > 4) errs.push(`红中超过 4 张 (${hz})`);
    if (meldCount < 0 || meldCount > 4) errs.push('副露数必须在 0-4');
    if (!question.trim()) errs.push('问题文字不能为空');
    if (optionCodes.length !== 4) errs.push('选项必须 4 张');
    else if (new Set(optionCodes).size !== 4) errs.push('选项不能重复');
    for (const c of optionCodes) {
      if (!handCodes.includes(c)) errs.push(`选项 ${c} 不在手牌中`);
    }
    if (answerIndex < 0 || answerIndex > 3) errs.push('答案索引无效');
    if (!explanation.trim()) errs.push('解析不能为空');
    if (errs.length === 0 && handCodes.length === 14) {
      if (canWin(buildHandFromCodes(handCodes), meldCount)) {
        errs.push('手牌已胡,无效题目');
      }
    }
    return errs;
  };

  const handleValidate = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length === 0) alert('✅ 校验通过');
  };

  const handleSave = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    const now = Date.now();
    const q: QuizQuestion = {
      id: existing?.id ?? generateCustomId(),
      category,
      difficulty,
      handCodes: [...handCodes],
      meldCount,
      question,
      optionCodes: [...optionCodes],
      answerIndex,
      explanation,
      discardsPool: discardsPool.length > 0 ? discardsPool : undefined,
      version: 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    updateCustomQuestion(q);
    onSaved(q);
  };

  const handlePreview = () => {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    const q: QuizQuestion = {
      id: existing?.id ?? 'preview',
      category,
      difficulty,
      handCodes: [...handCodes],
      meldCount,
      question,
      optionCodes: [...optionCodes],
      answerIndex,
      explanation,
      discardsPool: discardsPool.length > 0 ? discardsPool : undefined,
      version: 1,
    };
    onPreview(q);
  };

  return (
    <div className="custom-editor">
      <div className="quiz-home-header">
        <h2>{existing ? '✏️ 编辑题目' : '➕ 新建题目'}</h2>
        <button className="quiz-back-btn" onClick={onCancel}>← 取消</button>
      </div>

      {errors.length > 0 && (
        <div className="editor-errors">
          <div>⚠️ 校验错误 ({errors.length}):</div>
          <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {/* 字段 1: 类别 */}
      <div className="editor-field">
        <label className="editor-label">1. 题目类别</label>
        <select className="editor-select" value={category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="自定义">自定义</option>
        </select>
      </div>

      {/* 字段 2: 难度 */}
      <div className="editor-field">
        <label className="editor-label">2. 难度</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
            <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" checked={difficulty === d} onChange={() => setDifficulty(d)} />
              <span className={`difficulty-tag ${d}`}>{d}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 字段 3: 手牌构造器 */}
      <div className="editor-field">
        <label className="editor-label">3. 手牌构造器 (当前 {handCodes.length}/14)</label>
        <div className="tile-pool">
          {ROWS.map((row) => (
            <div key={row.label} className="tile-pool-row">
              <span style={{ width: 24, fontSize: 13, color: 'var(--gold)', alignSelf: 'flex-end', marginRight: 4 }}>{row.label}</span>
              {row.codes.map((code) => {
                const cnt = poolCounts[code];
                const disabled = cnt <= 0 || handFull;
                return (
                  <div
                    key={code}
                    className={`tile-pool-item ${disabled ? 'disabled' : ''}`}
                    onClick={() => !disabled && handlePoolClick(code)}
                  >
                    <Tile tile={buildHandFromCodes([code])[0]} size={28} />
                    <div className={`tile-pool-count ${cnt === 0 ? 'zero' : ''}`}>{cnt}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="quiz-toolbar-btn" onClick={handleAutoFill}>🎲 自动填充随机</button>
          <button className="quiz-toolbar-btn" onClick={handleClearHand}>🗑 清空手牌</button>
        </div>
        <div className="simulator-hand" style={{ marginTop: 8 }}>
          {sortedHandTiles.length === 0 ? (
            <span className="simulator-hand-empty">手牌(0张) - 点击上方牌池添加</span>
          ) : (
            sortedHandTiles.map((t, i) => {
              const code = tileCode(t);
              const optIdx = optionCodes.indexOf(code);
              const isOption = optIdx >= 0;
              // 找到该牌在手牌(排序前)中是第几次出现
              let occurrence = 0;
              for (let j = 0; j < i; j++) {
                if (tileCode(sortedHandTiles[j]) === code) occurrence++;
              }
              return (
                <div
                  key={i}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  onClick={() => {
                    if (optionMode === 'manual') {
                      handleManualOptionClick(code);
                    } else {
                      handleRemoveHandTile(code, occurrence);
                    }
                  }}
                  title={optionMode === 'manual' ? (isOption ? '点击移除选项' : '点击添加为选项') : '点击移除手牌'}
                >
                  <Tile tile={t} size={32} />
                  {isOption && (
                    <span style={{
                      position: 'absolute', top: -8, right: -4,
                      background: 'var(--gold)', color: '#1a1208',
                      fontSize: 10, fontWeight: 700, padding: '1px 5px',
                      borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none'
                    }}>
                      {['A', 'B', 'C', 'D'][optIdx]}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        {optionMode === 'manual' && handCodes.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>
            提示: 手动选择模式,点击手牌可加入/移除选项(A/B/C/D 按加入顺序);切回自动模式才能点击手牌移除
          </div>
        )}
        {optionMode === 'auto' && handCodes.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            提示: 点击手牌可移除
          </div>
        )}
      </div>

      {/* 字段 4: 副露数 */}
      <div className="editor-field">
        <label className="editor-label">4. 副露数 (0-4)</label>
        <input
          className="editor-input"
          type="number"
          min={0}
          max={4}
          value={meldCount}
          onChange={(e) => setMeldCount(Math.max(0, Math.min(4, parseInt(e.target.value) || 0)))}
          style={{ width: 100 }}
        />
      </div>

      {/* 字段 5: 问题文字 */}
      <div className="editor-field">
        <label className="editor-label">5. 问题文字</label>
        <textarea
          className="editor-textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      {/* 字段 6: 选项 */}
      <div className="editor-field">
        <label className="editor-label">6. 选项 A/B/C/D</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            className={`quiz-toolbar-btn ${optionMode === 'auto' ? 'primary' : ''}`}
            onClick={() => setOptionMode('auto')}
          >自动生成模式</button>
          <button
            className={`quiz-toolbar-btn ${optionMode === 'manual' ? 'primary' : ''}`}
            onClick={() => setOptionMode('manual')}
          >手动选择模式</button>
          {optionMode === 'auto' && (
            <button className="quiz-toolbar-btn" onClick={handleAutoOptions}>🤖 自动生成选项</button>
          )}
        </div>
        {optionMode === 'manual' && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
            点击上方手牌区的牌作为选项(共选 4 张,已选 {optionCodes.length}/4)
          </div>
        )}
        <div className="editor-options">
          {['A', 'B', 'C', 'D'].map((letter, i) => {
            const code = optionCodes[i];
            const isBest = i === answerIndex;
            return (
              <div key={letter} className="editor-option-tile">
                <div className={`editor-option-letter ${isBest ? 'best' : ''}`}>{letter}{isBest ? ' ★' : ''}</div>
                {code ? <Tile tile={buildHandFromCodes([code])[0]} size={32} /> : <div style={{ width: 32, height: 45 }} />}
                {code && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{code}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* 字段 7: 正确答案 */}
      <div className="editor-field">
        <label className="editor-label">7. 正确答案</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['A', 'B', 'C', 'D'].map((letter, i) => (
            <label key={letter} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                checked={answerIndex === i}
                onChange={() => setAnswerIndex(i as 0 | 1 | 2 | 3)}
              />
              <span>{letter}</span>
            </label>
          ))}
          <button className="quiz-toolbar-btn" onClick={handleAutoAnswer}>🤖 自动判定答案</button>
        </div>
      </div>

      {/* 字段 8: 解析 */}
      <div className="editor-field">
        <label className="editor-label">8. 详细解析</label>
        <textarea
          className="editor-textarea"
          style={{ minHeight: 100 }}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="支持多行文本..."
        />
        <button className="quiz-toolbar-btn" style={{ marginTop: 4 }} onClick={handleAutoExplain}>🤖 自动生成解析</button>
      </div>

      {/* 字段 9: 已见弃牌池(可选) */}
      <div className="editor-field">
        <label className="editor-label">9. 已见弃牌池(可选,点击牌池添加,再次点击移除)</label>
        <div className="tile-pool" style={{ padding: 8 }}>
          {ROWS.map((row) => (
            <div key={row.label} className="tile-pool-row">
              <span style={{ width: 24, fontSize: 13, color: 'var(--gold)', alignSelf: 'flex-end', marginRight: 4 }}>{row.label}</span>
              {row.codes.map((code) => {
                const isSelected = discardsPool.includes(code);
                return (
                  <div
                    key={code}
                    className="tile-pool-item"
                    style={{ opacity: isSelected ? 1 : 0.6 }}
                    onClick={() => {
                      setDiscardsPool((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
                    }}
                  >
                    <Tile tile={buildHandFromCodes([code])[0]} size={22} />
                    <div className="tile-pool-count" style={{ color: isSelected ? '#fff' : 'var(--gold)' }}>
                      {isSelected ? '✓' : '+'}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {discardsPool.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            已选 {discardsPool.length} 张弃牌
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="editor-btn-group">
        <button className="quiz-toolbar-btn" onClick={handleValidate}>🔍 校验</button>
        <button className="quiz-toolbar-btn" onClick={onCancel}>❌ 取消</button>
        <button className="quiz-toolbar-btn" onClick={handlePreview}>👁 预览</button>
        <button className="quiz-toolbar-btn primary" onClick={handleSave}>✅ 保存</button>
      </div>
    </div>
  );
}
