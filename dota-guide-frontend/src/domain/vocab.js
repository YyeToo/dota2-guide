// ============================================================
// domain/vocab.js —— 词汇表：后端的中文值 → 界面上的标识
// ============================================================
//
// 这个文件只回答一类问题：**后端返回的那个中文字符串，在界面上该长什么样**。
// 它不含 Vue、不含 DOM、不发请求 —— 全是纯映射和纯查表函数，
// 所以能被 `node --test` 直接跑（见 test/vocab.test.js）。
//
// 为什么需要它？
// 这些映射以前**根本不存在**，它们是散在模板里的字符串拼接：
//
//     :class="'attr-' + hero.attr"      :class="'stripe-' + hero.attr"
//     :class="'attr-btn-' + a"          :class="'attr-text-' + hero.attr"
//
// 同一条"值 → CSS"的对应关系被写成 4 套命名，其中 `.attr-力量` 那一套还在
// HomeView 和 HeroDetailView 里逐字重复了一份（两个文件都是 scoped，互相看不见）。
// 更要命的是：**这条 interface 是隐式的** —— 数据库里多一个属性值，
// 模板照常拼出一个类名，CSS 里没有对应规则，页面静默降级成无样式，不报错、不留痕。
//
// 搬到这里之后，未知值走哪条路是**能读出来、也能测出来**的：
// 每个函数都有显式的兜底分支，配套的 CSS 也一定有一条规则接着它。

// ---------- 主属性 ----------

/**
 * 主属性中文值 → 英文 token。
 *
 * token 就是 CSS 认识的那个标识，颜色规则写在 assets/main.css 里：
 *     [data-token="str"] { --attr: var(--str); … }
 * 四个消费方（色条 / 徽章 / 页签 / 数值文字）现在都读同一组 `--attr-*` 变量，
 * 各自的**形状**留在自己的 scoped 样式里 —— 颜色只有一份定义。
 */
const ATTR_TOKENS = {
  力量: 'str',
  敏捷: 'agi',
  智力: 'int',
  全才: 'all'
}

/**
 * 所有查表函数遇到没见过的值时统一返回它。
 * CSS 里有 `[data-token="unknown"]` 接着，所以页面会变成显眼的中性色，
 * 而不是"什么都没有"—— 前者能一眼看出数据变了，后者只能靠肉眼比对设计稿。
 */
export const UNKNOWN_TOKEN = 'unknown'

export function attrToken(attr) {
  return ATTR_TOKENS[attr] || UNKNOWN_TOKEN
}

// ---------- 技能分类 ----------

/**
 * 技能分类 → 徽章文案和样式类（见 HeroDetailView 的 .badge-* 规则）。
 *
 * 魔晶的"新增"和"强化"共用同一个徽章：对新手来说"这个技能要买魔晶"才是重点，
 * 是不是多占了一个技能位，看它落在哪个面板就知道了。
 * 未知分类返回 null，模板 v-if 直接不渲染，不会画出个空徽章。
 */
const CATEGORY_BADGES = {
  魔晶新增: { text: '魔晶', cls: 'badge-shard' },
  魔晶强化: { text: '魔晶', cls: 'badge-shard' },
  神杖新增: { text: '神杖', cls: 'badge-scepter' },
  神杖强化: { text: '神杖', cls: 'badge-scepter' }
}

export function categoryBadge(skill) {
  return CATEGORY_BADGES[skill.skillCategory] || null
}

// ---------- 技能按键 ----------

// 有专属色条的三个按键：R 大招（金）、D 魔晶新增（紫）、F 神杖新增（蓝）
const BAR_KEYS = ['r', 'd', 'f']
// 确认过、就是没有色条的三个：Q/W/E 是普通技能，"无色条"本身就是视觉语义，不是漏了
const PLAIN_KEYS = ['q', 'w', 'e']

/**
 * 技能卡左侧色条的类名。**必须分三支**：
 *
 *   R/D/F  → skill-r / skill-d / skill-f（各自的战术色）
 *   Q/W/E  → skill-plain（确认无色条，CSS 里显式 content: none）
 *   其余值 → skill-unknown（中性色兜底）
 *
 * 第一支和第三支不能合并：合并了 Q/W/E 就会凭空多出一条灰条（视觉回归）。
 * 第二支和第三支也不能合并：合并了，官网改键位时新按键会静默变成"和普通技能一样"，
 * 看不出异常。三支的判断都写在这里，比散在模板里拼字符串好验证。
 */
export function skillBarClass(skill) {
  const k = (skill.skillKey || '').toLowerCase()
  if (BAR_KEYS.includes(k)) return 'skill-' + k
  if (PLAIN_KEYS.includes(k)) return 'skill-plain'
  return 'skill-unknown'
}
