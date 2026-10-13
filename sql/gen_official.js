// ============================================================
// gen_official.js —— 第四阶段：官网数据生成器（一次性脚本）
//
// 作用：把从官网接口抓下来的原始 JSON（sql/_official_raw/ 下 127 份）
//       和数据库导出的手工教学数据（our_heroes.tsv）合并，
//       生成新版 heroes_full.sql（127 英雄）和 skills_full.sql（全部技能）。
//
// 用法（Git Bash，在 sql/ 目录下执行）：
//   TMPW=$(cygpath -w /tmp)   # node 不认识 Git Bash 的 /tmp，转成 Windows 路径
//   node gen_official.js "$TMPW/herolist.json" "D:/VSCode-project/XM-01/sql/_official_raw" "$TMPW/our_heroes.tsv"
//
// 生成规则（对官网数据的每一条处理）：
//   英雄表：
//     id         —— 按官网 herolist 的展示顺序 1~127（官网英文名首字母序）
//     name       —— 官方中文名 name_loc
//     alias      —— 玩家俗称/旧译名（ALIASES 表，顿号分隔；官网没有，搜索框靠它搜到"剑圣""冰女"）
//     role       —— role_levels 9 个值 >0 的官方定位，顿号连接
//                   （数组顺序 = [核心,辅助,爆发,控制,打野,肉盾,逃生,推进,先手]）
//     pos        —— 号位：直接取 TSV 里的 pos 列；TSV 里空的走 POS_FALLBACK；
//                   官网没有号位概念，这是本教学站自创体系，单独存列
//     attr       —— primary_attr：0=全才 1=力量 2=敏捷 3=智力
//     attack     —— attack_capability：1=近战 2=远程
//     complexity —— 官方复杂度 1 简单 / 2 中等 / 3 困难
//     avatar     —— 官网头像 CDN 地址
//     intro      —— hype_loc（官网卡片宣传语）清洗 HTML 后作简介
//     pos/tips/items/counters —— 保留数据库导出的手工教学数据（TSV 用官网名直接匹配；
//                   TSV 缺英雄时用 NEW_HERO_DATA 里内置的兜底数据）
//   技能表：
//     基础技能 —— 每个英雄取 4 个：前 3 个"非先天、非新增"的普通技能(type=0) + 第 1 个大招(type=1)
//                 → 依次映射 Q/W/E/R。
//                 官网技能数 >4 的英雄（多形态、子技能、派生技能）按此规则自然裁掉多余技能；
//                 特例（规则取错按键的）在 BASE_OVERRIDES 里手动指定。
//     新增技能 —— ability_is_granted_by_shard / scepter = true 的 → D / F 键
//                 （魔晶 1400 金币 / 神杖 4200 金币，游戏里真的多一个技能位才占键）
//     强化技能 —— ability_has_shard / has_scepter = true 的 → 按键为空 '',
//                 技能名加 "·魔晶强化" / "·神杖强化" 后缀（沿用第三阶段约定）
//     skill_type —— 行为位掩码 behavior 含 2（被动）或 2048（光环）→ '被动'，否则 '主动'
//     描述清洗 —— desc_loc：去 HTML 标签、%% 还原成 %、%token% 用 special_values 首值替换
//
// 输出：heroes_full.sql、skills_full.sql（在 sql/ 目录下，覆盖旧文件）
//       同时打印一份"人工复核清单"（规则没取全 4 个技能的英雄、被裁掉的强化等）
// ============================================================

const fs = require('fs');
const path = require('path');

// ---------- 命令行参数 ----------
const [herolistPath, rawDir, ourTsvPath] = process.argv.slice(2);
if (!herolistPath || !rawDir || !ourTsvPath) {
  console.error('用法: node gen_official.js <herolist.json> <_official_raw目录> <our_heroes.tsv>');
  process.exit(1);
}

// ============================================================
// 一、常量表
// ============================================================

// 官网 9 种定位（role_levels 数组按下标一一对应）
const ROLE_NAMES = ['核心', '辅助', '爆发', '控制', '打野', '肉盾', '逃生', '推进', '先手'];

// 主属性编号 → 中文
// 官方枚举沿用 Dota 2 内部顺序：0=力量 1=敏捷 2=智力；3=全才（7.33 版本新机制：属性加成自由分配）
const ATTR_NAMES = { 0: '力量', 1: '敏捷', 2: '智力', 3: '全才' };

// 攻击方式编号 → 中文
const ATTACK_NAMES = { 1: '近战', 2: '远程' };

// 官网头像 CDN（内部英文名 = npc_dota_hero_ 后面的部分）
const AVATAR_PREFIX = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';

// 号位兜底表：TSV 里 pos 为空的英雄，按官网定位补一个教学号位
// （先跑一遍脚本看"复核清单"里缺号位的英雄，再填这张表）
const POS_FALLBACK = {};

// 玩家俗称 / 旧译名表：官方中文名 → 搜索别名（顿号分隔）
// 官网没有这份数据；来源是玩家社区约定叫法（剑圣/冰女/屠夫...）+ 官网历史译名（剃刀/刚背兽...）。
// 这些词会写进 hero.alias 列，搜索框输入俗称也能搜到英雄。
// 每行写法：'官方名': '俗称1、俗称2'（key 写错字会在运行时直接报错，防止静默失效）
const ALIASES = {
  '敌法师': '敌法、AM',
  '祸乱之源': '睡魔',
  '水晶室女': '冰女、CM',
  '卓尔游侠': '小黑、黑弓',
  '撼地者': '小牛、神牛、ES',
  '主宰': '剑圣、尤涅若',
  '米拉娜': '白虎、POM',
  '影魔': 'SF',
  '变体精灵': '水人',
  '幻影长矛手': '猴子、PL',
  '帕克': '精灵龙、仙女龙',
  '帕吉': '屠夫',
  '雷泽': '剃刀、电魂',
  '沙王': 'SK',
  '风暴之灵': '蓝猫',
  '小小': '石头人、山岭巨人',
  '复仇之魂': 'VS',
  '风行者': '风行、风女',
  '昆卡': '船长',
  '莉娜': '火女',
  '莱恩': '恶魔巫师',
  '暗影萨满': '小Y、萨满',
  '斯拉达': '大鱼人',
  '潮汐猎人': '潮汐',
  '力丸': '隐刺、SA',
  '修补匠': 'TK',
  '狙击手': '火枪、矮子',
  '瘟疫法师': '死灵法、NEC',
  '痛苦女王': '女王、QOP',
  '虚空假面': '虚空、FV',
  '冥魂大帝': '骷髅王、大帝',
  '死亡先知': 'DP',
  '幻影刺客': '幻刺、PA',
  '帕格纳': '骨法',
  '圣堂刺客': '圣堂、TA',
  '冥界亚龙': '毒龙',
  '露娜': '月骑',
  '龙骑士': '龙骑、DK',
  '戴泽': '暗牧',
  '发条技师': '发条、机器人',
  '拉席克': '老鹿',
  '自然先知': '先知、法里奥',
  '噬魂鬼': '小狗、食尸鬼',
  '黑暗贤者': '黑贤、兔子',
  '克林克兹': '骨弓、骷髅射手',
  '全能骑士': '全能、OK',
  '魅惑魔女': '小鹿',
  '哈斯卡': '神灵、神灵武士',
  '暗夜魔王': '夜魔',
  '育母蜘蛛': '蜘蛛、母蜘蛛',
  '赏金猎人': '赏金',
  '编织者': '蚂蚁',
  '杰奇洛': '双头龙',
  '蝙蝠骑士': '蝙蝠',
  '幽鬼': 'SPE',
  '末日使者': '末日、大恶魔',
  '远古冰魄': '冰魂、AA',
  '熊战士': '拍拍熊、拍拍',
  '裂魂人': '白牛',
  '矮人直升机': '飞机',
  '炼金术士': '炼金',
  '祈求者': '卡尔',
  '沉默术士': '沉默',
  '殁境神蚀者': '黑鸟、OD',
  '酒仙': '熊猫、熊猫酒仙',
  '暗影恶魔': '毒狗',
  '独行德鲁伊': '德鲁伊、熊德',
  '混沌骑士': '混沌、CK',
  '米波': '地卜师',
  '树精卫士': '大树、树',
  '食人魔魔法师': '蓝胖',
  '不朽尸王': '尸王',
  '拉比克': '大魔导师',
  '干扰者': '萨尔',
  '司夜刺客': '小强',
  '娜迦海妖': '小娜迦、娜迦',
  '光之守卫': '光法、老头',
  '艾欧': '小精灵、IO',
  '维萨吉': '死灵飞龙、死灵龙',
  '斯拉克': '小鱼人',
  '美杜莎': '大娜迦、蛇发女妖',
  '巨魔战将': '巨魔',
  '半人马战行者': '人马',
  '马格纳斯': '猛犸',
  '钢背兽': '刚背兽、屁股',
  '巨牙海民': '海民、雪人',
  '天怒法师': '天怒',
  '亚巴顿': '死骑、地狱领主',
  '上古巨神': '大牛',
  '军团指挥官': '军团、LC',
  '灰烬之灵': '火猫',
  '大地之灵': '土猫',
  '恐怖利刃': 'TB、魂守',
  '神谕者': '神谕',
  '工程师': '炸弹人、炸弹',
  '寒冬飞龙': '冰龙、冬龙',
  '天穹守望者': '电狗、泽特',
  '孽主': '深渊领主',
  '齐天大圣': '大圣',
  '石鳞剑士': '滚滚',
  '邪影芳灵': '花仙子',
  '天涯墨客': '墨客',
  '虚无之灵': '紫猫',
  '电炎绝手': '奶奶、老奶奶',
  '森海飞霞': '松鼠、小松鼠',
  '破晓辰星': '破晓',
  '獸': '原始兽、野兽',
  '琼英碧灵': '穆尔塔、琼英',
};

// 官网新增的 4 个英雄：初始导入时数据库里没有，号位 + 教学文案手写
// （首次跑过流水线后这些数据会进数据库、随 TSV 导出，这里就成了兜底）
const NEW_HERO_DATA = {
  '米拉娜': {
    pos: '4/5号位',
    tips: '米拉娜（白虎）是"游走辅助"的典型：一、月神之箭射程越远眩晕越久，躲在阴影里放冷箭，配合队友的控制技能"接箭"命中率更高；二、跳跃可以躲开飞行中的弹道技能，被追时往树林里跳；三、大招群体隐身是开团/撤退神器，开大前先跟队友说好一起走。新手先把"射箭"练准。',
    items: '静谧之鞋、原力法杖、洞察烟斗、阿哈利姆神杖',
    counters: '克制：脆皮、落单英雄（冷箭）；怕：真视宝石/粉（破隐身）、冲脸强控',
  },
  '复仇之魂': {
    pos: '4/5号位',
    tips: '复仇之魂（VS）是最简单直接的辅助之一：一、魔法箭是指向性眩晕（点谁晕谁，不会空），线上稳定先手；二、恐怖波动减敌人护甲还能开视野，开团前先放一发；三、大招移形换位可以把对面核心换进我方人堆，也能把被集火的队友换出来——注意别把自己换进绝境；四、被动让她死后还能继续放技能和输出几秒，阵亡换掉对面核心也不亏。',
    items: '静谧之鞋、原力法杖、微光披风、洞察烟斗',
    counters: '克制：脆皮核心（换位先手）；怕：换位后自己落单被集火',
  },
  '酒仙': {
    pos: '3号位',
    tips: '酒仙（熊猫）是劣势路肉盾先手的代表：一、雷霆一击减速+让敌人打空，是换血神技；二、醉拳被动提供闪避和暴击，站得住又能打；三、大招"元素分离"分裂成三个元素熊猫（土、风、火），各带控制技能，本体分裂期间不会死——团战先放减速，再分裂进场搅乱阵型。记住：大招期间先操作风熊猫吹起对面核心。',
    items: '先锋盾、闪烁匕首、阿哈利姆神杖、黑皇杖',
    counters: '克制：依赖普攻的近战核心（闪避+减速）；怕：魔法爆发、清场大招',
  },
  '朗戈': {
    pos: '4/5号位',
    tips: '朗戈是带"演奏"机制的新辅助：一、动人之舐可以把队友拉回身边（救人或开团），还能净化负面状态；二、蛙力千钧的范围伤害+减速用来消耗和断后；三、大招"两栖狂想曲"开启后技能栏会切换成三首乐曲：疾步生风（加速）、巨腹闪电战（伤害）、大屿灵药（回复），根据战局切歌；四、先天技能"安可"让给队友施放的增益也作用于自己。新手先练"拉人"的时机。',
    items: '静谧之鞋、原力法杖、微光披风、洞察烟斗',
    counters: '克制：贴脸近战（拉人风筝）；怕：沉默（按不出技能）、集火',
  },
};

// 被裁技能强化行的丢弃名单：这些技能和"已展示的同名技能"是同一技能的另一形态
// （如 属性变换（力量获取）vs 属性变换（敏捷获取）），强化行内容重复，裁掉不丢信息。
// 其余被裁技能（祈求者的派生法术、凯的鸟形态技能等）带独有强化文本，保留。
const DROP_UPGRADES = new Set([
  '变体精灵/属性变换（力量获取）',
  '杰奇洛/液态冰',
  '巨魔战将/旋风飞斧（近战）',
]);

// 官网数据里的"死占位符"人工改写表：
// 这些 %token% 在 herodata 和 abilitydata 两个接口的 special_values 里都查不到定义
// （官网数据源本身的缺口），且这些行大多整段都是独有信息，不能整行丢弃。
// 处理方式：在清洗前做"原文子串 → 改写后"替换——
// 只改写含死占位符的短语（数值用"数秒/多个/一定"等诚实泛化，不编造具体数字），
// 其余正常 token 照常解析。key 格式：英雄名/技能名/魔晶|神杖
const REPLACE_MANUAL = {
  // 主宰神杖：剑刃风暴期间自动攻击（接口缺攻击间隔数值）
  '主宰/剑刃风暴/神杖': [
    ['主宰每%attack_interval%秒对作用的敌人发动一次攻击', '主宰每隔数秒就会对作用范围内的敌人发动一次攻击'],
  ],
  // 雷泽魔晶：静电连接附带减速（接口缺减速系数）
  '雷泽/静电连接/魔晶': [
    ['数值为连接生效时%move_speed_factor%倍的攻击力窃取量', '减速效果与攻击力窃取量成正比'],
  ],
  // 沙王魔晶：尾刺中心范围触发腐尸毒爆炸（接口缺伤害百分比）
  '沙王/尾刺/魔晶': [
    ['造成%caustic_damage_pct%%%伤害', '造成额外百分比伤害'],
  ],
  // 暗影萨满魔晶：禽戏额外小鸡的数量与持续（接口缺这两个数值）
  '暗影萨满/禽戏/魔晶': [
    ['额外产生%chicken_illusions%个不可控的小鸡，持续%ally_voodoo_duration%秒', '额外产生数只不可控的小鸡，持续数秒'],
  ],
  // 术士神杖：暗言术作用于额外单位（接口缺范围/数量/衰减三个数值）
  '术士/暗言术/神杖': [
    ["现在暗言术会施加给%cast_aoe%范围内%additional_targets%个额外单位，以英雄优先。额外单位的<font color='#07d738'>治疗</font>和伤害量减少%secondary_reduction%%%", '现在暗言术会额外施加给作用范围内的多个单位（以英雄优先），但额外单位的治疗和伤害量会降低'],
  ],
  // 剧毒术士魔晶：唯一一条官方没翻译的文本（英文），顺手译成中文
  '剧毒术士/毒刺/魔晶': [
    ['Whenever Poison Sting is applied, it deals extra damage equal to %debuff_dmg%%% of the attacker\'s base damage for every debuff the enemy has from Venomancer or a unit he controls.', '每当毒刺施加时，会根据敌人身上来自剧毒术士或其控制单位的负面状态数量，额外造成攻击者基础攻击力一定百分比的伤害。'],
  ],
  // 哈斯卡神杖：沸血之矛散射数量（接口缺数量）
  '哈斯卡/沸血之矛/神杖': [
    ['额外发射%multishot_targets%支长矛', '额外发射多支长矛'],
  ],
  // 殁境神蚀者神杖：奥术天球弹跳伤害衰减（接口缺衰减百分比）
  '殁境神蚀者/奥术天球/神杖': [
    ['造成的伤害降低%bounce_damage_reduction%%%', '造成的伤害会有所降低'],
  ],
  // 上古巨神魔晶：自然秩序叠加削甲削魔抗（接口缺 4 个数值）
  '上古巨神/自然秩序/魔晶': [
    ['每停留%tick_rate%秒，他们的护甲就会降低%armor_per_tick%点，魔法抗性降低%magic_resistance_per_tick%%%。叠加效果最多可叠加%max_stacks%次', '停留时间越长，护甲和魔法抗性降低越多，叠加效果可反复堆叠'],
  ],
  // 玛尔斯神杖：护身甲盾两侧士兵数量（接口缺数量）
  '玛尔斯/护身甲盾/神杖': [
    ['共产生%soldier_count%名无敌的士兵', '共产生数名无敌的士兵'],
  ],
  // 琼英碧灵魔晶：越界技能吸血与技能增强窃取（接口缺两个百分比）
  '琼英碧灵/越界/魔晶': [
    ['获得%spell_lifesteal%%%技能吸血', '获得技能吸血'],
    ['都会永久获得%spell_amp_steal%%%技能增强', '都会永久获得技能增强'],
  ],
};

/** 应用人工改写：key 命中时逐条替换原文子串，未命中（含片段找不到）直接抛错，防止改版后失效 */
function applyManual(heroName, abilityName, source, raw) {
  const pairs = REPLACE_MANUAL[heroName + '/' + abilityName + '/' + source];
  if (!pairs || !raw) return raw;
  let t = raw;
  for (const [from, to] of pairs) {
    if (!t.includes(from)) {
      throw new Error('REPLACE_MANUAL 片段未命中: ' + heroName + '/' + abilityName + '/' + source + ' ← ' + from.slice(0, 50));
    }
    t = t.replace(from, to);
  }
  return t;
}

// 基础技能特例：官网数组顺序和真实按键对不上的英雄，手动指定 Q/W/E/R 顺序（用官方技能名）
const BASE_OVERRIDES = {
  // 巨魔战将：官网数组把"狂战士之怒"（W 键形态切换）排在热血战魂后面，按数组取会错
  '巨魔战将': ['旋风飞斧（远程）', '狂战士之怒', '热血战魂', '战斗专注'],
};

// ============================================================
// 二、工具函数
// ============================================================

/** SQL 字符串转义：单引号翻倍、反斜杠转义（数据里有英文缩写时不炸） */
function sqlStr(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * 官网描述清洗：
 *   1. 统一换行（详情页 CSS 是 pre-wrap，保留换行能显示段落）
 *   2. %% → 字面 %（先换成占位符 \u0000 防止被 token 替换吃掉）
 *   3. %token% → special_values 里同名项的"第 1 个数值"（技能 1 级时的取值）
 *   4. 去掉所有 HTML 标签（<font>、<b>、<br/> 等）
 */
/**
 * 在 special_values 里按名字找第 1 个数值。
 * 官网占位符有坑：
 *   1. 大小写不一致（%abilitycooldown% 的定义名却是 AbilityCooldown）
 *   2. 复合占位符（%bonus_AbilityCooldown% = 前缀 bonus_ + 真实名 AbilityCooldown，
 *      意为"AbilityCooldown 这项加成值"）
 *   3. 魔晶/神杖强化文本里的数值藏在 values_shard / values_scepter 里
 *      （values_float 存的是基础值，加成值的基础往往是 0，直接取会显示"0 秒/0%"）
 * 所以查找顺序：精确 → 忽略大小写 → 去掉 bonus_ 前缀再精确/忽略大小写。
 *
 * @param mode null | 'shard' | 'scepter'：取哪个数值来源
 *        'shard'   —— 魔晶强化文本，优先 values_shard[0]
 *        'scepter' —— 神杖强化文本，优先 values_scepter[0]
 *        其余（技能基础描述）—— values_float[0] / values_int[0]
 *        对应数组为空时回退到基础值（强化没改这个数值的情况）
 */
function findValue(specialValues, token, mode) {
  const list = specialValues || [];
  const firstNum = v => {
    let num;
    if (mode === 'shard' && v.values_shard && v.values_shard.length) num = v.values_shard[0];
    else if (mode === 'scepter' && v.values_scepter && v.values_scepter.length) num = v.values_scepter[0];
    else if (v.values_float && v.values_float[0] !== undefined) num = v.values_float[0];
    else if (v.values_int && v.values_int[0] !== undefined) num = v.values_int[0];
    return num === undefined ? null : Number(num).toString(); // 120.0 → "120"
  };
  const t = token.toLowerCase();
  const direct = list.find(v => v.name === token);
  if (direct) return firstNum(direct);
  const ci = list.find(v => v.name.toLowerCase() === t);
  if (ci) return firstNum(ci);
  const stripped = token.replace(/^bonus_/, '');
  if (stripped !== token) {
    const s = t.replace(/^bonus_/, '');
    const direct2 = list.find(v => v.name === stripped);
    if (direct2) return firstNum(direct2);
    const ci2 = list.find(v => v.name.toLowerCase() === s);
    if (ci2) return firstNum(ci2);
  }
  return null;
}

function cleanText(raw, specialValues, mode) {
  if (!raw) return '';
  let t = String(raw).replace(/\r\n/g, '\n');
  // ⚠️ 顺序很重要：先替换 %token%，再把 %% 还原成字面 %。
  // 官网常写 "%damage%%%"（token 后面紧跟字面 %），
  // 如果先处理 %% 会把 token 的右括号 % 吃掉（%damage%|%% 中左边那个 %% 先被匹配），
  // 导致 token 永远匹配不上。
  t = t.replace(/%([a-zA-Z0-9_]+)%/g, (m, token) => {
    const val = findValue(specialValues, token, mode);
    if (val === null) return m; // 查不到就保留原文，方便复核清单发现
    return val;
  });
  t = t.replace(/%%/g, '%');
  t = t.replace(/<[^>]*>/g, '');
  t = t.replace(/[ \t]+/g, ' ');
  return t.trim();
}

/** 技能类型：behavior 位掩码 & 2 = 被动，& 2048 = 光环（光环也自动生效，按被动算） */
function typeOf(a) {
  return (a.behavior & 2) || (a.behavior & 2048) ? '被动' : '主动';
}

/** 判断技能是否"魔晶/神杖新增"（游戏里真的多一个技能位） */
function grantedBy(a) {
  if (a.ability_is_granted_by_shard) return 'shard';
  if (a.ability_is_granted_by_scepter) return 'scepter';
  return null;
}

// ============================================================
// 三、读取输入数据
// ============================================================

console.log('=== 读取输入数据 ===');

// 3.1 官网英雄列表（顺序即官网展示顺序）
const herolist = JSON.parse(fs.readFileSync(herolistPath, 'utf8')).result.data.heroes;
console.log(`herolist.json: ${herolist.length} 名英雄`);
console.log('前 8 名顺序:', herolist.slice(0, 8).map(h => h.name_loc + '(' + h.name + ')').join(', '));

// 3.2 逐个读取官方全量数据
const official = new Map(); // 官方名 → 英雄对象
for (const h of herolist) {
  const file = path.join(rawDir, 'hero_' + h.id + '.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')).result.data.heroes[0];
  official.set(data.name_loc, data);
}
console.log(`官方全量数据: ${official.size} 份`);

// 3.2.1 校验 ALIASES 的 key 必须是官网名（key 写错字会让俗称搜索静默失效，这里直接报错）
for (const k of Object.keys(ALIASES)) {
  if (!official.has(k)) {
    throw new Error('ALIASES 里的英雄名在官网数据中不存在（写错字了？）: ' + k);
  }
}
console.log(`俗称别名表: ${Object.keys(ALIASES).length} 名英雄配置了俗称/旧名`);

// 3.3 手工教学数据（name, pos, tips, items, counters 制表符分隔）
//     由一键流水线从数据库导出（见 update_all.sh 第 2 步），名字已是官网中文名，可直接匹配
const oldRows = fs.readFileSync(ourTsvPath, 'utf8').split(/\r?\n/).filter(l => l.includes('\t'));
const oldMap = new Map(); // 英雄名 → 教学数据行
for (const line of oldRows) {
  const [name, pos, tips, items, counters] = line.split('\t');
  oldMap.set(name, { pos, tips, items, counters });
}
console.log(`手工教学数据: ${oldMap.size} 名英雄`);

// ============================================================
// 四、生成英雄行
// ============================================================

console.log('=== 生成英雄行 ===');

const review = {
  baseNot4: [],           // 基础技能没取到 4 个的英雄（需要人工看）
  droppedUpgrades: [],    // 被裁掉的强化行里"内容重复"而丢弃的
  keptDroppedUpgrades: [],// 被裁掉但仍保留强化行的（独有信息）
  noPos: [],              // TSV 里 pos 为空、POS_FALLBACK 也没有的英雄
  longIntro: [],       // 简介超 500 字（会被数据库截断）
  emptyRole: [],       // 官方定位全为 0 的英雄
  longSkillName: [],   // 技能名超 50 字
  maxDescLen: 0,       // 技能描述最长字数（决定 skill_desc 列要多宽）
  descLenHero: '',     // 最长描述的出处
  grantedBoth: [],     // 一个技能既是魔晶新增又是神杖新增（异常）
  tokenMiss: [],       // %token% 没在 special_values 里查到的占位符
  overrideMiss: [],    // BASE_OVERRIDES 里手写的技能名在官网数据里查不到
};

const heroRows = []; // 每项 { id, ...全部列 }
let newId = 0;

for (const h of herolist) {
  newId += 1;
  const d = official.get(h.name_loc);
  const name = d.name_loc;

  // ---- role：官网 9 定位 ----
  const role = d.role_levels
    .map((lv, i) => (lv > 0 ? ROLE_NAMES[i] : ''))
    .filter(Boolean)
    .join('、');
  if (!role) review.emptyRole.push(name);

  // ---- attr / attack / complexity ----
  const attr = ATTR_NAMES[d.primary_attr] || '全才';
  const attack = ATTACK_NAMES[d.attack_capability] || '近战';
  const complexity = d.complexity;

  // ---- avatar：CDN 地址 ----
  const avatar = AVATAR_PREFIX + d.name.replace(/^npc_dota_hero_/, '') + '.png';

  // ---- slug：英雄英文内部名（第六阶段新增列）
  // 和头像文件名同源（axe/sven/crystal_maiden/nevermore...），
  // 教学页详情链接用，数据重灌也不会变
  const slug = d.name.replace(/^npc_dota_hero_/, '');

  // ---- intro：官网卡片宣传语（hype_loc），清洗 HTML ----
  let intro = cleanText(d.hype_loc, null);
  if (!intro) intro = cleanText(d.npe_desc_loc, null); // 极少数英雄没有 hype
  if (intro.length > 500) review.longIntro.push(name + '(' + intro.length + '字)');

  // ---- pos / tips / items / counters：数据库导出的教学数据按名直取；缺的用内置兜底 ----
  const old = oldMap.get(name);
  let pos, tips, items, counters;
  if (old) {
    pos = old.pos || (POS_FALLBACK[name] || '');
    if (!pos) review.noPos.push(name);
    tips = old.tips; items = old.items; counters = old.counters;
  } else if (NEW_HERO_DATA[name]) {
    // 兜底：导出数据漏了这个英雄时用内置手写数据（4 个官网新增英雄各有一份）
    const n = NEW_HERO_DATA[name];
    pos = n.pos; tips = n.tips; items = n.items; counters = n.counters;
  } else {
    throw new Error('英雄 ' + name + ' 既不在教学数据 TSV 也不在 NEW_HERO_DATA，请先补齐数据！');
  }

  // ---- alias：玩家俗称/旧译名（ALIASES 表，没配的存空字符串） ----
  const alias = ALIASES[name] || '';

  heroRows.push({ id: newId, name, slug, alias, role, pos, attr, attack, complexity, avatar, intro, tips, items, counters });
}
console.log(`英雄行: ${heroRows.length}`);

// ============================================================
// 五、生成技能行
// ============================================================

console.log('=== 生成技能行 ===');

// 英雄名 → 新 id（第 4 步已按官网顺序分配 1~127），技能行要挂到对应英雄上
const idByName = new Map(heroRows.map(r => [r.name, r.id]));

const skillRows = []; // { heroId, key, type, source, name, desc, heroName }
let skillId = 0;

for (const h of herolist) {
  const d = official.get(h.name_loc);
  const heroId = idByName.get(d.name_loc);
  const abilities = d.abilities;

  // ---- 5.1 基础 4 技能：Q/W/E/R ----
  // 候选池：非先天、非魔晶/神杖新增的普通技能（type=0）
  const pool = abilities.filter(a =>
    !a.ability_is_innate &&
    !a.ability_is_granted_by_shard &&
    !a.ability_is_granted_by_scepter &&
    a.type === 0
  );
  // 大招：第 1 个 type=1 且不是新增的技能（先天的大招也认——祈求者的"元素祈唤"就是先天+大招）
  const ult = abilities.find(a =>
    a.type === 1 && !a.ability_is_granted_by_shard && !a.ability_is_granted_by_scepter
  );
  let base = pool.slice(0, 3);
  if (ult) base.push(ult);

  // 特例覆盖：BASE_OVERRIDES 手写的顺序优先
  if (BASE_OVERRIDES[d.name_loc]) {
    const want = BASE_OVERRIDES[d.name_loc];
    base = want.map(nm => abilities.find(a => a.name_loc === nm)).filter(Boolean);
    if (base.length !== want.length) {
      review.overrideMiss.push(d.name_loc + ': ' + want.filter(nm => !abilities.some(a => a.name_loc === nm)).join('/'));
    }
  }

  if (base.length !== 4) review.baseNot4.push(d.name_loc + '(' + base.length + '个: ' + base.map(a => a.name_loc).join('/') + ')');

  const baseNames = new Set(base.map(a => a.name_loc));
  const KEYS = ['Q', 'W', 'E', 'R'];

  base.forEach((a, i) => {
    skillId += 1;
    skillRows.push({
      heroId: heroId, key: KEYS[i] || '', type: typeOf(a), source: '基础',
      name: a.name_loc, desc: cleanText(a.desc_loc, a.special_values), heroName: d.name_loc,
    });
    if (a.name_loc.length > 50) review.longSkillName.push(d.name_loc + '/' + a.name_loc);
    if (cleanText(a.desc_loc, a.special_values).length > review.maxDescLen) {
      review.maxDescLen = cleanText(a.desc_loc, a.special_values).length;
      review.descLenHero = d.name_loc + '/' + a.name_loc;
    }
  });

  // ---- 5.2 魔晶/神杖"新增技能"：D/F 键 ----
  for (const a of abilities) {
    const g = grantedBy(a);
    if (!g) continue;
    // 异常：一个技能同时是魔晶和神杖新增（正常不会发生）
    if (a.ability_is_granted_by_shard && a.ability_is_granted_by_scepter) review.grantedBoth.push(d.name_loc + '/' + a.name_loc);
    skillId += 1;
    skillRows.push({
      heroId: heroId, key: g === 'shard' ? 'D' : 'F', type: typeOf(a),
      source: g === 'shard' ? '魔晶' : '神杖',
      name: a.name_loc, desc: cleanText(a.desc_loc, a.special_values), heroName: d.name_loc,
    });
    if (cleanText(a.desc_loc, a.special_values).length > review.maxDescLen) {
      review.maxDescLen = cleanText(a.desc_loc, a.special_values).length;
      review.descLenHero = d.name_loc + '/' + a.name_loc;
    }
  }

  // ---- 5.3 魔晶/神杖"强化已有技能"：按键为空 '' ----
  // 只给"页面上会展示的技能"生成强化行：
  //   基础 4 技能 + 先天技能（先天技能官方也出神杖/魔晶强化，行名加"先天·"前缀说明来源）
  for (const a of abilities) {
    if (grantedBy(a)) continue; // 新增技能自身不再生成强化行（它俩不同时出现）
    const shown = baseNames.has(a.name_loc) || a.ability_is_innate;
    if (!shown) {
      // 被裁掉的技能（多形态英雄的副技能等）：
      //   DROP_UPGRADES 里的是"同名技能另一形态"，强化文本重复 → 直接丢弃；
      //   其余保留（祈求者派生法术、凯鸟形态技能等，强化文本是独有信息）
      if (!(a.ability_has_shard || a.ability_has_scepter)) continue;
      if (DROP_UPGRADES.has(d.name_loc + '/' + a.name_loc)) {
        review.droppedUpgrades.push(d.name_loc + '/' + a.name_loc + '(与已展示技能重复，已丢弃)');
        continue;
      }
      review.keptDroppedUpgrades.push(d.name_loc + '/' + a.name_loc);
    }
    const prefix = a.ability_is_innate ? '先天·' : '';
    if (a.ability_has_shard && a.shard_loc) {
      skillId += 1;
      // applyManual：先处理"死占位符"改写，再做常规清洗（见 REPLACE_MANUAL 注释）
      // 第 3 个参数 'shard'：数值优先从 values_shard 取（魔晶加成值，见 findValue 注释）
      const desc = cleanText(applyManual(d.name_loc, a.name_loc, '魔晶', a.shard_loc), a.special_values, 'shard');
      skillRows.push({
        heroId: heroId, key: '', type: typeOf(a), source: '魔晶',
        name: prefix + a.name_loc + '·魔晶强化', desc, heroName: d.name_loc,
      });
      if (desc.length > review.maxDescLen) { review.maxDescLen = desc.length; review.descLenHero = d.name_loc + '/' + a.name_loc + '(魔晶)'; }
    }
    if (a.ability_has_scepter && a.scepter_loc) {
      skillId += 1;
      // 'scepter'：数值优先从 values_scepter 取（神杖加成值）
      const desc = cleanText(applyManual(d.name_loc, a.name_loc, '神杖', a.scepter_loc), a.special_values, 'scepter');
      skillRows.push({
        heroId: heroId, key: '', type: typeOf(a), source: '神杖',
        name: prefix + a.name_loc + '·神杖强化', desc, heroName: d.name_loc,
      });
      if (desc.length > review.maxDescLen) { review.maxDescLen = desc.length; review.descLenHero = d.name_loc + '/' + a.name_loc + '(神杖)'; }
    }
  }
}
console.log(`技能行: ${skillRows.length}`);

// %token% 未命中的统计：在所有 desc_loc / shard_loc / scepter_loc 里找残留的 %xxx%
// shard/scepter 文本先过一遍 applyManual（死占位符改写），剩下的才是真正没处理的
for (const h of herolist) {
  const d = official.get(h.name_loc);
  for (const a of d.abilities) {
    const checks = [
      ['desc', a.desc_loc, null],
      ['魔晶', applyManual(d.name_loc, a.name_loc, '魔晶', a.shard_loc), 'shard'],
      ['神杖', applyManual(d.name_loc, a.name_loc, '神杖', a.scepter_loc), 'scepter'],
    ];
    for (const [src, txt, mode] of checks) {
      if (!txt) continue;
      for (const m of String(txt).matchAll(/%([a-zA-Z0-9_]+)%/g)) {
        const token = m[1];
        if (findValue(a.special_values, token, mode) === null && !review.tokenMiss.includes(token + '(' + d.name_loc + '/' + a.name_loc + '/' + src + ')')) {
          review.tokenMiss.push(token + '(' + d.name_loc + '/' + a.name_loc + '/' + src + ')');
        }
      }
    }
  }
}

// ============================================================
// 六、写出 heroes_full.sql
// ============================================================

console.log('=== 写出 SQL 文件 ===');

const outDir = __dirname;
const now = new Date().toISOString().slice(0, 10);

let heroSql = `-- ============================================================
-- heroes_full.sql —— 英雄全量数据（第四阶段：对齐 dota2.com 官网）
-- 生成日期：${now}（由 sql/gen_official.js 生成，请勿手改本文件）
--
-- 数据来源：
--   https://www.dota2.com/datafeed/herolist?language=schinese （127 名英雄列表）
--   https://www.dota2.com/datafeed/herodata?language=schinese&hero_id=N （逐英雄全量）
--   tips / items / counters 沿用本站手工教学数据（6 个改名英雄自动平移，4 个新增英雄新写）
--   alias 俗称/旧名列（剑圣→主宰、冰女→水晶室女...）来自生成器的 ALIASES 表
--   slug 英文内部名列（axe/sven/crystal_maiden...）来自官网内部名（与头像文件名同源）
--
-- 执行前请先跑 upgrade_v4.sql（给 hero 表加 pos/attr/attack/complexity/avatar 五列）、
-- upgrade_v5.sql（给 hero 表加 alias 俗称列，搜索框搜俗称要用）和
-- upgrade_v6_slug.sql（给 hero 表加 slug 唯一标识列，教学页详情链接用）
-- 执行方式（乱码坑务必照抄）：
--   mysql -u root -p --default-character-set=utf8 < heroes_full.sql
--   ⚠️ 必须用 utf8（不是 utf8mb4）！MySQL 26.7 客户端对 utf8mb4 参数有 bug，会静默按 latin1 导入导致中文乱码
--
-- 本文件会：TRUNCATE hero 表 → 重新插入 127 名英雄（id 1~127 = 官网英文名首字母顺序）
-- ============================================================

SET NAMES utf8mb4;
USE dota_guide;

TRUNCATE TABLE hero;
-- 重置自增计数器：TRUNCATE 本身会重置，这里显式写一次保险
ALTER TABLE hero AUTO_INCREMENT = 1;

INSERT INTO hero (id, name, slug, alias, \`role\`, pos, attr, attack, complexity, avatar, intro, tips, items, counters) VALUES
`;

for (const r of heroRows) {
  heroSql += `-- ${r.id}. ${r.name}（${r.attr} / ${r.attack} / 复杂度${r.complexity} / ${r.pos || '未定号位'}）${r.alias ? '【俗称：' + r.alias + '】' : ''}\n`;
  heroSql += `(${r.id}, '${sqlStr(r.name)}', '${sqlStr(r.slug)}', '${sqlStr(r.alias)}', '${sqlStr(r.role)}', '${sqlStr(r.pos)}', '${sqlStr(r.attr)}', '${sqlStr(r.attack)}', ${r.complexity}, '${sqlStr(r.avatar)}', '${sqlStr(r.intro)}', '${sqlStr(r.tips)}', '${sqlStr(r.items)}', '${sqlStr(r.counters)}'),\n`;
}
// 最后一行去掉逗号
heroSql = heroSql.replace(/,\n$/, ';\n\n');

heroSql += `-- ============ 校验：应看到 127 行 ============
SELECT COUNT(*) AS hero_total FROM hero;
-- 主属性分布：力量 36 / 敏捷 35 / 智力 34 / 全才 22
SELECT attr, COUNT(*) FROM hero GROUP BY attr;
-- 复杂度分布
SELECT complexity, COUNT(*) FROM hero GROUP BY complexity;
-- 俗称别名覆盖率（约 100 名英雄有俗称/旧名）
SELECT COUNT(*) AS alias_total FROM hero WHERE alias <> '';
-- slug 唯一标识覆盖率（应 127 人都有、无重复）
SELECT COUNT(*) AS slug_total FROM hero WHERE slug <> '';
`;

fs.writeFileSync(path.join(outDir, 'heroes_full.sql'), heroSql, 'utf8');
console.log(`已写出 heroes_full.sql（${heroRows.length} 名英雄，${(heroSql.length / 1024).toFixed(0)} KB）`);

// ============================================================
// 七、写出 skills_full.sql
// ============================================================

let skillSql = `-- ============================================================
-- skills_full.sql —— 技能全量数据（第四阶段：对齐 dota2.com 官网）
-- 生成日期：${now}（由 sql/gen_official.js 生成，请勿手改本文件）
--
-- 数据来源：官网 herodata 接口的 abilities 数组（desc_loc / shard_loc / scepter_loc）
--
-- 按键规则（沿用第三阶段约定）：
--   Q/W/E/R —— 基础技能 + 大招
--   D —— 魔晶（1400 金币）"新增"技能（游戏里真的多一个技能位）
--   F —— 神杖（4200 金币）"新增"技能
--   ''（空）—— 魔晶/神杖只"强化已有技能"的强化行，不占新按键，排在最后
-- 技能名后缀：·魔晶强化 / ·神杖强化；"先天·"开头表示强化的是先天技能
-- 描述：官网 desc_loc 清洗后（HTML 标签去掉、%token% 已替换成对应数值、%% 还原为 %；
--       魔晶/神杖强化文本的数值取自 values_shard / values_scepter 的加成值）
--
-- 执行前请先跑 upgrade_v4.sql（skill_desc 加宽到 1000，官网描述比手写的长）
-- 执行方式（乱码坑务必照抄）：
--   mysql -u root -p --default-character-set=utf8 < skills_full.sql
--   ⚠️ 必须用 utf8（不是 utf8mb4）！原因见 heroes_full.sql 头部说明
--
-- 本文件会：TRUNCATE hero_skill 表 → 重新插入全部技能（hero_id 对应 heroes_full.sql 的 1~127）
-- ============================================================

SET NAMES utf8mb4;
USE dota_guide;

TRUNCATE TABLE hero_skill;
ALTER TABLE hero_skill AUTO_INCREMENT = 1;

INSERT INTO hero_skill (hero_id, skill_key, skill_type, skill_source, skill_name, skill_desc) VALUES
`;

// 按英雄分组输出，每个英雄一块注释，方便新手对照
let lastHero = null;
for (const s of skillRows) {
  if (s.heroName !== lastHero) {
    skillSql += `\n-- ---------- ${s.heroName}（hero_id=${s.heroId}） ----------\n`;
    lastHero = s.heroName;
  }
  skillSql += `(${s.heroId}, '${sqlStr(s.key)}', '${s.type}', '${s.source}', '${sqlStr(s.name)}', '${sqlStr(s.desc)}'),\n`;
}
skillSql = skillSql.replace(/,\n$/, ';\n\n');

skillSql += `-- ============ 校验：应看到 ${skillRows.length} 行 ============
SELECT COUNT(*) AS skill_total FROM hero_skill;
-- 按键分布（第四阶段官方数据，仅供参考；D/F 数量 = 官网魔晶/神杖新增技能总数）
SELECT skill_key, COUNT(*) FROM hero_skill GROUP BY skill_key ORDER BY FIELD(skill_key, 'Q', 'W', 'E', 'R', 'D', 'F', '');
-- 来源分布：基础 / 魔晶 / 神杖
SELECT skill_source, COUNT(*) FROM hero_skill GROUP BY skill_source;
`;

fs.writeFileSync(path.join(outDir, 'skills_full.sql'), skillSql, 'utf8');
console.log(`已写出 skills_full.sql（${skillRows.length} 行技能，${(skillSql.length / 1024).toFixed(0)} KB）`);

// ============================================================
// 八、打印人工复核清单
// ============================================================

console.log('\n=========== 人工复核清单 ============');
console.log('【1】基础技能没取到 4 个的英雄（需人工确认按键映射）:');
review.baseNot4.forEach(x => console.log('  - ' + x));
if (!review.baseNot4.length) console.log('  （无）');

console.log('\n【2】被裁掉的技能还带着魔晶/神杖强化:');
console.log('  保留强化行（独有信息）:');
review.keptDroppedUpgrades.forEach(x => console.log('    - ' + x));
if (!review.keptDroppedUpgrades.length) console.log('    （无）');
console.log('  丢弃强化行（与已展示技能重复）:');
review.droppedUpgrades.forEach(x => console.log('    - ' + x));
if (!review.droppedUpgrades.length) console.log('    （无）');

console.log('\n【3】没有号位信息（TSV 里 pos 为空且 POS_FALLBACK 未覆盖）:');
review.noPos.forEach(x => console.log('  - ' + x));
if (!review.noPos.length) console.log('  （无）');

console.log('\n【4】其他异常:');
console.log('  简介超500字:', review.longIntro.join(', ') || '无');
console.log('  官方定位全空:', review.emptyRole.join(', ') || '无');
console.log('  技能名超50字:', review.longSkillName.join(', ') || '无');
console.log('  双来源新增技能:', review.grantedBoth.join(', ') || '无');
console.log('  BASE_OVERRIDES 未命中:', review.overrideMiss.join(', ') || '无');
console.log('  %token% 未命中:', review.tokenMiss.join(', ') || '无');
console.log('  技能描述最长: ' + review.maxDescLen + ' 字（' + review.descLenHero + '）');
