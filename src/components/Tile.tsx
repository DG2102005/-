// 单张麻将牌组件
import { memo } from 'react';
import type { Tile as TileType } from '../game/types';
import { tileCode, isHongZhong } from '../game/types';
import { getTileUrl } from '../game/tileAssets';

interface Props {
  tile: TileType;
  size?: number;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  showLabel?: boolean; // 牌型校验模式: 显示牌名
  highlight?: boolean; // 高亮(最新打出)
}

function TileBase({ tile, size = 44, selected, disabled, onClick, showLabel, highlight }: Props) {
  const url = getTileUrl(tileCode(tile));
  const hz = isHongZhong(tile);
  const w = size;
  const h = Math.round(size * 1.4);
  return (
    <div
      className={`tile ${selected ? 'tile-selected' : ''} ${disabled ? 'tile-disabled' : ''} ${highlight ? 'tile-highlight' : ''} ${hz ? 'tile-hongzhong' : ''}`}
      style={{ width: w, height: h }}
      onClick={disabled ? undefined : onClick}
      title={showLabel ? undefined : undefined}
    >
      <img src={url} alt="" draggable={false} />
      {showLabel && <span className="tile-label">{tileCode(tile)}</span>}
      {highlight && <div className="tile-glow" />}
    </div>
  );
}

export const Tile = memo(TileBase);

// 牌背(CSS实现，绿色麻将背面)
export function TileBack({ size = 44 }: { size?: number }) {
  const w = size;
  const h = Math.round(size * 1.4);
  return (
    <div className="tile tile-back" style={{ width: w, height: h }}>
      <div className="tile-back-pattern" />
    </div>
  );
}
