// 麻将牌类型系统定义

// 花色: m=万, p=筒, s=条, z=字(东南西北中发白)
export type Suit = 'm' | 'p' | 's' | 'z';

// 牌型代码: m1-m9, p1-p9, s1-s9, z1-z7
// z1=东 z2=南 z3=西 z4=北 z5=中(红中/百搭) z6=发 z7=白
export type TileCode = string;

// 单张麻将牌实例
export interface Tile {
  id: number;        // 0-135 全局唯一实例ID
  suit: Suit;
  rank: number;      // m/p/s: 1-9, z: 1-7
}

// 座位: 0=东 1=南(人类) 2=西 3=北，逆时针行动顺序
export type Seat = 0 | 1 | 2 | 3;

// 副露类型
export type MeldType = 'peng' | 'minggang' | 'angang' | 'bugang';

// 副露(碰/杠明牌)
export interface Meld {
  type: MeldType;
  tiles: Tile[];       // 组成该副露的牌(碰3张/杠4张)
  sourceSeat?: Seat;   // 提供该牌的玩家(碰/明杠需要)
}

// 玩家状态
export interface PlayerState {
  seat: Seat;
  name: string;
  isHuman: boolean;
  hand: Tile[];        // 暗手牌
  melds: Meld[];        // 已副露的碰/杠
  discards: Tile[];     // 自己打出的牌(弃牌)
  isDealer: boolean;    // 是否庄家
  isRiichi: boolean;    // 是否听牌(仅内部记录)
}

// 游戏阶段
export type Phase = 'idle' | 'dealing' | 'draw' | 'discard' | 'action' | 'react' | 'gameover';

// 操作类型
export type ActionType = 'peng' | 'minggang' | 'angang' | 'bugang' | 'hu' | 'pass';

// 待处理操作选项(供玩家选择)
export interface ActionOption {
  type: ActionType;
  tile?: Tile;         // 触发该操作的牌(他人打出的牌)
  meld?: Meld;         // 若操作产生副露
  seat: Seat;          // 执行该操作的玩家
}

// 日志条目
export interface LogEntry {
  time: number;        // 序号
  seat: Seat | 'system';
  action: string;      // 描述
  detail?: string;     // 详细信息
}

// 游戏状态
export interface GameState {
  deck: Tile[];            // 牌墙(从前端摸)
  wallTailIndex: number;  // 杠后从末尾补牌的指针
  players: PlayerState[];  // 四位玩家
  currentSeat: Seat;      // 当前行动玩家
  banker: Seat;            // 庄家
  phase: Phase;
  lastDiscard: { seat: Seat; tile: Tile } | null;  // 最后打出的牌
  winner: Seat | null;     // 胡牌者
  isDraw: boolean;          // 流局
  round: number;            // 局数
  log: LogEntry[];
  pendingOptions: ActionOption[];  // 当前玩家可选项(碰/杠/胡)
  drawCount: number;        // 已摸牌总数(用于AI策略阶段判定)
  isFirstRound: boolean;    // 是否首巡(用于防地胡)
  // 引擎运行时字段
  selfActions: ActionOption[];   // 自摸操作(暗杠/补杠)
  reactRemaining: Seat[];       // 碰杠反应队列剩余座位
  discardSource: Seat | null;   // 当前被反应的出牌者
  reactMode: 'discard' | null;  // 反应模式标记
  // 辅助训练相关
  drawnTileId: number | null;   // 当前轮次新摸的牌id(高亮+不参与理牌)
  lastAdvice: AdviceData | null;  // 当前给人类的最优打法建议
  lastMistake: MistakeAlert | null;  // 上一次失误提醒
  review: ReviewReport | null;  // 局终复盘报告
  lastCorrection?: UserCorrection | null;  // 最近一次校正记录(UI展示用)
}

// 最优打法建议(基于当前局面)
export interface AdviceData {
  seat: Seat;
  recommendDiscard: { tileId: number; code: string; name: string } | null;
  reason: string;
  tingTiles: string[];      // 若听牌，可胡牌型
  shanten: number;          // 向听数 0=听 1=一向听 ...
  candidates: Array<{      // 候选出牌评分(供详细展开)
    code: string;
    name: string;
    score: number;
    afterShanten: number;
    afterTing: string[];
    note: string;
  }>;
  strategyHints?: Array<{  // 匹配的策略库提示(多条)
    tip: string;
    category: string;
    priority: number;
    name: string;
  }>;
}

// 失误提醒
export interface MistakeAlert {
  seat: Seat;
  discardedCode: string;
  discardedName: string;
  issue: string;           // 失误类型描述
  betterCode: string;
  betterName: string;
  reason: string;
}

// 复盘报告
export interface ReviewReport {
  round: number;
  winner: Seat | null;
  isDraw: boolean;
  totalDraws: number;
  finalHands: Array<{       // 终局各家手牌(全部公开)
    seat: Seat;
    name: string;
    hand: Tile[];
    melds: { type: string; tiles: Tile[] }[];
    discards: Tile[];
  }>;
  keyDecisions: Array<{     // 关键决策点
    time: number;
    seat: Seat;
    action: string;
    analysis: string;
    suggestion: string;
  }>;
  summary: string;          // 总结
  improvements: string[];   // 改进建议
}

// 牌型代码工具
export function tileCode(t: Tile): TileCode {
  return `${t.suit}${t.rank}`;
}

// 红中(百搭)的代码
export const HONGZHONG_CODE = 'z5';

// 判断是否红中
export function isHongZhong(t: Tile): boolean {
  return t.suit === 'z' && t.rank === 5;
}

// 线性索引(0-33): m1-9=0-8, p1-9=9-17, s1-9=18-26, z1-7=27-33
export function tileIndex(t: Tile): number {
  const base = t.suit === 'm' ? 0 : t.suit === 'p' ? 9 : t.suit === 's' ? 18 : 27;
  return base + (t.rank - 1);
}

export function indexToTile(idx: number): Tile {
  let suit: Suit;
  let rank: number;
  if (idx < 9) { suit = 'm'; rank = idx + 1; }
  else if (idx < 18) { suit = 'p'; rank = idx - 8; }
  else if (idx < 27) { suit = 's'; rank = idx - 17; }
  else { suit = 'z'; rank = idx - 26; }
  return { id: -1, suit, rank };
}

// 花色中文名
export const SUIT_NAME: Record<Suit, string> = {
  m: '万',
  p: '筒',
  s: '条',
  z: '字',
};

// 牌中文名
export function tileName(t: Tile): string {
  const cn = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (t.suit === 'z') {
    const honors = ['东', '南', '西', '北', '中', '发', '白'];
    return honors[t.rank - 1];
  }
  return cn[t.rank - 1] + SUIT_NAME[t.suit];
}

// 座位方位名
export const SEAT_NAME: string[] = ['东', '南', '西', '北'];

// ========== 校正机制 & 专家模式 ==========

// 用户校正记录(经验积累)
export interface UserCorrection {
  id: string;              // uuid
  roundId: number;         // 局号
  seat: Seat;              // 校正者座位(固定=人类1)
  time: number;            // 时间戳
  // === 当时系统建议 ===
  systemRecommendCode: string | null; // 系统建议打的牌 code
  systemRecommendName: string | null;
  systemShanten: number;   // 系统评估向听数
  systemReason: string;
  candidatesAtTime: AdviceData['candidates']; // 当时所有候选(快照)
  // === 用户校正 ===
  userChoiceCode: string | null;   // 用户认为更优的牌 code(=系统建议表示认同,或候选其他,或自定义)
  userChoiceName: string | null;
  agree: boolean;           // true=认同系统建议,false=纠正
  userReason: string;       // 用户校正理由
  // === 上下文(可做策略库匹配用) ===
  handCodes: string[];      // 当时手牌 codes(排序)
  meldsCount: number;
  hongZhongCount: number;
  pairCount: number;
  phase: 'early' | 'mid' | 'late';
  isTenpai: boolean;
  deckRemaining: number;    // 牌墙剩余
}

// 局势评分(红中麻将专家面板用)
export interface SituationScore {
  offense: number;     // 进攻分 0-100
  defense: number;     // 防守分 0-100
  tileEfficiency: number; // 牌效分 0-100
  hongzhongHealth: number; // 红中运用健康度 0-100
  overall: number;     // 综合分
  tags: string[];      // 文字标签(如"七小对成型"/"红中留作将优"/"扣牌不足")
}

// 校正经验聚合(用于专家模式个性化趋势)
export interface CorrectionTrend {
  totalCorrections: number;
  agreeRate: number;   // 用户认同率
  topDisagreeCategories: string[]; // 最常与系统分歧的类别
  recent: UserCorrection[];
}
