// 自定义题库列表页
import { useMemo, useState } from 'react';
import { loadCustomQuestions, deleteCustomQuestion } from './storage';
import type { QuizQuestion } from '../game/quizTypes';
import { Tile } from '../components/Tile';
import { buildHandFromCodes } from '../game/advisor';
import { sortHand } from '../game/sort';

interface Props {
  onBack: () => void;
  onEdit: (q?: QuizQuestion) => void;
  onPractice: (questions: QuizQuestion[]) => void;
}

export function CustomList({ onBack, onEdit, onPractice }: Props) {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');

  const questions = useMemo(() => loadCustomQuestions(), [tick]);
  const filtered = useMemo(() => {
    if (!search.trim()) return questions;
    const s = search.toLowerCase();
    return questions.filter((q) =>
      q.id.toLowerCase().includes(s) ||
      q.category.toLowerCase().includes(s) ||
      (q.title || '').toLowerCase().includes(s) ||
      q.question.toLowerCase().includes(s)
    );
  }, [questions, search]);

  const handleDelete = (id: string) => {
    if (!confirm('确认删除该题目?此操作不可恢复。')) return;
    deleteCustomQuestion(id);
    setTick((t) => t + 1);
  };

  const handlePractice = (q: QuizQuestion) => {
    onPractice([q]);
  };

  return (
    <div className="custom-list">
      <div className="quiz-home-header">
        <h2>📝 自定义题库 ({questions.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="quiz-back-btn" onClick={onBack}>← 返回</button>
          <button
            className="quiz-back-btn"
            style={{ background: 'var(--gold)', color: '#1a1208', borderColor: 'var(--gold)' }}
            onClick={() => onEdit(undefined)}
          >
            ➕ 新建题目
          </button>
        </div>
      </div>

      <input
        className="custom-search"
        placeholder="🔍 按 id / 类别 / 题目关键词搜索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          {questions.length === 0 ? '暂无自定义题目,点击右上角"新建题目"开始创建' : '没有匹配的题目'}
        </div>
      ) : (
        <div className="custom-list-items">
          {filtered.map((q) => {
            const hand = sortHand(buildHandFromCodes(q.handCodes)).slice(0, 10);
            const answerCode = q.optionCodes[q.answerIndex];
            const created = q.createdAt ? new Date(q.createdAt).toLocaleString('zh-CN', { hour12: false }) : '';
            return (
              <div key={q.id} className="custom-list-item">
                <div className="custom-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="quiz-category-name" style={{ fontSize: 12, color: 'var(--gold)' }}>{q.id}</span>
                    <span className={`difficulty-tag ${q.difficulty}`}>{q.difficulty}</span>
                    <span className="difficulty-tag" style={{ background: '#444' }}>{q.category}</span>
                    {created && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{created}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                    {hand.map((t, i) => (
                      <Tile key={i} tile={t} size={20} />
                    ))}
                    {q.handCodes.length > 10 && (
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'flex-end', marginLeft: 4 }}>
                        +{q.handCodes.length - 10}张
                      </span>
                    )}
                  </div>
                  <div className="custom-item-question">{q.question}</div>
                  <div className="custom-item-meta">
                    <span>正确答案: <b style={{ color: 'var(--gold)' }}>{['A', 'B', 'C', 'D'][q.answerIndex]} ({answerCode})</b></span>
                  </div>
                </div>
                <div className="custom-item-actions">
                  <button className="custom-action-btn" onClick={() => handlePractice(q)}>练习</button>
                  <button className="custom-action-btn" onClick={() => onEdit(q)}>编辑</button>
                  <button className="custom-action-btn danger" onClick={() => handleDelete(q.id)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
