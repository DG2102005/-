// 手牌区域(人类玩家)
// 特性: 新摸的牌置最右并高亮; 所有牌紧密排列
import { useState } from 'react';
import type { Tile as TileType } from '../game/types';
import { Tile } from './Tile';

interface Props {
  hand: TileType[];
  onDiscard: (tileId: number) => void;
  interactive: boolean;
  drawnTileId?: number | null;        // 新摸的牌(高亮)
}

export function HandRow({
  hand, onDiscard, interactive, drawnTileId,
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
      {hand.map((t) => {
        const isDrawn = drawnTileId != null && t.id === drawnTileId;
        return (
          <div key={t.id} className="tile-slot">
            <Tile
              tile={t}
              size={46}
              selected={selected === t.id}
              onClick={() => handleClick(t.id)}
              highlight={isDrawn}
            />
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
