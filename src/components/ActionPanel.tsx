// 操作面板: 碰/杠/胡/放弃 + 暗杠/补杠 + 抢杠
import type { ActionOption } from '../game/types';

interface Props {
  options: ActionOption[];
  mode: 'react' | 'self' | 'qianggang'; // react=他人出牌反应, self=自摸操作, qianggang=抢杠反应
  onChoose: (option: ActionOption) => void;
  onPass: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  peng: '碰',
  minggang: '明杠',
  angang: '暗杠',
  bugang: '补杠',
  hu: '自摸胡',
};

export function ActionPanel({ options, mode, onChoose, onPass }: Props) {
  if (options.length === 0) return null;
  // 去重(同类型只显示一个按钮)
  const seen = new Set<string>();
  const unique = options.filter((o) => {
    const k = o.type;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // self 模式下, 若包含 hu 选项(摸到能胡的牌), 也显示"放弃胡"按钮
  // 让玩家选择不胡继续打牌(可多次放弃后胡)
  const showSelfPass = mode === 'self' && options.some((o) => o.type === 'hu');

  return (
    <div className="action-panel">
      <div className="action-prompt">
        {mode === 'qianggang' ? '有人补杠,可抢杠胡:' : mode === 'react' ? '请选择操作:' : '可执行:'}
      </div>
      <div className="action-buttons">
        {unique.map((o, i) => (
          <button
            key={i}
            className={`action-btn action-${o.type}`}
            onClick={() => onChoose(o)}
          >
            {o.type === 'hu' && mode === 'qianggang' ? '抢杠胡' : ACTION_LABEL[o.type] || o.type}
          </button>
        ))}
        {(mode === 'react' || mode === 'qianggang' || showSelfPass) && (
          <button className="action-btn action-pass" onClick={onPass}>
            放弃
          </button>
        )}
      </div>
    </div>
  );
}
