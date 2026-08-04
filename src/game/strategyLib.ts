// 策略库: localStorage持久化的打法经验库
// 支持内置规则 + 玩家上传案例, 持续累积提升建议质量
//
// 内置策略来源: 网络公开的红中麻将专业文章提炼
//   - 搜狐《关于红中麻将的规则》
//   - 头条《红中麻将别乱打!掌握这套实战打法》
//   - 头条《打红中麻将别乱玩!记住红中多留对》
//   - mjrules《红中麻将核心规则与实战进阶技巧深度解析》
//   - 搜狐《红中麻将的玩法技巧》
// "持续学习" = 通过案例累积不断丰富匹配规则,非ML训练

export interface StrategyCase {
  id: string;
  name: string;             // 案例名称
  // 匹配条件(全部满足才匹配, undefined=不限)
  conditions: {
    hongZhongCount?: number;     // 红中数量(精确匹配)
    hongZhongMin?: number;       // 红中数量下限
    hongZhongMax?: number;       // 红中数量上限
    pairCountMin?: number;       // 对子数量下限
    pairCountMax?: number;       // 对子数量上限
    meldsCount?: number;         // 副露数量
    phase: 'early' | 'mid' | 'late';
    isTenpai?: boolean;          // 是否听牌
    shantenMax?: number;         // 向听数上限
    handPattern?: string;        // 手牌特征(可选,代码串包含匹配)
  };
  recommendType: 'keep' | 'discard' | 'peng' | 'gang' | 'wait' | 'hu' | 'defense';
  recommendCode?: string;        // 建议的牌代码(可选)
  priority: number;              // 优先级(越高越优先, 1-10)
  tip: string;                  // 经验说明
  source: 'builtin' | 'user';   // 来源
  category: string;              // 分类标签
  createdAt: number;
}

const STORAGE_KEY = 'hongzhong_strategy_lib_v2';

// localStorage 抽象层(浏览器有则用,Node/SSR无则用内存回退,不影响应用)
const memStore: Record<string, string> = {};
function getStorage(): Storage | null {
  try {
    const ls = (typeof globalThis !== 'undefined' ? (globalThis as any).localStorage : undefined);
    if (ls && typeof ls.setItem === 'function' && typeof ls.getItem === 'function') return ls as Storage;
  } catch { /* */ }
  return null;
}
function storageGet(key: string): string | null {
  const s = getStorage();
  if (s) return s.getItem(key);
  return memStore[key] ?? null;
}
function storageSet(key: string, val: string): void {
  const s = getStorage();
  if (s) s.setItem(key, val);
  else memStore[key] = val;
}

// ============ 内置系统策略库(基于公开专业文章提炼) ============
// 覆盖: 红中运用、对子策略、阶段策略、吃碰杠取舍、听牌、舍牌、读牌、防守
const BUILTIN_CASES: StrategyCase[] = [
  // ===== 一、红中运用策略(核心) =====
  {
    id: 'b-hz-001', name: '红中优先补将不补顺',
    conditions: { phase: 'mid', hongZhongMin: 1, pairCountMax: 1 },
    recommendType: 'keep', priority: 10,
    tip: '红中最大价值是补"缺将"难题。顺子可慢慢摸牌凑齐,但将牌可遇不可求。1张红中应优先留作补将后手,不要轻易消耗在顺子上',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },
  {
    id: 'b-hz-002', name: '红中不补两面搭',
    conditions: { phase: 'early', hongZhongMin: 1, shantenMax: 2 },
    recommendType: 'keep', priority: 9,
    tip: '能靠原生牌组两面搭的,优先保留。红中不要用来补12万缺3万这类边搭,留作中后期补卡张、改良烂搭',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },
  {
    id: 'b-hz-003', name: '红中优先补卡张边张',
    conditions: { phase: 'mid', hongZhongMin: 1, shantenMax: 1 },
    recommendType: 'keep', priority: 8,
    tip: '用红中补卡张(如缺4万的24万)或边张(如缺3万的12万),比补两面搭更划算。难凑的位置留给万能牌,易凑的留给自然摸牌',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },
  {
    id: 'b-hz-004', name: '不早消耗红中凑搭',
    conditions: { phase: 'early', hongZhongMin: 1, shantenMax: 3 },
    recommendType: 'keep', priority: 10,
    tip: '前期不要一上来就用红中补搭。红中最大价值在于中后期灵活改变胡牌张,开局透支红中=自废武功。前期优先打孤张,红中留作后手',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },
  {
    id: 'b-hz-005', name: '多红中不贪大牌',
    conditions: { phase: 'mid', hongZhongMin: 2, isTenpai: false },
    recommendType: 'hu', priority: 9,
    tip: '2张以上红中虽容易做碰碰胡/清一色,但牌局瞬息万变。能早听早胡优先落袋,贪大牌常竹篮打水。先确保听牌,再考虑番型',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },
  {
    id: 'b-hz-006', name: '红中不作字牌顺子',
    conditions: { phase: 'early', hongZhongMin: 1 },
    recommendType: 'keep', priority: 7,
    tip: '字牌(东南西北发白)只能刻子不能顺子。红中虽可代替字牌作刻子,但通常应优先保留红中作将/补万筒条顺子,价值更高',
    source: 'builtin', category: '红中运用', createdAt: 0,
  },

  // ===== 二、按持红中数量定策略 =====
  {
    id: 'b-hz-010', name: '0红中保守防守',
    conditions: { phase: 'mid', hongZhongCount: 0, shantenMax: 2 },
    recommendType: 'defense', priority: 9,
    tip: '手中无百搭兜底,成型难度大。不要强行做大牌,主打平稳小门胡。谨慎打出中张生牌,优先搭稳定两面搭',
    source: 'builtin', category: '红中数量', createdAt: 0,
  },
  {
    id: 'b-hz-011', name: '1红中常态打法',
    conditions: { phase: 'mid', hongZhongCount: 1 },
    recommendType: 'keep', priority: 8,
    tip: '1张红中属常态。优先依靠原生手牌凑搭,把红中留到中后期用于快速听牌、改良卡张、边张烂搭。不要一上来就消耗红中补缺',
    source: 'builtin', category: '红中数量', createdAt: 0,
  },
  {
    id: 'b-hz-012', name: '2+红中主动进攻',
    conditions: { phase: 'early', hongZhongMin: 2, shantenMax: 2 },
    recommendType: 'keep', priority: 8,
    tip: '多张红中=手牌上限高,可适度主动进攻。但不要乱吃乱碰暴露意图,保留手牌灵活性,预留多种胡牌路线',
    source: 'builtin', category: '红中数量', createdAt: 0,
  },
  {
    id: 'b-hz-013', name: '3+红中冲碰碰胡',
    conditions: { phase: 'mid', hongZhongMin: 3, pairCountMin: 2 },
    recommendType: 'peng', priority: 9,
    tip: '3张以上红中极易听牌,可考虑做碰碰胡。红中可补任意刻子,对子越多路线越宽。但能小胡就先胡,不硬扛大牌',
    source: 'builtin', category: '红中数量', createdAt: 0,
  },

  // ===== 三、对子策略("红中多留对"核心思路) =====
  {
    id: 'b-pr-001', name: '起手≥2对保留所有对子',
    conditions: { phase: 'early', pairCountMin: 2, hongZhongMin: 1 },
    recommendType: 'keep', priority: 9,
    tip: '红中麻将核心口诀"红中多留对,胡牌不吃亏"。对子越多,红中发挥空间越大:可碰碰胡/拆对当将/七对。先清理孤张,别急着拆对',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },
  {
    id: 'b-pr-002', name: '连张对子价值最高不拆',
    conditions: { phase: 'mid', pairCountMin: 1, shantenMax: 2 },
    recommendType: 'keep', priority: 8,
    tip: '带连张的对子(如223万、667筒)价值最高:既能当将,又能凑顺子。不到迫不得已不要拆,这类对子是优质资产',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },
  {
    id: 'b-pr-003', name: '三对+红中冲碰碰胡',
    conditions: { phase: 'mid', pairCountMin: 3, hongZhongMin: 1, shantenMax: 1 },
    recommendType: 'peng', priority: 9,
    tip: '3对以上+红中,优先朝碰碰胡/七对发展。少吃牌(吃牌破坏对子结构),不拆对子,依靠红中补缺刻。此时目标是大胡',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },
  {
    id: 'b-pr-004', name: '一对固定将不拆',
    conditions: { phase: 'mid', pairCountMax: 1, hongZhongMin: 1, shantenMax: 2 },
    recommendType: 'keep', priority: 8,
    tip: '手牌仅1对时,这就是你的固定将,不要拆。红中留作备用,万一被迫拆将,红中可快速重凑新对子,避免无将可用',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },
  {
    id: 'b-pr-005', name: '无对子防守等摸',
    conditions: { phase: 'mid', pairCountMax: 0, shantenMax: 2 },
    recommendType: 'defense', priority: 8,
    tip: '无对子是最差牌型。不要强行做大牌,红中暂时留住,打孤张等摸对子。这段时间防守优先,不冲生张。实在摸不到再用红中建临时将',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },
  {
    id: 'b-pr-006', name: '尾盘宁拆顺子不拆将',
    conditions: { phase: 'late', pairCountMin: 1, isTenpai: false, shantenMax: 1 },
    recommendType: 'keep', priority: 9,
    tip: '尾盘宁拆顺子搭子,不拆唯一将对。很多人为凑两面搭拆对子,最后整手无将,手握红中都没法听。守住将对是底线',
    source: 'builtin', category: '对子策略', createdAt: 0,
  },

  // ===== 四、阶段策略 =====
  {
    id: 'b-ph-001', name: '起手清点红中梳理搭子',
    conditions: { phase: 'early' },
    recommendType: 'wait', priority: 7,
    tip: '起手第一件事:数红中、数对子、数同花色。≥2对+红中→保留对子路线;0红中→保守;2+红中→可进攻但别贪',
    source: 'builtin', category: '阶段策略', createdAt: 0,
  },
  {
    id: 'b-ph-002', name: '前期舍牌顺序',
    conditions: { phase: 'early', shantenMax: 3 },
    recommendType: 'discard', priority: 7,
    tip: '前期舍牌顺序:无对子字牌→单张幺九边张→多余边搭。3、7骨架牌尽量保留,它们组顺潜力最大。有红中时可适度放宽取舍',
    source: 'builtin', category: '阶段策略', createdAt: 0,
  },
  {
    id: 'b-ph-003', name: '中盘拆有交集搭子',
    conditions: { phase: 'mid', hongZhongMin: 2, shantenMax: 2 },
    recommendType: 'discard', priority: 7,
    tip: '中盘多红中时,要拆除有交集的搭子(如同时有234万和345万),避免浪费进张机会。红中可补缺,不需要重复搭子',
    source: 'builtin', category: '阶段策略', createdAt: 0,
  },
  {
    id: 'b-ph-004', name: '尾盘减少碰牌',
    conditions: { phase: 'late', isTenpai: true },
    recommendType: 'wait', priority: 8,
    tip: '尾盘主要比拼摸牌次数,尽量减少碰牌。即使碰牌可单吊红中也需谨慎,碰牌减少自己的摸牌机会。守住听牌等胡即可',
    source: 'builtin', category: '阶段策略', createdAt: 0,
  },

  // ===== 五、吃碰杠取舍 =====
  {
    id: 'b-meld-001', name: '0红中严管吃碰',
    conditions: { phase: 'mid', hongZhongCount: 0, meldsCount: 0, shantenMax: 2 },
    recommendType: 'wait', priority: 8,
    tip: '0红中时手牌可塑性差,频繁吃碰会压缩进牌路线,容易被对手牵制。非必要不吃边搭,严管吃碰',
    source: 'builtin', category: '吃碰杠', createdAt: 0,
  },
  {
    id: 'b-meld-002', name: '1红中选择性吃碰',
    conditions: { phase: 'mid', hongZhongCount: 1, meldsCount: 0 },
    recommendType: 'peng', priority: 7,
    tip: '1红中时可选择性吃碰。可吃卡张改良牌型,但12、89边搭尽量不吃,性价比太低。优先保留原生搭子',
    source: 'builtin', category: '吃碰杠', createdAt: 0,
  },
  {
    id: 'b-meld-003', name: '2+红中适度加速',
    conditions: { phase: 'mid', hongZhongMin: 2, meldsCount: 0, shantenMax: 2 },
    recommendType: 'peng', priority: 7,
    tip: '2+红中可适度吃碰加速成型,但连续多次碰牌需警惕。频繁落地后进攻意图暴露,对手会重点防守',
    source: 'builtin', category: '吃碰杠', createdAt: 0,
  },
  {
    id: 'b-meld-004', name: '谨慎开杠',
    conditions: { phase: 'late', hongZhongMin: 1, meldsCount: 1 },
    recommendType: 'gang', priority: 8,
    tip: '红中麻将杠牌要谨慎。若已两家疑似听牌,不建议开杠。普通牌杠看局势,红中绝不随便杠——失去万能牌灵活性得不偿失',
    source: 'builtin', category: '吃碰杠', createdAt: 0,
  },
  {
    id: 'b-meld-005', name: '红中不杠',
    conditions: { phase: 'mid', hongZhongMin: 1 },
    recommendType: 'keep', priority: 10,
    tip: '红中绝不随便杠!即使有杠红中奖励,杠掉红中=失去万能牌,手牌灵活性大打折扣。不要为一点杠分废掉一手好牌',
    source: 'builtin', category: '吃碰杠', createdAt: 0,
  },

  // ===== 六、听牌策略 =====
  {
    id: 'b-tp-001', name: '多面听优于单吊',
    conditions: { phase: 'late', isTenpai: true },
    recommendType: 'wait', priority: 8,
    tip: '听多面优于听单吊。宁可多走一步换听多面张,提升胡牌概率。如能听2、5、8万不要只听某一张',
    source: 'builtin', category: '听牌', createdAt: 0,
  },
  {
    id: 'b-tp-002', name: '红中拓宽听牌面',
    conditions: { phase: 'mid', hongZhongMin: 1, isTenpai: true },
    recommendType: 'keep', priority: 9,
    tip: '用红中把"卡4万"转成"听3、4、5万"两面听。单吊危险牌时,利用红中调整听牌张,提升胡牌概率',
    source: 'builtin', category: '听牌', createdAt: 0,
  },
  {
    id: 'b-tp-003', name: '听熟张不听生张',
    conditions: { phase: 'late', isTenpai: true },
    recommendType: 'wait', priority: 8,
    tip: '尾盘听牌优先选熟张(已出过的牌),不听生张(未见过的牌)。有红中时可灵活更换吊牌,不要死守生张',
    source: 'builtin', category: '听牌', createdAt: 0,
  },
  {
    id: 'b-tp-004', name: '听牌后小胡优先落袋',
    conditions: { phase: 'late', isTenpai: true },
    recommendType: 'hu', priority: 8,
    tip: '后期剩牌不多,若自己已听牌,优先自摸胡牌落袋。本玩法只能自摸,听牌后越早胡越好,避免牌局流局或对手先自摸',
    source: 'builtin', category: '听牌', createdAt: 0,
  },

  // ===== 七、舍牌策略 =====
  {
    id: 'b-dc-001', name: '后期扣牌不让对手摸',
    conditions: { phase: 'late', shantenMax: 1 },
    recommendType: 'defense', priority: 9,
    tip: '后期对手可能已听牌自摸在即。本玩法只能自摸,你打出的牌对手可能碰/杠借力加速,优先打已见多张的熟张(对手手中持有概率低),扣住少见中张不给对手摸牌机会',
    source: 'builtin', category: '舍牌', createdAt: 0,
  },
  {
    id: 'b-dc-002', name: '中张价值高于边张',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'discard', priority: 6,
    tip: '3-7中张更容易组顺子,价值高于1/9边张。舍牌时优先打边张,保留中张与有潜力组合的牌',
    source: 'builtin', category: '舍牌', createdAt: 0,
  },
  {
    id: 'b-dc-003', name: '关键牌用红中扣住',
    conditions: { phase: 'late', hongZhongMin: 1, shantenMax: 1 },
    recommendType: 'keep', priority: 8,
    tip: '后期需打出对手可能急需的关键进张时,若有红中可考虑用红中替代该位置,把关键牌扣住。但需权衡红中消耗是否值得,通常红中留作自摸胡牌更重要',
    source: 'builtin', category: '舍牌', createdAt: 0,
  },

  // ===== 八、读牌猜牌 =====
  {
    id: 'b-rd-001', name: '对手同花色→清一色',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'defense', priority: 7,
    tip: '若某对手持续打出同花色,大概率在做清一色+红中加持。该花色中张牌全部扣紧,不要打出助其成型',
    source: 'builtin', category: '读牌', createdAt: 0,
  },
  {
    id: 'b-rd-002', name: '默摸者警惕自摸',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'defense', priority: 8,
    tip: '某玩家不吃不碰默默摸牌,危险程度更高。很可能手握多张红中,悄悄成型静待自摸。对此类玩家提高警惕,扣住其可能需要的进张',
    source: 'builtin', category: '读牌', createdAt: 0,
  },
  {
    id: 'b-rd-003', name: '2、8、3、7少见则扣',
    conditions: { phase: 'late', shantenMax: 1 },
    recommendType: 'defense', priority: 7,
    tip: '若桌面上2、8、3、7长期少见,说明有人扣住或在做相关搭子。本玩法虽不能被胡,但打出这些牌可能助对手碰杠加速成型,需谨慎扣住',
    source: 'builtin', category: '读牌', createdAt: 0,
  },

  // ===== 九、心态与原则 =====
  {
    id: 'b-mn-001', name: '红中局节奏快',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'wait', priority: 7,
    tip: '红中局节奏比普通麻将快,3-4圈就有人听牌。中盘第5-6圈就要提高警惕,普通麻将7-8圈才听牌的节奏不适用',
    source: 'builtin', category: '心态', createdAt: 0,
  },
  {
    id: 'b-mn-002', name: '不恋牌及时拆搭',
    conditions: { phase: 'late', shantenMax: 2 },
    recommendType: 'defense', priority: 7,
    tip: '手气差时及时拆搭防守,避免硬冲大胡导致对手先自摸。不恋牌是红中麻将重要原则,小胡也是胡',
    source: 'builtin', category: '心态', createdAt: 0,
  },
  {
    id: 'b-mn-003', name: '记红中数量',
    conditions: { phase: 'mid' },
    recommendType: 'wait', priority: 8,
    tip: '牢记已出红中数量。4张红中是稀缺资源,若3张已出,你手里的1张就是绝对王牌。若4张都在桌面,无红中可摸',
    source: 'builtin', category: '心态', createdAt: 0,
  },

  // ===== 十、七小对策略(本玩法特色胡法) =====
  {
    id: 'b-7p-001', name: '5对以上可冲七小对',
    conditions: { phase: 'mid', pairCountMin: 5, hongZhongMin: 0, shantenMax: 2 },
    recommendType: 'keep', priority: 9,
    tip: '手中已有5对以上时,可考虑七小对路线(7对胡)。比推倒胡更灵活,不需面子结构,只要凑齐7对即可。即使0红中,5对+2摸对也能成型',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-002', name: '七小对优先拆孤立搭子',
    conditions: { phase: 'mid', pairCountMin: 4, shantenMax: 2 },
    recommendType: 'discard', priority: 8,
    tip: '走七小对路线时,优先拆孤立顺子搭子(如不连续的12万),保留所有对子。对子是七小对的"积木",顺子搭子反而是负担',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-003', name: '七小对+红中威力倍增',
    conditions: { phase: 'mid', pairCountMin: 4, hongZhongMin: 1, shantenMax: 2 },
    recommendType: 'keep', priority: 9,
    tip: '4对+1红中=只需再摸2对即可七小对胡。红中可作任意对子(1红中+1实牌成对,或2红中自凑1对),七小对+红中是高效率组合',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-004', name: '4张同款不拆作2对',
    conditions: { phase: 'mid', pairCountMin: 4, shantenMax: 2 },
    recommendType: 'keep', priority: 8,
    tip: '4张同款(如4个1万)在七小对中算2对,不要拆开组刻子。若4张同款+3对其他+0红中=5对,还差2对,继续摸牌即可',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-005', name: '七小对暗手保密强',
    conditions: { phase: 'mid', pairCountMin: 5, meldsCount: 0, shantenMax: 2 },
    recommendType: 'keep', priority: 8,
    tip: '七小对必须为暗手(不能副露),意味着对手完全看不到你的牌型。保密性强,对手难以猜牌防守。这是七小对相对推倒胡的核心优势',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-006', name: '六对+红中单吊听牌',
    conditions: { phase: 'late', pairCountMin: 6, hongZhongMin: 1, isTenpai: true },
    recommendType: 'wait', priority: 9,
    tip: '6对+1红中+1单张时,红中可补任意牌成对。此时已听牌(任意牌都能成对),等同"全听"。这是七小对最强听牌形态,优先保留',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-007', name: '七小对vs推倒胡路线选择',
    conditions: { phase: 'early', pairCountMin: 4, shantenMax: 2 },
    recommendType: 'wait', priority: 7,
    tip: '4对以上倾向七小对,4对以下倾向推倒胡。混合手牌(3对+1顺子+1孤立对)可灵活切换:摸对子转七小对,摸顺张转推倒胡',
    source: 'builtin', category: '七小对', createdAt: 0,
  },
  {
    id: 'b-7p-008', name: '七小对不副露',
    conditions: { phase: 'mid', pairCountMin: 5, meldsCount: 0, shantenMax: 2 },
    recommendType: 'wait', priority: 9,
    tip: '走七小对路线时不要碰/杠!副露后暗手张数不足14张,七小对判定失效。即使能碰也忍住,保留暗手凑7对',
    source: 'builtin', category: '七小对', createdAt: 0,
  },

  // ===== 十一、扣牌实战(只能自摸规则下的防守) =====
  {
    id: 'b-kp-001', name: '扣牌核心:识别对手需求',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'defense', priority: 8,
    tip: '扣牌前提是猜对手需求。观察舍牌规律:开局连打某花色=缺该花色(可放心打);只打幺九不打中张=做清一色;频繁碰杠同花色=做对对胡',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },
  {
    id: 'b-kp-002', name: '扣牌优先扣下家',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'defense', priority: 7,
    tip: '下家是你之后摸牌的人,扣住其需要的进张能直接延缓其听牌。本玩法虽不能被胡,扣牌也能让对手摸牌效率下降,变相增加自己自摸机会',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },
  {
    id: 'b-kp-003', name: '熟张安全牌优先打',
    conditions: { phase: 'late', shantenMax: 1 },
    recommendType: 'discard', priority: 8,
    tip: '后期优先打牌池已出2-3张的熟张(对手手中持有概率低)。本玩法虽不能被胡,但熟张更不易被对手碰杠借力,生张扣住不给对手加速',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },
  {
    id: 'b-kp-004', name: '红中局扣中张放边张',
    conditions: { phase: 'late', hongZhongMin: 0, shantenMax: 1 },
    recommendType: 'discard', priority: 7,
    tip: '红中局节奏快,后期中张(3-7)多被对手用于组顺。优先打1、9边张和字牌(对手做对子/字牌刻子的概率低于做顺子),扣住中张',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },
  {
    id: 'b-kp-005', name: '观察犹豫牌识别需求',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'defense', priority: 7,
    tip: '对手摸牌后犹豫再换牌(如摸进5万后打4万),说明需要5万附近的中张(3、6万)。这类牌要扣住,即使自己也用不上也别轻易打',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },
  {
    id: 'b-kp-006', name: '自家听牌快不必硬扣',
    conditions: { phase: 'late', isTenpai: true, shantenMax: 0 },
    recommendType: 'hu', priority: 9,
    tip: '若自己已听牌且番数不低,优先推进自摸,别为扣牌放弃自家进张。"进攻是最好的防守"——自己先自摸胡牌,就不用考虑扣牌了',
    source: 'builtin', category: '扣牌实战', createdAt: 0,
  },

  // ===== 十二、牌效评分(借鉴chen3kx/ai.js连接度算法) =====
  {
    id: 'b-pe-001', name: '舍牌按连接度排序',
    conditions: { phase: 'early', shantenMax: 3 },
    recommendType: 'discard', priority: 8,
    tip: '舍牌优先打"孤立牌"(与手牌无连接的牌)。连接度评分:同款+3,相邻+2,间隔2+1。得分最低的牌最该打,因为组搭潜力最小',
    source: 'builtin', category: '牌效', createdAt: 0,
  },
  {
    id: 'b-pe-002', name: '保留3-7中张潜力牌',
    conditions: { phase: 'early', shantenMax: 3 },
    recommendType: 'keep', priority: 7,
    tip: '3-7中张连接潜力最大:如5万可组345、456、567、45+6、5+67等多种搭子。1、9边张只能组12/89或13/79,潜力低。前期优先保留中张',
    source: 'builtin', category: '牌效', createdAt: 0,
  },
  {
    id: 'b-pe-003', name: '搭子重叠及时拆',
    conditions: { phase: 'mid', shantenMax: 2 },
    recommendType: 'discard', priority: 7,
    tip: '若同时有234万和345万,两个搭子重叠在3、4万。这种重叠搭子效率低,应拆掉一个,保留另一个,腾出位置给其他进张',
    source: 'builtin', category: '牌效', createdAt: 0,
  },
  {
    id: 'b-pe-004', name: '一向听优先保进张宽',
    conditions: { phase: 'mid', shantenMax: 1 },
    recommendType: 'keep', priority: 8,
    tip: '一向听时,优先选择"进张宽"的舍牌。如24万(可进1、4万成顺)vs 25万(只能进3万),24万进张面更宽,优先保留',
    source: 'builtin', category: '牌效', createdAt: 0,
  },
];

// 加载策略库(内置+用户上传)
export function loadStrategyLib(): StrategyCase[] {
  let userCases: StrategyCase[] = [];
  try {
    const raw = storageGet(STORAGE_KEY);
    if (raw) userCases = JSON.parse(raw);
  } catch { /* 忽略损坏数据 */ }
  return [...BUILTIN_CASES, ...userCases];
}

// 保存用户上传案例(增量追加)
export function saveUserCase(c: Omit<StrategyCase, 'id' | 'source' | 'createdAt'>): StrategyCase {
  const lib = loadUserCases();
  const newCase: StrategyCase = {
    ...c,
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: 'user',
    createdAt: Date.now(),
  };
  lib.push(newCase);
  storageSet(STORAGE_KEY, JSON.stringify(lib));
  return newCase;
}

function loadUserCases(): StrategyCase[] {
  try {
    const raw = storageGet(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return [];
}

// 删除用户案例
export function deleteUserCase(id: string): void {
  const lib = loadUserCases().filter((c) => c.id !== id);
  storageSet(STORAGE_KEY, JSON.stringify(lib));
}

// 策略匹配上下文
export interface StrategyContext {
  handCode: string;                // 手牌代码排序串
  phase: 'early' | 'mid' | 'late';
  hongZhongCount: number;          // 持红中数量
  pairCount: number;               // 手牌对子数
  meldsCount: number;              // 副露数量
  isTenpai: boolean;               // 是否听牌
  shanten: number;                 // 向听数
  seatIsDealer?: boolean;          // 是否庄家
}

// 判断单个案例是否匹配上下文
function matchCase(c: StrategyCase, ctx: StrategyContext): boolean {
  const cond = c.conditions;
  if (cond.phase !== ctx.phase) return false;
  if (cond.hongZhongCount !== undefined && cond.hongZhongCount !== ctx.hongZhongCount) return false;
  if (cond.hongZhongMin !== undefined && ctx.hongZhongCount < cond.hongZhongMin) return false;
  if (cond.hongZhongMax !== undefined && ctx.hongZhongCount > cond.hongZhongMax) return false;
  if (cond.pairCountMin !== undefined && ctx.pairCount < cond.pairCountMin) return false;
  if (cond.pairCountMax !== undefined && ctx.pairCount > cond.pairCountMax) return false;
  if (cond.meldsCount !== undefined && cond.meldsCount !== ctx.meldsCount) return false;
  if (cond.isTenpai !== undefined && cond.isTenpai !== ctx.isTenpai) return false;
  if (cond.shantenMax !== undefined && ctx.shanten > cond.shantenMax) return false;
  if (cond.handPattern && !ctx.handCode.includes(cond.handPattern)) return false;
  return true;
}

// 查询匹配的案例提示(供advisor引用)
// 返回优先级最高的1条提示;若无匹配返回null
export function getStrategyHint(ctx: StrategyContext): { tip: string; category: string; priority: number } | null {
  const lib = loadStrategyLib();
  const matched = lib.filter((c) => matchCase(c, ctx));
  if (matched.length === 0) return null;
  // 按优先级排序,取最高
  matched.sort((a, b) => b.priority - a.priority);
  const top = matched[0];
  return { tip: top.tip, category: top.category, priority: top.priority };
}

// 查询所有匹配案例(供详细展示)
export function getAllStrategyHints(ctx: StrategyContext): Array<{ tip: string; category: string; priority: number; name: string }> {
  const lib = loadStrategyLib();
  const matched = lib.filter((c) => matchCase(c, ctx));
  matched.sort((a, b) => b.priority - a.priority);
  return matched.map((c) => ({ tip: c.tip, category: c.category, priority: c.priority, name: c.name }));
}

// 统计策略库规模
export function getStrategyLibStats(): { builtin: number; user: number; total: number } {
  const userCases = loadUserCases();
  return {
    builtin: BUILTIN_CASES.length,
    user: userCases.length,
    total: BUILTIN_CASES.length + userCases.length,
  };
}

// 兼容旧接口: 简化上下文(仅phase+handCode)
// 已弃用,新代码请用getStrategyHint(完整上下文)
export function getStrategyHintSimple(ctx: { handCode: string; phase: 'early' | 'mid' | 'late'; seatIsDealer?: boolean }): { tip: string; weight: number } | null {
  const result = getStrategyHint({
    handCode: ctx.handCode,
    phase: ctx.phase,
    hongZhongCount: 0,
    pairCount: 0,
    meldsCount: 0,
    isTenpai: false,
    shanten: 2,
    seatIsDealer: ctx.seatIsDealer,
  });
  if (!result) return null;
  return { tip: result.tip, weight: result.priority };
}

// 批量导入案例(从JSON文本,兼容新旧格式)
export function importCases(jsonText: string): { ok: number; fail: number } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: 0, fail: 1 };
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  let ok = 0, fail = 0;
  for (const item of arr) {
    try {
      if (!item.name || !item.tip || !item.conditions) { fail++; continue; }
      saveUserCase({
        name: String(item.name),
        conditions: item.conditions,
        recommendType: item.recommendType || 'keep',
        recommendCode: String(item.recommendCode || ''),
        priority: Math.min(10, Math.max(1, Number(item.priority) || 5)),
        tip: String(item.tip),
        category: String(item.category || '用户案例'),
      });
      ok++;
    } catch { fail++; }
  }
  return { ok, fail };
}

// 导出全部案例为JSON文本(供下载/分享)
export function exportCases(): string {
  return JSON.stringify(loadStrategyLib(), null, 2);
}
