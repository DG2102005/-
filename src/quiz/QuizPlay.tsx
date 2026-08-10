// 题目作答页(核心)
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QuizQuestion, QuizProgress } from '../game/quizTypes';
import type { ScenarioAnalysis } from '../game/types';
import { Tile } from '../components/Tile';
import { SmartAnalysisPanel } from '../components/SmartAnalysisPanel';
import { analysisFromHandCodes, buildHandFromCodes, codeToIndex } from '../game/advisor';
import { sortHand } from '../game/sort';
import { tileCode, tileName, indexToTile, isHongZhong } from '../game/types';
import { loadProgress, saveProgress } from './storage';

interface Props {
  questions: QuizQuestion[];
  startIndex?: number;
  mode?: string;
  onBack: () => void;
  preview?: boolean; // 预览模式: 不保存进度
}

export function QuizPlay({ questions, startIndex = 0, mode = 'default', onBack, preview = false }: Props) {
  const [qIndex, setQIndex] = useState(startIndex);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);
  const [progress, setProgress] = useState<QuizProgress>(() => preview ? createEmptyProgress() : loadProgress());

  const q = questions[qIndex];

  // 排序手牌
  const sortedHand = useMemo(() => {
    if (!q) return [];
    return sortHand(buildHandFromCodes(q.handCodes));
  }, [q]);

  // 重置状态当题目变化
  useEffect(() => {
    setSelectedOption(null);
    setAnswered(false);
    setShowModal(false);
    setShowAnalysis(false);
    setAnalysis(null);
  }, [qIndex]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showModal && e.key === 'Escape') { setShowModal(false); return; }
      if (showModal) return;
      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        const idx = parseInt(e.key) - 1;
        if (!answered && idx < q.optionCodes.length) handleSelectOption(idx);
      }
      if (e.key === 'Enter' && answered) goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answered, showModal, qIndex, q]);

  const handleSelectOption = useCallback((idx: number) => {
    if (answered || !q) return;
    setSelectedOption(idx);
    setAnswered(true);
    setShowModal(true);

    if (!preview) {
      const isCorrect = idx === q.answerIndex;
      const newProgress = { ...progress };
      if (!newProgress.answeredIds.includes(q.id)) {
        newProgress.answeredIds.push(q.id);
      }
      if (isCorrect) {
        if (!newProgress.correctIds.includes(q.id)) newProgress.correctIds.push(q.id);
        newProgress.wrongIds = newProgress.wrongIds.filter((id) => id !== q.id);
      } else {
        if (!newProgress.wrongIds.includes(q.id)) newProgress.wrongIds.push(q.id);
        newProgress.correctIds = newProgress.correctIds.filter((id) => id !== q.id);
      }
      // 更新类别统计
      const cat = q.category;
      if (!newProgress.statsByCategory[cat]) {
        newProgress.statsByCategory[cat] = { correct: 0, answered: 0 };
      }
      // 重新计算该类别统计
      const catQuestions = questions.filter((qq) => qq.category === cat);
      const catAnswered = catQuestions.filter((qq) => newProgress.answeredIds.includes(qq.id));
      const catCorrect = catAnswered.filter((qq) => newProgress.correctIds.includes(qq.id));
      newProgress.statsByCategory[cat] = { correct: catCorrect.length, answered: catAnswered.length };

      newProgress.currentIndex = qIndex;
      newProgress.mode = mode;
      setProgress(newProgress);
      saveProgress(newProgress);
    }
  }, [answered, q, qIndex, progress, preview, questions, mode]);

  const handleAnalysis = useCallback(() => {
    if (!q) return;
    const result = analysisFromHandCodes(q.handCodes, q.meldCount, q.discardsPool);
    setAnalysis(result);
    setShowAnalysis(true);
  }, [q]);

  const toggleFavorite = useCallback(() => {
    if (!q || preview) return;
    const newProgress = { ...progress };
    if (newProgress.favoriteIds.includes(q.id)) {
      newProgress.favoriteIds = newProgress.favoriteIds.filter((id) => id !== q.id);
    } else {
      newProgress.favoriteIds.push(q.id);
    }
    setProgress(newProgress);
    saveProgress(newProgress);
  }, [q, progress, preview]);

  const goNext = useCallback(() => {
    if (qIndex < questions.length - 1) setQIndex(qIndex + 1);
  }, [qIndex, questions.length]);

  const goPrev = useCallback(() => {
    if (qIndex > 0) setQIndex(qIndex - 1);
  }, [qIndex]);

  if (!q) {
    return <div className="empty-state">暂无题目</div>;
  }

  const correctCount = preview ? 0 : progress.correctIds.filter((id) => questions.some(qq => qq.id === id)).length;
  const answeredCount = preview ? 0 : progress.answeredIds.filter((id) => questions.some(qq => qq.id === id)).length;
  const isFavorite = preview ? false : progress.favoriteIds.includes(q.id);
  const isCorrect = selectedOption === q.answerIndex;

  return (
    <div className="quiz-play">
      {/* 顶部 */}
      <div className="quiz-play-header">
        <button className="quiz-back-btn" onClick={onBack}>← 选关</button>
        <span className="quiz-progress-text">第 <b>{qIndex + 1}</b> / {questions.length} 关</span>
        <button className={`quiz-fav-btn ${isFavorite ? 'active' : ''}`} onClick={toggleFavorite}>
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      {/* 手牌区 */}
      <div className="quiz-hand-area">
        {sortedHand.map((t, i) => (
          <Tile key={i} tile={t} size={40} />
        ))}
      </div>

      {/* 问题文字 */}
      <div className="quiz-question-text">{q.question}</div>

      {/* 类别/难度标签 */}
      <div className="question-meta">
        <span className="category-badge" data-cat={q.category}>
          {q.category === 'ting' ? '听牌判断' : '出牌决策'}
        </span>
        <span className="diff-badge" data-diff={q.difficulty ?? 'medium'}>
          {(q.difficulty ?? 'medium') === 'easy' ? '★' : (q.difficulty ?? 'medium') === 'hard' ? '★★★' : '★★'}
        </span>
      </div>

      {/* 选项区 */}
      <div className="quiz-options">
        {q.optionCodes.map((code, i) => {
          const tile = buildHandFromCodes([code])[0];
          const letter = ['A', 'B', 'C', 'D'][i];
          const showCorrect = answered && i === q.answerIndex;
          const showWrong = answered && i === selectedOption && i !== q.answerIndex;
          return (
            <div
              key={i}
              className={`quiz-option ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''} ${answered ? 'disabled' : ''}`}
              onClick={() => handleSelectOption(i)}
            >
              <div className="quiz-option-letter">{letter}</div>
              <Tile tile={tile} size={44} />
            </div>
          );
        })}
      </div>

      {/* 解析 */}
      {answered && (
        <div className="quiz-explanation">
          <div className="quiz-explanation-title">📖 详细解析</div>
          <div className="quiz-explanation-text">{q.explanation}</div>
        </div>
      )}

      {/* 底部工具栏 */}
      <div className="quiz-toolbar">
        <div className="quiz-toolbar-left">
          <span className="quiz-toolbar-score">答对 <b>{correctCount}</b> / {answeredCount}</span>
        </div>
        <div className="quiz-toolbar-right">
          <button className="quiz-toolbar-btn" onClick={handleAnalysis}>🧭 分析</button>
          <button className="quiz-toolbar-btn" onClick={goPrev} disabled={qIndex === 0}>← 上一题</button>
          <button className="quiz-toolbar-btn primary" onClick={goNext} disabled={qIndex >= questions.length - 1}>下一题 →</button>
        </div>
      </div>

      {/* 答题结果弹窗 */}
      {showModal && (
        <div className="quiz-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
            <div className="quiz-modal-icon">{isCorrect ? '✅' : '❌'}</div>
            <div className={`quiz-modal-title ${isCorrect ? 'correct' : 'wrong'}`}>
              {isCorrect ? '回答正确' : '回答错误'}
            </div>
            {!isCorrect && (
              <div className="quiz-modal-body">
                正确答案是 {['A', 'B', 'C', 'D'][q.answerIndex]} ({q.optionCodes[q.answerIndex]})
              </div>
            )}
            <button className="quiz-modal-btn" onClick={() => setShowModal(false)}>关闭</button>
          </div>
        </div>
      )}

      {/* 分析面板 */}
      {showAnalysis && analysis && (
        <div className="quiz-analysis-overlay" onClick={() => setShowAnalysis(false)}>
          <div onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <SmartAnalysisPanel
              analysis={analysis}
              onClose={() => setShowAnalysis(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function createEmptyProgress(): QuizProgress {
  return {
    answeredIds: [],
    correctIds: [],
    wrongIds: [],
    favoriteIds: [],
    mode: 'preview',
    currentIndex: 0,
    statsByCategory: {},
    updatedAt: 0,
  };
}
