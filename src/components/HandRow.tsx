// 手牌区域(人类玩家)
// 特性: 新摸的牌置最右并高亮; 建议打出的牌以特殊样式提示; 所有牌紧密排列
import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

interface Props {
  hand: TileType[];
  onDiscard: (tileId: number) => void;
  interactive: boolean;
  showLabel?: boolean;
  drawnTileId?: number | null;        // 新摸的牌(高亮)
  recommendTileId?: number | null;    // 建议打出的牌(标记)
}

export function HandRow({
  hand, onDiscard, interactive, showLabel, drawnTileId, recommendTileId,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleClick = (tileId: number) => {
    if (!interactive) return;
    if (selected === tileId) {
      onDiscard(tileId);
      setSelected(null);
    } else {
      setSelected(tileId);
    }
  };

  return (
    <div className="hand-row">
      {hand.map((t, i) => {
        const isDrawn = drawnTileId != null && t.id === drawnTileId;
        const isRec = recommendTileId != null && t.id === recommendTileId;
        // 所有牌紧密排列(无牌组间隔), 依靠 sortHand 已排序自然形成牌组
        return (
          <div key={t.id} className="tile-slot">
            <Tile
              tile={t}
              size={46}
              selected={selected === t.id}
              onClick={() => handleClick(t.id)}
              showLabel={showLabel}
              highlight={isDrawn}
            />
            {isRec && <span className="rec-mark" title="建议打出">荐</span>}
            {isDrawn && <span className="drawn-mark" title="新摸">新</span>}
          </div>
        );
      })}
      {interactive && (
        <div className="hand-hint">
          {selected !== null ? '再次点击确认出牌' : '点击选择要打出的牌'}
        </div>
      )}
    </div>
  );
}
