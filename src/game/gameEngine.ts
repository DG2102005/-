// 游戏引擎: 状态机与回合控制
import type {
  GameState, PlayerState, Seat, Tile, ActionOption, Meld, Phase, LogEntry,
} from './types';
import { tileCode, isHongZhong, tileName, SEAT_NAME } from './types';
import { dealWithCheck, initPlayers } from './deal';
import { sortHand } from './sort';
import { canWin, checkTing } from './win';
import {
  getActionsForDiscard, getSelfActions, getAllSelfActions, applyPeng, applyMinggang, applyAngang, applyBugang,
} from './rules';
import { addLog, resetLog } from './logger';
import { nextSeat, HUMAN_SEAT } from './constants';
import { buildAdvice, detectMistake } from './advisor';
import { buildReview } from './review';

// 深拷贝状态(供React不可变更新)
function clone(state: GameState): GameState {
  return structuredClone(state);
}

// 创建初始空状态
export function createInitialState(): GameState {
  return {
    deck: [],
    wallTailIndex: 0,
    players: [],
    currentSeat: 1,
    banker: 0,
    phase: 'idle',
    lastDiscard: null,
    winner: null,
    isDraw: false,
    round: 0,
    log: [],
    pendingOptions: [],
    drawCount: 0,
    isFirstRound: true,
    selfActions: [],
    reactRemaining: [],
    discardSource: null,
    reactMode: null,
    drawnTileId: null,
    lastAdvice: null,
    lastMistake: null,
    review: null,
  };
}

// 开始新局
export function startNewRound(state: GameState, banker?: Seat): GameState {
  const s = createInitialState();
  s.round = state.round + 1;
  resetLog();
  const b: Seat = banker ?? state.banker ?? 0;
  s.banker = b;
  const { deck, hands } = dealWithCheck(b);
  s.deck = deck;
  s.wallTailIndex = deck.length - 1;
  s.players = initPlayers(hands, b);
  s.currentSeat = b;
  s.isFirstRound = true;
  s.phase = 'discard'; // 庄家已有14张，需出牌
  // 记录发牌日志
  addLog(s.log, 'system', `第${s.round}局开始`, `庄家:${SEAT_NAME[b]}`);
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    addLog(s.log, p.seat, '发牌', p.hand.map((t) => tileName(t)).join(' '));
  }
  // 庄家自检暗杠/补杠(开局扫描全部手牌)
  s.selfActions = getAllSelfActions(s.players[b]);
  // 若人类是庄家，开局即给出建议
  if (b === HUMAN_SEAT) {
    s.lastAdvice = buildAdvice(s, b);
  }
  return s;
}

// 摸牌
export function drawTile(state: GameState, seat: Seat): GameState {
  const s = clone(state);
  if (s.deck.length === 0) {
    // 流局
    s.phase = 'gameover';
    s.isDraw = true;
    addLog(s.log, 'system', '牌堆已摸完，流局');
    s.review = buildReview(s);
    return s;
  }
  const tile = s.deck.shift()!;
  // 新牌追加到末尾，不参与自动理牌(等待玩家确认出牌后再整理)
  s.players[seat].hand.push(tile);
  s.drawnTileId = tile.id;
  s.drawCount++;
  addLog(s.log, seat, '摸牌', tileName(tile));
  // 首巡过后取消首巡标记
  if (s.drawCount > 4) s.isFirstRound = false;
  // 自摸胡判定
  if (canWin(s.players[seat].hand, s.players[seat].melds.length)) {
    if (!s.players[seat].isHuman) {
      // AI: 立即自动胡
      s.phase = 'gameover';
      s.winner = seat;
      s.drawnTileId = null;
      addLog(s.log, seat, '自摸胡牌', s.players[seat].hand.map((t) => tileName(t)).join(' '));
      s.review = buildReview(s);
      return s;
    }
    // 人类: 不强制胡, 提供"自摸胡"选项 + 保留暗杠/补杠选项
    const huAction: ActionOption = { type: 'hu', seat };
    const selfActs = getSelfActions(s.players[seat], tile);
    s.selfActions = [huAction, ...selfActs];
    s.currentSeat = seat;
    s.pendingOptions = [];
    s.phase = 'discard'; // 等待玩家手动点"胡"或选择放弃
    // 能胡时不生成建议(避免干扰玩家选择)
    s.lastAdvice = null;
    return s;
  }
  // 不能胡: 正常进入出牌阶段, 检查暗杠/补杠
  s.currentSeat = seat;
  s.selfActions = getSelfActions(s.players[seat], tile);
  s.pendingOptions = [];
  s.phase = 'discard';
  // 给人类生成最优打法建议
  if (seat === HUMAN_SEAT) {
    s.lastAdvice = buildAdvice(s, seat);
    s.lastMistake = null;
  }
  return s;
}

// 出牌
export function discardTile(state: GameState, seat: Seat, tileId: number): GameState {
  const s = clone(state);
  const player = s.players[seat];
  const idx = player.hand.findIndex((t) => t.id === tileId);
  if (idx < 0) return s;
  const [tile] = player.hand.splice(idx, 1);
  player.discards.push(tile);
  // 出牌后对剩余手牌自动整理(万→筒→条→字升序，同牌成组)
  player.hand = sortHand(player.hand);
  s.lastDiscard = { seat, tile };
  s.pendingOptions = [];
  s.selfActions = [];
  s.drawnTileId = null;
  addLog(s.log, seat, '出牌', tileName(tile));
  // 人类出牌后检测是否失误(对比上一条建议)
  if (seat === HUMAN_SEAT && s.lastAdvice) {
    s.lastMistake = detectMistake(s, seat, tile);
  }
  // 人类出牌后(13张)检查听牌, 若已听牌则保留听牌提示
  if (seat === HUMAN_SEAT) {
    const tingTiles = checkTing(player.hand, player.melds.length);
    if (tingTiles.length > 0) {
      const tingNames = tingTiles.map((c) => tileName(codeToTile(c)));
      s.lastAdvice = {
        seat,
        recommendDiscard: null,
        reason: `听牌中, 可胡: ${tingNames.join('、')}`,
        tingTiles,
        shanten: 0,
        candidates: [],
      };
    } else {
      s.lastAdvice = null;
    }
  } else {
    s.lastAdvice = null;
  }
  // 检查其他三家是否碰/杠
  return processDiscardReact(s, seat);
}

// 牌型代码转 Tile(用于显示听牌中文名)
function codeToTile(code: string): Tile {
  const suit = code[0] as Tile['suit'];
  const rank = parseInt(code.slice(1), 10);
  return { id: -1, suit, rank };
}

// 处理出牌后的碰/杠反应(按逆时针顺序)
function processDiscardReact(state: GameState, discarder: Seat): GameState {
  const s = state;
  const order: Seat[] = [
    nextSeat(discarder),
    ((discarder + 2) % 4) as Seat,
    ((discarder + 3) % 4) as Seat,
  ];
  s.discardSource = discarder;
  return processReactQueue(s, order, 0);
}

function processReactQueue(state: GameState, order: Seat[], startIdx: number): GameState {
  const s = state;
  for (let i = startIdx; i < order.length; i++) {
    const seat = order[i];
    const player = s.players[seat];
    const discard = s.lastDiscard!.tile;
    const opts = getActionsForDiscard(player, discard, s.discardSource!);
    if (opts.length === 0) continue;
    if (player.isHuman) {
      // 等待人类选择
      s.pendingOptions = opts;
      s.reactRemaining = order.slice(i + 1);
      s.phase = 'react';
      s.reactMode = 'discard';
      return s;
    }
    // AI决策
    const decision = aiDecideAction(opts, player, s);
    if (decision !== 'pass') {
      return applyAction(s, decision, true);
    }
    // AI放弃，继续
  }
  // 无人操作，轮到下家摸牌
  return advanceToDraw(s);
}

// 推进到下家摸牌
function advanceToDraw(state: GameState): GameState {
  const s = state;
  s.currentSeat = nextSeat(s.discardSource ?? s.currentSeat);
  s.pendingOptions = [];
  s.selfActions = [];
  s.lastDiscard = null;
  s.reactRemaining = [];
  s.phase = 'draw';
  return s;
}

// 人类选择放弃(碰杠反应)
export function humanPassReact(state: GameState): GameState {
  const s = clone(state);
  const remaining = s.reactRemaining ?? [];
  return processReactQueue(s, remaining, 0);
}

// 应用操作(碰/杠)
export function applyAction(state: GameState, option: ActionOption, isReact: boolean): GameState {
  const s = clone(state);
  const player = s.players[option.seat];
  // 碰/杠会取走刚打出的牌，从打出者弃牌区移除
  if (isReact && s.lastDiscard) {
    const ds = s.discardSource!;
    const dplayer = s.players[ds];
    // 移除最后一张弃牌(即被取走的牌)
    if (dplayer.discards.length > 0) dplayer.discards.pop();
  }
  if (option.type === 'peng') {
    applyPeng(player, option.meld!);
    addLog(s.log, option.seat, '碰', tileName(option.tile!));
    s.currentSeat = option.seat;
    s.pendingOptions = [];
    s.selfActions = [];
    s.lastDiscard = null;
    s.phase = 'discard';
    return s;
  }
  // 杠(明杠/暗杠/补杠)统一处理: 副露 + 杠后补牌(末尾)
  if (option.type === 'minggang') {
    applyMinggang(player, option.meld!);
    addLog(s.log, option.seat, '明杠', tileName(option.tile!));
  } else if (option.type === 'angang') {
    applyAngang(player, option.meld!);
    addLog(s.log, option.seat, '暗杠', tileName(option.meld!.tiles[0]));
  } else if (option.type === 'bugang') {
    applyBugang(player, option.meld!);
    addLog(s.log, option.seat, '补杠', tileName(option.tile!));
  }
  s.currentSeat = option.seat;
  // 杠后补牌(从牌堆末尾摸一张)
  return gangRinshan(s, option.seat);
}

// 杠后补牌(岭上开花判定)
function gangRinshan(state: GameState, seat: Seat): GameState {
  const s = state;
  if (s.deck.length === 0) {
    // 无牌可补，直接进入出牌
    s.phase = 'discard';
    s.pendingOptions = [];
    s.selfActions = [];
    return s;
  }
  const tile = s.deck.pop()!; // 从末尾补
  // 补牌同样追加到末尾，不立即整理
  s.players[seat].hand.push(tile);
  s.drawnTileId = tile.id;
  addLog(s.log, seat, '杠后补牌', tileName(tile));
  // 岭上开花(自摸)判定
  if (canWin(s.players[seat].hand, s.players[seat].melds.length)) {
    if (!s.players[seat].isHuman) {
      // AI: 立即岭上开花胡
      s.phase = 'gameover';
      s.winner = seat;
      s.drawnTileId = null;
      addLog(s.log, seat, '岭上开花胡牌', s.players[seat].hand.map((t) => tileName(t)).join(' '));
      s.review = buildReview(s);
      return s;
    }
    // 人类: 提供"岭上开花胡"选项, 玩家可手动确认
    const huAction: ActionOption = { type: 'hu', seat };
    const selfActs = getSelfActions(s.players[seat], tile);
    s.selfActions = [huAction, ...selfActs];
    s.pendingOptions = [];
    s.phase = 'discard';
    s.lastAdvice = null;
    return s;
  }
  // 重新检查自摸操作
  s.selfActions = getSelfActions(s.players[seat], tile);
  s.pendingOptions = [];
  s.phase = 'discard';
  if (seat === HUMAN_SEAT) {
    s.lastAdvice = buildAdvice(s, seat);
  }
  return s;
}

// 人类选择自摸操作(胡/暗杠/补杠)或放弃直接出牌
export function applySelfAction(state: GameState, option: ActionOption): GameState {
  const s = clone(state);
  const player = s.players[option.seat];
  if (option.type === 'hu') {
    // 玩家手动点击"自摸"按钮 → 胡牌
    s.phase = 'gameover';
    s.winner = option.seat;
    s.drawnTileId = null;
    s.selfActions = [];
    s.pendingOptions = [];
    addLog(s.log, option.seat, '自摸胡牌', player.hand.map((t) => tileName(t)).join(' '));
    s.review = buildReview(s);
    return s;
  }
  if (option.type === 'angang') {
    applyAngang(player, option.meld!);
    addLog(s.log, option.seat, '暗杠', tileName(option.meld!.tiles[0]));
  } else if (option.type === 'bugang') {
    applyBugang(player, option.meld!);
    addLog(s.log, option.seat, '补杠', tileName(option.tile!));
  }
  return gangRinshan(s, option.seat);
}

// 人类放弃自摸胡(从 selfActions 中移除 hu 选项, 保留暗杠/补杠)
// 玩家放弃后, 本巡仍可正常出牌, 下次摸到能胡的牌仍可再次胡
export function humanPassSelfAction(state: GameState): GameState {
  const s = clone(state);
  s.selfActions = s.selfActions.filter((o) => o.type !== 'hu');
  return s;
}

// ===== AI 决策占位(实际在 aiEngine.ts 实现，此处转发) =====
import { aiDecideAction, aiDecideDiscard, aiDecideSelfAction } from './aiEngine';
export { aiDecideAction, aiDecideDiscard, aiDecideSelfAction };

// AI玩家执行一轮摸出牌(供hook调用)
export function aiPlayTurn(state: GameState): GameState {
  let s = state;
  if (s.phase === 'draw') {
    s = drawTile(s, s.currentSeat);
  }
  if (s.phase === 'gameover') return s;
  // 处理自摸操作(暗杠/补杠)
  if (s.phase === 'discard' && !s.players[s.currentSeat].isHuman) {
    const player = s.players[s.currentSeat];
    if (s.selfActions && s.selfActions.length > 0) {
      const dec = aiDecideSelfAction(s.selfActions, player, s);
      if (dec !== 'pass') {
        s = applySelfAction(s, dec);
        if (s.phase === 'gameover') return s;
        // 杠后可能又有自摸操作，循环
        return aiPlayTurn(s);
      }
    }
    // 选择出牌
    const tileId = aiDecideDiscard(player, s);
    s = discardTile(s, s.currentSeat, tileId);
  }
  return s;
}
