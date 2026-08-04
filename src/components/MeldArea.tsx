// 碰杠明牌区
import type { Meld } from '../game/types';
import { Tile } from './Tile';

interface Props {
  melds: Meld[];
  size?: number;
  showLabel?: boolean;
}

export function MeldArea({ melds, size = 32, showLabel }: Props) {
  if (melds.length === 0) return null;
  return (
    <div className="meld-area">
      {melds.map((m, i) => (
        <div className="meld" key={i} title={m.type}>
          {m.tiles.map((t, j) => (
            <Tile key={j} tile={t} size={size} showLabel={showLabel} />
          ))}
        </div>
      ))}
    </div>
  );
}
