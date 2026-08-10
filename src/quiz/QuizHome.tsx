// 题库主页: 6 大模式 + 统计 + 自定义入口
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import {
  BUILTIN_QUESTIONS,
  loadBuiltinQuestions,
  clearBuiltinQuestions,
  setBuiltinQuestions,
} from './builtinQuestions';
import { loadProgress, loadCustomQuestions } from './storage';
import type { QuizQuestion, QuizCategory, Difficulty } from '../game/quizTypes';

type SubView =
  | { kind: 'home' }
  | { kind: 'play'; questions: QuizQuestion[]; mode: string }
  | { kind: 'categorySelect'; selectKind: 'category' | 'difficulty' }
  | { kind: 'customList' };

interface Props {
  onBack: () => void;
  onNavigate: (view: SubView) => void;
}

const CATEGORIES: QuizCategory[] = ['搭子取舍', '听牌选择', '红中运用', '对子处理', '金张判断', '综合复杂'];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: '入门 easy' },
  { value: 'medium', label: '进阶 medium' },
  { value: 'hard', label: '困难 hard' },
];

interface ModeCard {
  key: string;
  icon: string;
  title: string;
  desc: string;
  questions: QuizQuestion[];
  mode: string;
}

export function QuizHome({ onBack, onNavigate }: Props) {
  const progress = useMemo(() => loadProgress(), []);
  const customQuestions = useMemo(() => loadCustomQuestions(), []);

  // 题库默认已清空，由用户导入或手动加载示例
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    BUILTIN_QUESTIONS.length > 0 ? 'ready' : 'idle'
  );
  const [loadCount, setLoadCount] = useState(BUILTIN_QUESTIONS.length);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const allQuestions = BUILTIN_QUESTIONS;

  const refresh = () => {
    setLoadCount(BUILTIN_QUESTIONS.length);
    setLoadStatus(BUILTIN_QUESTIONS.length > 0 ? 'ready' : 'idle');
    setTick((t) => t + 1);
  };

  const handleLoadExample = async () => {
    setLoadStatus('loading');
    try {
      await loadBuiltinQuestions();
      refresh();
    } catch (e) {
      console.error('题库加载失败', e);
      setLoadStatus('error');
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(allQuestions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redcenter-quiz-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions) || questions.length === 0) {
          alert('文件格式错误或未找到题目数组');
          return;
        }
        setBuiltinQuestions(questions);
        refresh();
      } catch (err) {
        console.error(err);
        alert('JSON 解析失败，请检查文件格式');
      } finally {
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (!confirm('确定清空当前题库吗？此操作不可恢复。')) return;
    clearBuiltinQuestions();
    refresh();
  };

  // 统计
  const totalAnswered = progress.answeredIds.filter((id) => allQuestions.some((q) => q.id === id)).length;
  const totalCorrect = progress.correctIds.filter((id) => allQuestions.some((q) => q.id === id)).length;
  const totalWrong = progress.wrongIds.filter((id) => allQuestions.some((q) => q.id === id)).length;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const wrongQuestions = allQuestions.filter((q) => progress.wrongIds.includes(q.id));
  const favoriteQuestions = allQuestions.filter((q) => progress.favoriteIds.includes(q.id));

  // 6 大模式卡片
  const modes: ModeCard[] = [
    {
      key: 'order',
      icon: '📖',
      title: '顺序练习',
      desc: '从 q001 连续练习所有 100 题',
      questions: allQuestions,
      mode: 'order',
    },
    {
      key: 'category',
      icon: '🏷️',
      title: '分类练习',
      desc: '按类别选择: 搭子取舍 / 听牌选择 / 红中运用 / 对子处理 / 金张判断 / 综合复杂',
      questions: [],
      mode: 'category',
    },
    {
      key: 'difficulty',
      icon: '🎯',
      title: '难度练习',
      desc: '按难度: 入门 easy / 进阶 medium / 困难 hard',
      questions: [],
      mode: 'difficulty',
    },
    {
      key: 'random',
      icon: '🎲',
      title: '随机练习',
      desc: '乱序随机抽题 30 道',
      questions: shuffleAndTake(allQuestions, 30),
      mode: 'random',
    },
    {
      key: 'wrong',
      icon: '❌',
      title: '错题练习',
      desc: '仅显示你答错的题',
      questions: wrongQuestions,
      mode: 'wrong',
    },
    {
      key: 'favorite',
      icon: '⭐',
      title: '收藏夹练习',
      desc: '仅显示已收藏的题',
      questions: favoriteQuestions,
      mode: 'favorite',
    },
  ];

  const handleStart = (mode: ModeCard) => {
    if (mode.key === 'category') {
      onNavigate({ kind: 'categorySelect', selectKind: 'category' });
      return;
    }
    if (mode.key === 'difficulty') {
      onNavigate({ kind: 'categorySelect', selectKind: 'difficulty' });
      return;
    }
    if (mode.questions.length === 0) {
      alert(mode.key === 'wrong' ? '暂无错题,继续练习吧!' : mode.key === 'favorite' ? '暂无收藏,先收藏一些题目吧!' : '暂无题目');
      return;
    }
    onNavigate({ kind: 'play', questions: mode.questions, mode: mode.mode });
  };

  // 题库为空时的引导页
  if (loadStatus === 'idle') {
    return (
      <div className="quiz-home">
        <div className="quiz-home-header">
          <h2>🀄 红中麻将题库训练</h2>
          <button className="quiz-back-btn" onClick={onBack}>← 返回对弈</button>
        </div>
        <div className="quiz-loading-container" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>📂</div>
          <div className="quiz-loading-title">题库为空</div>
          <div className="quiz-loading-desc">
            当前未加载任何题目。你可以导入自己的题库 JSON，或加载示例题库开始练习。
          </div>
          <div className="quiz-empty-actions">
            <button className="quiz-start-btn" onClick={() => fileRef.current?.click()}>📤 导入题库(JSON)</button>
            <button className="quiz-start-btn" onClick={handleLoadExample}>📚 加载示例题库</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImport} />
          <div className="quiz-custom-entry" onClick={() => onNavigate({ kind: 'customList' })} style={{ marginTop: 20 }}>
            <div>
              <div className="quiz-custom-entry-title">📝 自定义题库</div>
              <div className="quiz-custom-entry-desc">进入自定义题库管理 · 当前共 {customQuestions.length} 道</div>
            </div>
            <div className="quiz-back-btn">进入 →</div>
          </div>
        </div>
      </div>
    );
  }

  // 加载示例题库中
  if (loadStatus === 'loading') {
    return (
      <div className="quiz-home">
        <div className="quiz-home-header">
          <h2>🀄 红中麻将题库训练</h2>
          <button className="quiz-back-btn" onClick={onBack}>← 返回对弈</button>
        </div>
        <div className="quiz-loading-container">
          <div className="quiz-loading-spinner">🀄</div>
          <div className="quiz-loading-title">示例题库生成中</div>
          <div className="quiz-loading-desc">正在生成精选题目，请稍候…</div>
          <div className="quiz-loading-progress">已生成 <b>{loadCount}</b> 题</div>
        </div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="quiz-home">
        <div className="quiz-home-header">
          <h2>🀄 红中麻将题库训练</h2>
          <button className="quiz-back-btn" onClick={onBack}>← 返回对弈</button>
        </div>
        <div className="quiz-loading-container">
          <div style={{fontSize: 48}}>❌</div>
          <div className="quiz-loading-title">题库加载失败</div>
          <button className="quiz-start-btn" onClick={handleLoadExample}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-home">
      <div className="quiz-home-header">
        <h2>🀄 红中麻将题库训练</h2>
        <button className="quiz-back-btn" onClick={onBack}>← 返回对弈</button>
      </div>

      {/* 题库管理工具栏 */}
      <div className="quiz-manage-bar">
        <button className="quiz-toolbar-btn" onClick={() => fileRef.current?.click()}>📤 导入题库</button>
        <button className="quiz-toolbar-btn" onClick={handleExport}>📥 导出当前题库</button>
        <button className="quiz-toolbar-btn" onClick={handleClear}>🗑️ 清空题库</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      {/* 统计面板 */}
      <div className="quiz-stats-panel">
        <div className="quiz-stat-card">
          <div className="quiz-stat-value">{totalAnswered}</div>
          <div className="quiz-stat-label">已答题数</div>
        </div>
        <div className="quiz-stat-card">
          <div className="quiz-stat-value">{accuracy}%</div>
          <div className="quiz-stat-label">正确率</div>
        </div>
        <div className="quiz-stat-card">
          <div className="quiz-stat-value">{totalWrong}</div>
          <div className="quiz-stat-label">错题数</div>
        </div>
        <div className="quiz-stat-card">
          <div className="quiz-stat-value">{favoriteQuestions.length}</div>
          <div className="quiz-stat-label">收藏数</div>
        </div>
      </div>

      {/* 模式卡片网格 */}
      <div className="quiz-mode-grid">
        {modes.map((m) => {
          const total = m.questions.length;
          const answered = m.questions.filter((q) => progress.answeredIds.includes(q.id)).length;
          const correct = m.questions.filter((q) => progress.correctIds.includes(q.id)).length;
          const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
          const isSelect = m.key === 'category' || m.key === 'difficulty';
          const totalDisplay = isSelect ? `${allQuestions.length}` : `${total}`;
          return (
            <div key={m.key} className="quiz-mode-card" onClick={() => handleStart(m)}>
              <div className="quiz-mode-icon">{m.icon}</div>
              <div className="quiz-mode-title">{m.title}</div>
              <div className="quiz-mode-desc">{m.desc}</div>
              <div className="quiz-mode-meta">
                <span>总题: <b>{totalDisplay}</b></span>
                <span>已答: <b>{answered}</b></span>
                <span>正确率: <b>{acc}%</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 自定义题库入口 */}
      <div className="quiz-custom-entry" onClick={() => onNavigate({ kind: 'customList' })}>
        <div>
          <div className="quiz-custom-entry-title">📝 自定义题库</div>
          <div className="quiz-custom-entry-desc">
            创建、编辑、练习你自己的题目 · 当前共 {customQuestions.length} 道
          </div>
        </div>
        <div className="quiz-back-btn">进入 →</div>
      </div>
    </div>
  );
}

function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export { CATEGORIES, DIFFICULTIES };
