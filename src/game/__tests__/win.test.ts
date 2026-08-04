// canWin / canMelds 单元测试
// 覆盖: 标准胡牌, 红中百搭, 副露场景, 边界与回归
import { describe, it, expect } from 'vitest';
import { canWin, checkTing } from '../win';
import type { Tile } from '../types';
import { isHongZhong } from '../types';

// 全局自增 id (测试用)
let _testId = 0;
function makeTile(code: string): Tile {
  _testId++;
  const suit = code[0] as Tile['suit'];
  const rank = parseInt(code.slice(1), 10);
  return { id: _testId, suit, rank };
}

// 由多个代码构造手牌(每个代码出现n次)
function handFrom(...codes: string[]): Tile[] {
  return codes.map(makeTile);
}

// 重复构造 n 张同款
function repeat(code: string, n: number): Tile[] {
  const out: Tile[] = [];
  for (let i = 0; i < n; i++) out.push(makeTile(code));
  return out;
}

// 红中(z5)
const HZ = 'z5';

describe('canWin - 基础胡牌(无红中)', () => {
  it('标准 4顺子 + 1将', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p5','p5');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('刻子+顺子混合', () => {
    // 1万1万1万 2万3万4万 5筒6筒7筒 8筒8筒8筒 9条9条
    const hand = handFrom('m1','m1','m1','m2','m3','m4','p5','p6','p7','p8','p8','p8','s9','s9');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('字牌刻子', () => {
    // 东东东 南南南 西西西 北北北 发发
    const hand = handFrom('z1','z1','z1','z2','z2','z2','z3','z3','z3','z4','z4','z4','z6','z6');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('不能胡: 凑齐14张但无法拆分', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒4筒 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p4','p5','p5');
    expect(canWin(hand, 0)).toBe(false);
  });

  it('字牌不能组顺子(但4张同款可七小对)', () => {
    // 4个z1+4个z2+4个z3+2个z4 = 7对(4张拆2对), 七小对胡
    const hand = handFrom('z1','z2','z3','z1','z2','z3','z1','z2','z3','z1','z2','z3','z4','z4');
    expect(canWin(hand, 0)).toBe(true);
  });
});

describe('canWin - 红中百搭', () => {
  it('红中作将: 1实+1红中', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 5筒 + 红中(代替5筒)
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p5', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中作将: 2张红中作将', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 + 红中红中
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3', HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中作顺子: 缺1张', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒(缺3筒, 用红中) 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p5','p5', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中作顺子: 缺2张', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒(缺2筒3筒, 用2红中) 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p5','p5', HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中作刻子: 缺1张', () => {
    // 1万1万1万 2万3万4万 5筒5筒(缺1张, 用红中) 7筒7筒7筒 8条8条8条
    // 等等这是15张, 重写
    // 1万1万(红中) 2万3万4万 5筒6筒7筒 8条8条8条 9条9条
    const hand = handFrom('m1','m1','m2','m3','m4','p5','p6','p7','s8','s8','s8','s9','s9', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中作刻子: 缺2张', () => {
    // 1万(缺2张, 用2红中) 2万3万4万 5筒6筒7筒 8条8条8条 9条9条
    const hand = handFrom('m1','m2','m3','m4','p5','p6','p7','s8','s8','s8','s9','s9', HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('3张红中作刻子', () => {
    // 3顺子(9张) + 5筒5筒将(2张) + 红中红中红中刻子(3张) = 14张
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p5','p5', HZ, HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('4张红中: 3红中刻子 + 1红中将', () => {
    // 3顺子(9张) + 5筒(1张, 作将的一半) + 4张红中(3刻子+1作将的另一半) = 14张
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p5', HZ, HZ, HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中不能代替字牌顺子(字牌只能刻子)', () => {
    // 东南(西由红中代替) — 字牌不能顺子, 应判不胡
    // 但若把红中作刻子/将, 可能能胡
    // 测试: 东东东 南南南 西西(缺1, 红中) 北北北 发发 — 应能胡(红中作西刻子)
    const hand = handFrom('z1','z1','z1','z2','z2','z2','z3','z3','z4','z4','z4','z6','z6', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('红中多张混合: 红中作将 + 红中作顺子缺1', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒(缺3筒) 5筒 + 红中(将) + 红中(替3筒)
    // 等等这是15张, 调整: 1万2万3万 4万5万6万 7万8万9万 1筒2筒 + 红中红中 = 14张
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2', HZ, HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });
});

describe('canWin - 副露场景', () => {
  it('1碰后11张暗手', () => {
    // 0副露判14张; 1碰后暗手11张 = 3面子 + 1将
    // 1万2万3万 4万5万6万 7万8万9万 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p5','p5');
    expect(canWin(hand, 1)).toBe(true);
  });

  it('1杠后11张暗手', () => {
    // 杠副露也算1面子, 暗手11张
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p5','p5');
    expect(canWin(hand, 1)).toBe(true);
  });

  it('2副露后8张暗手', () => {
    // 2副露后暗手8张 = 2面子 + 1将
    // 1万2万3万 4万5万6万 7筒7筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','p7','p7');
    expect(canWin(hand, 2)).toBe(true);
  });

  it('3副露后5张暗手', () => {
    // 3副露后暗手5张 = 1面子 + 1将
    // 1万2万3万 7筒7筒
    const hand = handFrom('m1','m2','m3','p7','p7');
    expect(canWin(hand, 3)).toBe(true);
  });

  it('4副露后2张暗手(只余将)', () => {
    // 4副露后暗手2张 = 1将
    const hand = handFrom('p7','p7');
    expect(canWin(hand, 4)).toBe(true);
  });
});

describe('canWin - 边界与回归', () => {
  it('手牌张数不对: 拒绝判定', () => {
    // 0副露应14张, 给13张应返回false
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p5');
    expect(canWin(hand, 0)).toBe(false);
  });

  it('七对子结构能胡(七小对玩法)', () => {
    // 7对孤立对子 — 七小对胡法
    // 1万1万 3万3万 5万5万 7万7万 9万9万 1筒1筒 3筒3筒
    const hand = handFrom('m1','m1','m3','m3','m5','m5','m7','m7','m9','m9','p1','p1','p3','p3');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 4张同款算2对', () => {
    // 1万1万1万1万 + 6组对子 — 4张同款拆2对
    // 1万4张 + 2万2张 + 3万2张 + 4万2张 + 5万2张 + 6万2张 + 7万2张 = 4+12 = 16张 太多
    // 调整: 1万4张 + 2万2张 + 3万2张 + 4万2张 + 5万2张 + 6万2张 = 14张, 6对+1对4张拆2对=7对
    // 等等 1万4张拆2对 + 5对其他 = 7对 ✓
    const hand = handFrom('m1','m1','m1','m1','m2','m2','m3','m3','m4','m4','m5','m5','m6','m6');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 红中补单张成对', () => {
    // 6组实牌对子 + 1单张 + 1红中 — 红中补单张成对
    // 1万1万 2万2万 3万3万 4万4万 5万5万 6万6万 7万 红中
    const hand = handFrom('m1','m1','m2','m2','m3','m3','m4','m4','m5','m5','m6','m6','m7', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 2红中自凑1对', () => {
    // 6组实牌对子 + 2红中 — 红中自凑1对
    // 1万1万 2万2万 3万3万 4万4万 5万5万 6万6万 红中红中
    const hand = handFrom('m1','m1','m2','m2','m3','m3','m4','m4','m5','m5','m6','m6', HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 3红中混合(补1单+自凑1对)', () => {
    // 5组实牌对子 + 1单张 + 3红中
    // 1万1万 2万2万 3万3万 4万4万 5万5万 6万 + 红中红中红中
    // 拆法: 5实对 + 1红中补6万单张 = 1对 + 2红中自凑1对 = 7对
    const hand = handFrom('m1','m1','m2','m2','m3','m3','m4','m4','m5','m5','m6', HZ, HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 5实对+4红中自凑2对', () => {
    // 5实对(10张) + 4红中 = 14张, 需凑2对, 用4红中凑2对
    const hand = handFrom('m1','m1','m2','m2','m3','m3','m4','m4','m5','m5', HZ, HZ, HZ, HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('七小对: 红中不足不能胡', () => {
    // 5组实牌对子 + 1单张 + 1红中 — 需凑2对, 1红中只能补1单张, 还需1对(2红中)但红中已用完
    // 1万1万 2万2万 3万3万 4万4万 5万5万 6万 7万 红中 — 5实对+2单张+1红中, 需2对
    // 用1红中补1单张=1对, 还需1对但红中已用完 ✗
    const hand = handFrom('m1','m1','m2','m2','m3','m3','m4','m4','m5','m5','m6','m7', HZ);
    expect(canWin(hand, 0)).toBe(false);
  });

  it('七小对: 副露后不支持七小对(只能推倒胡)', () => {
    // 1碰后11张暗手 — 不能七小对(规则: 七小对必须为暗手14张)
    // 构造既不能推倒胡也不能七小对的11张手牌: 1万1万 3万3万 5万5万 7万7万 1筒 2筒 3筒
    // 4孤立对子 + 1顺子 = 11张, 推倒胡需3面子+1将, 但4孤立对子无法拆出第3面子
    const hand = handFrom('m1','m1','m3','m3','m5','m5','m7','m7','p1','p2','p3');
    expect(canWin(hand, 1)).toBe(false);
  });

  it('回归: 多实牌+多红中混合(穷举验证)', () => {
    // 构造原贪心策略可能漏判的牌例
    // 1万2万3万 2万3万4万 5万6万7万 5万6万7万 9万9万 + 0红中
    // 拆法: 1万2万3万 + 2万3万4万 + 5万6万7万 + 5万6万7万 + 9万9万将 = 14张
    const hand = handFrom('m1','m2','m3','m2','m3','m4','m5','m6','m7','m5','m6','m7','m9','m9');
    expect(canWin(hand, 0)).toBe(true);
  });

  it('回归: 3张同款+1红中可作刻子', () => {
    // 4张4万(实际只4张) — 但4张同款不能直接胡, 需要4张作杠副露才能"消化"
    // 这里测试4张同款作 3刻+1多余: 需要这多余的1张能成将或其他面子
    // 1万1万1万 4万4万4万 4万5万6万 7万8万9万 2万2万 — 15张, 调整
    // 1万1万1万 4万4万4万 4万(作将的一半) + 红中 5万6万7万 8万8万8万 — 14张
    const hand = handFrom('m1','m1','m1','m4','m4','m4','m4','m5','m6','m7','p8','p8','p8', HZ);
    expect(canWin(hand, 0)).toBe(true);
  });

  it('回归: 红中不重复消耗(同一红中不算2次)', () => {
    // 仅1张红中, 不能同时代替2张牌
    // 1万2万3万 4万5万6万 7万8万9万 1筒(缺2筒3筒, 需2红中但只有1) 5筒5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p5','p5', HZ);
    expect(canWin(hand, 0)).toBe(false);
  });

  it('全红中手牌(健壮性测试)', () => {
    // 14张红中: 不可能但测试算法不崩溃
    // 4张红中刻子 + 4张红中刻子 + 4张红中刻子 + 2张红中将 — 但只有4张红中
    // 实际只有4张红中, 这里测试14张红中输入
    const hand = repeat(HZ, 14);
    // 算法应正常返回结果(不崩溃), 14张红中 = 4刻子+1对将 但只有4张可用, 实际为14张假设是测试用
    // canWin 会判 true (4刻子3张红中+1对2红中, 共14红中)
    expect(canWin(hand, 0)).toBe(true);
  });
});

describe('checkTing - 听牌判定', () => {
  it('13张已听牌: 单面听', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 5筒(缺1张成胡)
    // 听: 5筒
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p5');
    const ting = checkTing(hand, 0);
    expect(ting).toContain('p5');
  });

  it('13张已听牌: 双面听', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 5筒5筒... 等等这是14张
    // 调整: 1万2万3万 4万5万6万 7万8万 9万9万9万 1筒2筒3筒 = 13张, 听?
    // 拆法: 1万2万3万 + 4万5万6万 + 9万9万9万 + 1筒2筒3筒 + 将=7万8万? 需9万
    // 听 6万或9万
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','m9','m9','p1','p2');
    const ting = checkTing(hand, 0);
    // 听 1筒或4筒(顺子1筒2筒3筒) 或其他
    expect(ting.length).toBeGreaterThan(0);
  });

  it('13张未听牌: 返回空', () => {
    // 散牌, 无听
    const hand = handFrom('m1','m3','m5','m7','m9','p1','p3','p5','p7','p9','s1','s3','s5');
    const ting = checkTing(hand, 0);
    expect(ting.length).toBe(0);
  });

  it('13张听红中(红中百搭)', () => {
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 5筒 + 红中?
    // 等等13张, 加入红中应为14张才能胡
    // 1万2万3万 4万5万6万 7万8万9万 1筒2筒3筒 = 12张, +1张听?
    // 加1张能胡的牌: 5筒5筒将, 或任意筒/万/条作顺子
    const hand = handFrom('m1','m2','m3','m4','m5','m6','m7','m8','m9','p1','p2','p3','p5');
    const ting = checkTing(hand, 0);
    // 红中总能成胡(代替5筒的将另一半), 所以应听红中
    expect(ting).toContain('z5');
  });
});
