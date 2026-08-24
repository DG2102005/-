// 手牌区域(人类玩家)
// 特性:
//   - 牌的顺序保持不变, 按分解结果(blocks)分组, 组与组之间留间隔
//   - 分组优先级: 成牌 > 对子 > 搭子; 未能分解的散张原地不动
//   - 模式: 出牌(默认) / 分解(点击某张牌, 切换它与右侧相邻牌之间的间隔)
import { useEffect, useMemo, useState } from 'react';
import type { Tile as TileType, Meld } from '../game/types';
import { decomposeHand } from '../game/gameEngine';
import { Tile } from './Tile';

interface Props {
  hand: TileType[];
  onDiscard: (tileId: number) => void;
  interactive: boolean;
  drawnTileId?: number | null;   // 新摸的牌(高亮)
  melds?: Meld[];                // 副露(用于分解)
}

export function HandRow({
  hand, onDiscard, interactive, drawnTileId, melds = [],
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'play' | 'decompose'>('play');
  // 用户手动设置的间隔位置: 即"该下标处与其右侧相邻牌之间是否有间隔"
  // 数组长度 = hand.length-1, true=有间隔
  const [gaps, setGaps] = useState<boolean[] | null>(null);

  const auto = useMemo(() => decomposeHand(hand, melds), [hand, melds]);
  const handKey = hand.map((t) => t.id).join(',');

  // 由自动分解块推导默认间隔: 块之间插入间隔
  const autoGaps = useMemo(() => {
    const g: boolean[] = [];
    let lastTileIdx = -1;
    for (const b of auto.blocks) {
      const start = lastTileIdx + 1;
      const end = start + b.tiles.length - 1; // 该块最后一张牌的下标
      // 标记块之间(即该块最后一张牌右侧)有间隔, 但整个手牌最后一张后无间隔
      if (end < hand.length - 1) g[end] = true;
      lastTileIdx = end;
    }
    // 填充其余为 false
    for (let i = 0; i < hand.length - 1; i++) {
      if (g[i] === undefined) g[i] = false;
    }
    return g;
  }, [auto, hand.length]);

  // 手牌变化(摸/出牌)时重置
  useEffect(() => {
    setSelected(null);
    setMode('play');
    setGaps(null);
  }, [handKey]);

  const effectiveGaps = gaps ?? autoGaps;

  // 点击牌
  const handleClick = (t: TileType) => {
    if (mode === 'decompose') {
      // 分解模式: 切换该牌右侧的间隔
      const idx = hand.findIndex((x) => x.id === t.id);
      if (idx < 0 || idx >= hand.length - 1) return;
      setGaps((prev) => {
        const base = prev ?? autoGaps;
        const next = base.slice();
        next[idx] = !next[idx];
        return next;
      });
      return;
    }
    // 出牌模式
    if (!interactive) return;
    if (selected === t.id) {
      onDiscard(t.id);
      setSelected(null);
    } else {
      setSelected(t.id);
    }
  };

  // 按 gaps 渲染: 仅在分解模式下应用间隔, 默认(出牌模式)保持紧凑
  const showGaps = mode === 'decompose';
  return (
    <div className="hand-wrap">
      <div className="hand-row">
        {hand.map((t, i) => {
          const isDrawn = drawnTileId != null && t.id === drawnTileId;
          // 左侧是否有间隔 = 第 i-1 张与第 i 张之间(effectiveGaps[i-1]), 且处于分解模式
          const hasGapBefore = showGaps && i > 0 && effectiveGaps[i - 1];
          return (
            <span
              key={t.id}
              className={`tile-slot${hasGapBefore ? ' gap-before' : ''}`}
            >
              <Tile
                tile={t}
                size={46}
                selected={selected === t.id}
                onClick={() => handleClick(t)}
                highlight={isDrawn}
              />
              {isDrawn && <span className="drawn-mark" title="新摸">新</span>}
            </span>
          );
        })}
      </div>
      <div className="hand-toolbar">
        <span className="hand-hint">
          {mode === 'decompose'
            ? '分解模式: 点击牌切换间隔, 再点"分解牌型"关闭'
            : selected !== null ? '再次点击确认出牌' : '点击选择要打出的牌'}
        </span>
        <button
          className={`hand-mode-btn${mode === 'decompose' ? ' active' : ''}`}
          onClick={() => {
            setMode((m) => (m === 'play' ? 'decompose' : 'play'));
            if (mode === 'play') setGaps(null); // 进入分解时重置为自动
          }}
        >
          分解牌型
        </button>
      </div>
    </div>
  );
}
