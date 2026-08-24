// 对弈牌局收藏(复盘/演绎)
// 收藏一局结束后的完整 GameState(含 history 栈), 供复盘回放与手动演绎
import type { GameState } from './types';
import { SEAT_NAME } from './types';

const KEY_SAVED = 'redcenter.savedRounds';
const MAX_SAVED = 20;

export interface SavedRound {
  id: string;            // 唯一 id
  round: number;         // 局号
  savedAt: number;       // 收藏时间戳
  resultLabel: string;   // 结果描述(如"东胡牌"/"流局")
  state: GameState;      // 终局完整状态(含 history 栈)
}

function readSaved(): SavedRound[] {
  try {
    const raw = localStorage.getItem(KEY_SAVED);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRound[];
  } catch {
    return [];
  }
}

function writeSaved(list: SavedRound[]): boolean {
  try {
    localStorage.setItem(KEY_SAVED, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// 收藏当前终局
export function saveRound(state: GameState): SavedRound | null {
  if (state.phase !== 'gameover' || state.players.length === 0) return null;
  const label = state.isDraw
    ? '流局'
    : state.winner !== null
      ? `${SEAT_NAME[state.winner]}胡牌`
      : '结束';
  const rec: SavedRound = {
    id: 'r_' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
    round: state.round,
    savedAt: Date.now(),
    resultLabel: label,
    state: structuredClone(state),
  };
  const list = readSaved();
  list.unshift(rec);
  if (list.length > MAX_SAVED) list.length = MAX_SAVED;
  writeSaved(list);
  return rec;
}

export function loadSavedRounds(): SavedRound[] {
  return readSaved();
}

export function deleteSavedRound(id: string): boolean {
  const list = readSaved().filter((r) => r.id !== id);
  return writeSaved(list);
}

export function clearSavedRounds(): boolean {
  return writeSaved([]);
}

// 由收藏终局重建"人类决策时间线"用于复盘:
//   起点 = 开局发牌状态; 之后每个 HistoryEntry.stateBefore 是一个人类决策前快照
//   最终 = 终局状态
export interface ReplayNode {
  label: string;        // 该节点描述
  state: GameState;     // 该节点状态(展示用)
}

export function buildReplayNodes(saved: SavedRound): ReplayNode[] {
  const nodes: ReplayNode[] = [];
  const history = saved.state.history ?? [];
  for (const h of history) {
    nodes.push({ label: h.action, state: h.stateBefore });
  }
  nodes.push({ label: '终局', state: saved.state });
  return nodes;
}
