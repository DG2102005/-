// 日志面板
import { useState } from 'react';
import type { GameState } from '../game/types';
import { formatLog, exportLog } from '../game/logger';

interface Props {
  state: GameState;
}

export function LogPanel({ state }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const logs = state.log;
  const recent = collapsed ? logs.slice(-8) : logs;

  const handleCopy = () => {
    const text = exportLog(state);
    navigator.clipboard?.writeText(text);
  };

  return (
    <div className="log-panel">
      <div className="log-header">
        <span>对局日志 ({logs.length})</span>
        <div className="log-controls">
          <button onClick={() => setCollapsed((c) => !c)}>{collapsed ? '展开' : '收起'}</button>
          <button onClick={handleCopy}>复制</button>
        </div>
      </div>
      <div className="log-list">
        {recent.map((e) => (
          <div className="log-line" key={e.time}>{formatLog(e)}</div>
        ))}
        {logs.length === 0 && <div className="log-empty">暂无日志</div>}
      </div>
    </div>
  );
}
