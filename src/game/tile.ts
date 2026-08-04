// 牌库构建
import type { Tile, Suit } from './types';
import { TILE_TYPES, TILES_PER_TYPE } from './constants';

// 构建136张完整牌库(34种 × 4张)
export function buildDeck(): Tile[] {
  const deck: Tile[] = [];
  let id = 0;
  const suits: Suit[] = ['m', 'p', 's'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let n = 0; n < TILES_PER_TYPE; n++) {
        deck.push({ id: id++, suit, rank });
      }
    }
  }
  // 字牌 z1-z7
  for (let rank = 1; rank <= 7; rank++) {
    for (let n = 0; n < TILES_PER_TYPE; n++) {
      deck.push({ id: id++, suit: 'z', rank });
    }
  }
  return deck;
}

// 校验牌库完整性
export function validateDeck(deck: Tile[]): boolean {
  if (deck.length !== TILE_TYPES * TILES_PER_TYPE) return false;
  const counts: Record<string, number> = {};
  for (const t of deck) {
    const code = `${t.suit}${t.rank}`;
    counts[code] = (counts[code] || 0) + 1;
  }
  for (const k of Object.keys(counts)) {
    if (counts[k] !== TILES_PER_TYPE) return false;
  }
  return Object.keys(counts).length === TILE_TYPES;
}
