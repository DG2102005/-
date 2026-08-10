// 类别/难度选择子页
import { useEffect, useMemo, useState } from 'react';
import { BUILTIN_QUESTIONS, loadBuiltinQuestions, onBuiltinQuestionsProgress } from './builtinQuestions';
import { CATEGORIES, DIFFICULTIES } from './QuizHome';
import { loadProgress } from './storage';
import type { QuizQuestion, QuizCategory, Difficulty } from '../game/quizTypes';

interface Props {
  selectKind: 'category' | 'difficulty';
  onBack: () => void;
  onStart: (questions: QuizQuestion[], mode: string) => void;
}

export function QuizCategorySelect({ selectKind, onBack, onStart }: Props) {
  const progress = useMemo(() => loadProgress(), []);

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    BUILTIN_QUESTIONS.length === 100 ? 'ready' : 'idle'
  );
  const [loadCount, setLoadCount] = useState(BUILTIN_QUESTIONS.length);

  useEffect(() => {
    if (BUILTIN_QUESTIONS.length === 100) {
      setLoadStatus('ready');
      setLoadCount(100);
      return;
    }
    setLoadStatus('loading');
    const unsub = onBuiltinQuestionsProgress(setLoadCount);
    loadBuiltinQuestions()
      .then(() => {
        setLoadCount(100);
        setLoadStatus('ready');
      })
      .catch((e) => {
        console.error('题库加载失败', e);
        setLoadStatus('error');
      });
    return () => { unsub(); };
  }, []);

  const handleSelect = (key: string, items: QuizQuestion[]) => {
    if (items.length === 0) {
      alert('该分类暂无题目');
      return;
    }
    onStart(items, selectKind === 'category' ? `category:${key}` : `difficulty:${key}`);
  };

  if (loadStatus === 'loading' || loadStatus === 'idle') {
    return (
      <div className="quiz-category-select">
        <div className="quiz-home-header">
          <h2>{selectKind === 'category' ? '🏷️ 选择类别' : '🎯 选择难度'}</h2>
          <button className="quiz-back-btn" onClick={onBack}>← 返回</button>
        </div>
        <div className="quiz-loading-container">
          <div className="quiz-loading-spinner">🀄</div>
          <div className="quiz-loading-title">题库生成中</div>
          <div className="quiz-loading-progress">
            已生成 <b>{loadCount}</b> / 100 题
          </div>
        </div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="quiz-category-select">
        <div className="quiz-home-header">
          <h2>{selectKind === 'category' ? '🏷️ 选择类别' : '🎯 选择难度'}</h2>
          <button className="quiz-back-btn" onClick={onBack}>← 返回</button>
        </div>
        <div className="quiz-loading-container">
          <div style={{fontSize: 48}}>❌</div>
          <div className="quiz-loading-title">题库加载失败</div>
          <button className="quiz-start-btn" onClick={() => window.location.reload()}>刷新页面重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-category-select">
      <div className="quiz-home-header">
        <h2>{selectKind === 'category' ? '🏷️ 选择类别' : '🎯 选择难度'}</h2>
        <button className="quiz-back-btn" onClick={onBack}>← 返回</button>
      </div>

      <div className="quiz-category-list">
        {selectKind === 'category'
          ? CATEGORIES.map((cat: QuizCategory) => {
              const items = BUILTIN_QUESTIONS.filter((q) => q.category === cat);
              const answered = items.filter((q) => progress.answeredIds.includes(q.id)).length;
              const correct = items.filter((q) => progress.correctIds.includes(q.id)).length;
              const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
              return (
                <div
                  key={cat}
                  className="quiz-category-item"
                  onClick={() => handleSelect(cat, items)}
                >
                  <div>
                    <div className="quiz-category-name">{cat}</div>
                    <div className="quiz-category-count">
                      总 {items.length} 题 · 已答 {answered} · 正确率 {acc}%
                    </div>
                  </div>
                  <div className="quiz-back-btn">开始 →</div>
                </div>
              );
            })
          : DIFFICULTIES.map((d: { value: Difficulty; label: string }) => {
              const items = BUILTIN_QUESTIONS.filter((q) => q.difficulty === d.value);
              const answered = items.filter((q) => progress.answeredIds.includes(q.id)).length;
              const correct = items.filter((q) => progress.correctIds.includes(q.id)).length;
              const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
              return (
                <div
                  key={d.value}
                  className="quiz-category-item"
                  onClick={() => handleSelect(d.value, items)}
                >
                  <div>
                    <div className="quiz-category-name">
                      <span className={`difficulty-tag ${d.value}`}>{d.value}</span> {d.label}
                    </div>
                    <div className="quiz-category-count">
                      总 {items.length} 题 · 已答 {answered} · 正确率 {acc}%
                    </div>
                  </div>
                  <div className="quiz-back-btn">开始 →</div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
