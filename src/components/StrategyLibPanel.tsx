// 策略库管理面板: 查看内置/用户案例, 上传/导入案例, 导出
import { useState, useEffect } from 'react';
import type { StrategyCase } from '../game/strategyLib';
import {
  loadStrategyLib, saveUserCase, deleteUserCase, importCases, exportCases,
} from '../game/strategyLib';

export function StrategyLibPanel() {
  const [cases, setCases] = useState<StrategyCase[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');

  // 新增表单(简化版, 高级条件可JSON导入)
  const [name, setName] = useState('');
  const [tip, setTip] = useState('');
  const [category, setCategory] = useState('用户案例');
  const [phase, setPhase] = useState<'early' | 'mid' | 'late'>('mid');
  const [priority, setPriority] = useState(6);
  const [hongZhongMin, setHongZhongMin] = useState(0);
  const [pairCountMin, setPairCountMin] = useState(0);
  const [recommendType, setRecommendType] = useState<StrategyCase['recommendType']>('keep');

  const refresh = () => setCases(loadStrategyLib());
  useEffect(() => { refresh(); }, []);

  const handleAdd = () => {
    if (!name.trim() || !tip.trim()) { setMsg('名称与说明必填'); return; }
    saveUserCase({
      name, tip, category, priority, recommendType,
      conditions: {
        phase,
        hongZhongMin: hongZhongMin > 0 ? hongZhongMin : undefined,
        pairCountMin: pairCountMin > 0 ? pairCountMin : undefined,
      },
    });
    setName(''); setTip(''); setCategory('用户案例'); setPriority(6);
    setHongZhongMin(0); setPairCountMin(0); setPhase('mid'); setRecommendType('keep');
    setMsg('已添加案例');
    refresh();
  };

  const handleImport = () => {
    if (!importText.trim()) { setMsg('请粘贴JSON'); return; }
    const r = importCases(importText);
    setMsg(`导入完成: 成功${r.ok}条 失败${r.fail}条`);
    setImportText('');
    refresh();
  };

  const handleExport = () => {
    const text = exportCases();
    navigator.clipboard?.writeText(text);
    setMsg('已复制全部策略到剪贴板');
  };

  const handleDelete = (id: string) => {
    deleteUserCase(id);
    refresh();
  };

  const userCases = cases.filter((c) => c.source === 'user');
  const builtinCases = cases.filter((c) => c.source === 'builtin');

  // 按分类分组内置策略
  const builtinByCategory: Record<string, StrategyCase[]> = {};
  for (const c of builtinCases) {
    const cat = c.category || '其他';
    if (!builtinByCategory[cat]) builtinByCategory[cat] = [];
    builtinByCategory[cat].push(c);
  }

  return (
    <div className="strategy-panel">
      <div className="strategy-title">📚 打法策略库</div>
      <div className="strategy-stats">
        内置 {builtinCases.length} 条 · 用户 {userCases.length} 条 · 共 {cases.length} 条
      </div>
      <div className="strategy-source">内置策略来源: 网络公开红中麻将专业文章提炼</div>

      <div className="strategy-actions">
        <button onClick={() => setShowAdd((s) => !s)}>{showAdd ? '收起' : '添加案例'}</button>
        <button onClick={handleExport}>导出全部</button>
      </div>

      {showAdd && (
        <div className="case-form">
          <input placeholder="案例名称" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="分类(如 红中运用/对子策略)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <select value={phase} onChange={(e) => setPhase(e.target.value as any)}>
            <option value="early">前期</option>
            <option value="mid">中期</option>
            <option value="late">后期</option>
          </select>
          <select value={recommendType} onChange={(e) => setRecommendType(e.target.value as any)}>
            <option value="keep">保留</option>
            <option value="discard">打出</option>
            <option value="peng">碰</option>
            <option value="gang">杠</option>
            <option value="wait">等待</option>
            <option value="hu">胡牌</option>
            <option value="defense">防守</option>
          </select>
          <label>优先级(1-10): <input type="number" min={1} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></label>
          <label>红中数≥: <input type="number" min={0} max={4} value={hongZhongMin} onChange={(e) => setHongZhongMin(Number(e.target.value))} /></label>
          <label>对子数≥: <input type="number" min={0} max={7} value={pairCountMin} onChange={(e) => setPairCountMin(Number(e.target.value))} /></label>
          <textarea placeholder="经验说明/打法要点" value={tip} onChange={(e) => setTip(e.target.value)} rows={2} />
          <button onClick={handleAdd}>保存</button>
        </div>
      )}

      <div className="strategy-import">
        <textarea
          placeholder="粘贴专家案例JSON批量导入(支持单条或数组,需含name/tip/conditions/priority等字段)"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={3}
        />
        <button onClick={handleImport}>导入</button>
      </div>

      {msg && <div className="strategy-msg">{msg}</div>}

      <div className="strategy-list">
        <div className="list-section">内置策略 (按分类)</div>
        {Object.entries(builtinByCategory).map(([cat, items]) => (
          <div key={cat} className="category-group">
            <div className="category-title">▸ {cat} ({items.length}条)</div>
            {items.map((c) => (
              <div className="case-item builtin" key={c.id}>
                <div className="case-head">
                  <span className="case-name">{c.name}</span>
                  <span className="case-phase">{phaseLabel(c.conditions.phase)}</span>
                  <span className="case-weight">优先级{c.priority}</span>
                </div>
                <div className="case-tip">{c.tip}</div>
              </div>
            ))}
          </div>
        ))}
        <div className="list-section">用户上传</div>
        {userCases.length === 0 && <div className="empty">暂无,点击"添加案例"上传</div>}
        {userCases.map((c) => (
          <div className="case-item user" key={c.id}>
            <div className="case-head">
              <span className="case-name">{c.name}</span>
              <span className="case-phase">{phaseLabel(c.conditions.phase)}</span>
              <span className="case-weight">优先级{c.priority}</span>
              <button className="del-btn" onClick={() => handleDelete(c.id)}>删除</button>
            </div>
            <div className="case-tip">{c.tip}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function phaseLabel(p: string): string {
  return p === 'early' ? '前期' : p === 'late' ? '后期' : '中期';
}
