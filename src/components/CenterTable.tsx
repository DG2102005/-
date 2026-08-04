// 中央牌桌: 四家打出的牌按方位汇聚显示，模拟现实牌桌
import type { GameState, Seat } from '../game/types';
import { Tile } from './Tile';

interface Props {
  state: GameState;
  showLabel?: boolean;
}

// 各方位弃牌区
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
  // 每行6张
  const rows: { id: number; suit: string; rank: number }[][] = [];
  for (let i = 0; i < tiles.length; i += 6) {
    rows.push(tiles.slice(i, i + 6));
  }
  return (
    <div className={`discard-zone discard-${direction}`}>
      {rows.map((row, ri) => (
        <div className="discard-row" key={ri}>
          {row.map((t) => (
            <Tile
              key={t.id}
              tile={t as any}
              size={26}
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
