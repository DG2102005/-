// 中央牌桌: 各家舍牌放在自己面前行式排布, 完整显示, 互不遮盖
import type { GameState, Seat } from '../game/types';
import { Tile } from './Tile';

interface Props {
  state: GameState;
  showLabel?: boolean;
}

const DISCARD_SIZE = 24; // 弃牌牌面宽(px)

// 各方位弃牌区: 行式排布, 行内不换行, 多行纵向堆叠
function DiscardZone({
  tiles,
  direction,
  highlightId,
  showLabel,
}: {
  tiles: { id: number; suit: string; rank: number }[];
  direction: 'top' | 'bottom' | 'left' | 'right';
  highlightId: number | null;
  showLabel?: boolean;
}) {
  if (tiles.length === 0) return <div className={`discard-zone discard-${direction} empty`} />;
  // 上下方位每行10张, 左右方位每行5张(窄区)
  const per = direction === 'left' || direction === 'right' ? 5 : 10;
  const rows: { id: number; suit: string; rank: number }[][] = [];
  for (let i = 0; i < tiles.length; i += per) {
    rows.push(tiles.slice(i, i + per));
  }
  return (
    <div className={`discard-zone discard-${direction}`}>
      {rows.map((row, ri) => (
        <div className={`discard-row discard-row-${direction}`} key={ri}>
          {row.map((t) => (
            <Tile
              key={t.id}
              tile={t as any}
              size={DISCARD_SIZE}
              highlight={t.id === highlightId}
              showLabel={showLabel}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CenterTable({ state, showLabel }: Props) {
  const lastId = state.lastDiscard?.tile.id ?? null;
  const lastSeat: Seat | null = state.lastDiscard?.seat ?? null;

  const zones: Record<Seat, typeof state.players[0]['discards']> = {
    0: state.players[0].discards,
    1: state.players[1].discards,
    2: state.players[2].discards,
    3: state.players[3].discards,
  };

  return (
    <div className="center-table">
      <div className="center-grid">
        {/* 北 (上) */}
        <div className="grid-top">
          <DiscardZone
            tiles={zones[3]}
            direction="top"
            highlightId={lastSeat === 3 ? lastId : null}
            showLabel={showLabel}
          />
        </div>
        {/* 中行: 西 | 中央 | 东 */}
        <div className="grid-middle">
          <div className="grid-left">
            <DiscardZone
              tiles={zones[2]}
              direction="left"
              highlightId={lastSeat === 2 ? lastId : null}
              showLabel={showLabel}
            />
          </div>
          <div className="grid-center">
            <div className="table-logo">
              <div className="logo-text">推倒胡</div>
              <div className="logo-sub">红中百搭</div>
            </div>
          </div>
          <div className="grid-right">
            <DiscardZone
              tiles={zones[0]}
              direction="right"
              highlightId={lastSeat === 0 ? lastId : null}
              showLabel={showLabel}
            />
          </div>
        </div>
        {/* 南 (下) */}
        <div className="grid-bottom">
          <DiscardZone
            tiles={zones[1]}
            direction="bottom"
            highlightId={lastSeat === 1 ? lastId : null}
            showLabel={showLabel}
          />
        </div>
      </div>
    </div>
  );
}
