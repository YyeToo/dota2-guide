<!--
  进阶页（纯静态页面，不需要请求后端）
  内容：教学要点，总结自久远Vortex《DOTA2 0-5分钟运营教学》《DOTA2 5-10分钟运营教学》
        《DOTA2 10分钟开始的运营方向教学》《DOTA2 装备解构分析教学》四篇 PDF，
        按主题分四个部分左右滑动切换
  入口：页头导航"进阶"（在"新手须知"右边），路由 /advanced
  第二批视觉美化（2026-10-06）：
    - 前三部分（0-5 / 5-10 / 10 分钟后）要点列表改"纵向时间轴"：
      左侧金色渐变竖线，序号圆标钉在线上
    - 第四部分（装备）改双列卡片网格，和前三部分的时间轴区分开
  视觉统一（2026-10-13）：只换了类名、删掉了搬去 main.css 的样式。
    - 页签 .tab-btn → 全局 .chapter-tab（和新手须知页同一套章节导航页签）
    - .banner / .meta-line / .panel / .panel h2 / .h-icon / .panel p / .panel strong
      的样式收进 main.css 的"四页共用"一节，本页不再各写一份
  滚动动效（2026-10-13）：**本页不加任何滚动动效**。
-->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Library } from 'lucide-vue-next'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'
// 聚光灯判据："这批矩形里，中心离视口中心最近的是谁" —— 纯数字进出，可单测
import { pickFocusKey } from '../domain/focus'

const route = useRoute()
const router = useRouter()

// 当前显示的页签：'laning' = 0-5 分钟，'midgame' = 5-10 分钟，
// 'lategame' = 10 分钟后，'items' = 装备解构分析
// 滑动效果靠 .tab-track 的 transform: translateX 位移（见样式区注释）

// ---------- 页签与 URL 同步（?part=2） ----------
// 好处：刷新页面、把链接发给别人，打开后仍停留在同一个页签
const PART_ORDER = ['laning', 'midgame', 'lategame', 'items']

// 从 URL 的 ?part=N 读出页签名（N 是 1 开始的序号）：
// 合法值（1~4）→ 对应页签；缺失或非法 → 第一个页签
function partFromQuery() {
  const n = parseInt(route.query.part)
  return PART_ORDER[n - 1] || PART_ORDER[0]
}

const activePart = ref(partFromQuery())

// 轨道位移量：N 个面板横向并排，第 n 个面板进视野需要位移 -(n × 100/N)%。
// ⚠️ translateX 的百分比相对"轨道自身宽度"计算（不是容器宽度），
//    所以每个面板的位移量 = 100 ÷ 面板数（4 个面板 = 25%）。
//    以后加减面板只需改这个数组 + 样式区两个宽度，位移量自动算好
const trackShift = computed(() => -(PART_ORDER.indexOf(activePart.value) * (100 / PART_ORDER.length)))

// 切换页签：改 activePart + 把页签序号写进 URL。
// 用 router.replace 而不是 push：不产生新的历史记录，
// 否则每点一次页签，浏览器的"后退"都得先退一遍页签。
function switchPart(name) {
  activePart.value = name
  router.replace({ query: { part: PART_ORDER.indexOf(name) + 1 } })
}

// 浏览器前进/后退改变 ?part 时，反向同步页签状态
watch(
  () => route.query.part,
  () => { activePart.value = partFromQuery() }
)

// ==================== 滚动聚光灯（焦点动画） ====================
//
// ★★★ 从这一行起、到本文件下面 "进阶教学要点" 那一行为止，是进阶页的
//     "滚动身份"，整段**不要动** ★★★
//   2026-10-13 全站加滚动动效时，这一页是唯一被划为"不改"的：它已经有自己的
//   滚动语言（聚光灯），再叠一层入场淡入/视差，两种动效会在同一条卡片上打架 ——
//   比如 v-reveal 挂在 .adv-item 上会覆盖它的 transition，聚光灯的换人动画
//   直接失效（这就是 main.css 里 .card 的 transition 必须整条抄全的原因）。
//   要改这段，只能连着 .adv-item 的 transition 一起改，别当成普通样式调整。
//
// 需求（用户）：每条建议都是同质卡片，一屏三四条，读者不知道该看哪条，
//   希望"做个动画让注意力在一条建议上"。
// 实现：滚动时把【离视口中心最近】的那条建议点亮（金色发光边框 + 序号圆标变实心金
//   + 一次扫过的光带），其余条目压暗半透明。焦点换人时才播一次动画，播完静止，
//   不做持续的呼吸/闪烁——保持全站"克制"的动效基调。
//
// ⚠️ 为什么不用 IntersectionObserver（更常见的"滚动监听"写法）？
//   IO 只在【条目进出视口】时回调。但"离中心最近的那条"换人，发生在
//   两条目中心连线的中点越过视口中心线的那一瞬间——那一刻两条目都【完整地】
//   待在视口里，没有任何条目进出，IO 根本不会触发。
//   后果：焦点更新滞后半条卡片的距离，而且【滚动停下来之后不会再有任何事件】
//   来纠正，焦点会一直停在错的那条上。
//   所以改成直接监听 scroll 事件 + rAF 节流重算：scroll 覆盖"焦点换人"的全过程，
//   每帧只读当前面板那 10~13 条的 getBoundingClientRect，开销可忽略
//   （布局没变时浏览器直接返回缓存值，不会触发重排）。

const rootEl = ref(null)                       // 绑在页面根元素上，用来批量收集条目 DOM
const partItems = {}                           // 部分名 → 该部分的条目 DOM 数组（如 laning: [...]）

// 焦点键：把"第几部分 + 第几条"拼成一个字符串，模板里比对这个字符串就知道该不该点亮。
// 为什么不直接存元素或下标？——四个 v-for 共用一个状态，
// 光看下标无法区分是哪个部分的第 3 条，加上部分名才唯一。
function fk(part, i) {
  return `${part}-${i}`
}

// 初始焦点 = 当前面板的第一条。
// 预置而不是留空：否则首屏渲染时 48 条全是"非焦点"（都压暗），会闪一下
const focusedKey = ref(fk(activePart.value, 0))

let rafId = 0        // requestAnimationFrame 的句柄，0 表示当前没有排队中的重算
let sliding = false  // 页签左右滑动动画进行中——期间忽略重算，否则焦点会乱跳
let slideTimer = 0   // 滑动结束的定时器句柄

// 全量重算焦点：挑出当前面板里"离视口中心最近"的那一条。
// 只遍历不做任何 DOM 写入，写状态交给 Vue 的响应式去批量更新（避免强制同步布局）
function updateFocus() {
  if (sliding) return

  // ⚠️ 只遍历【当前面板】的条目，不遍历全部 48 条。
  // 为什么必须按面板过滤、不能靠"元素在不在视口里"来判断？
  //   四个面板是横向并排的（靠 translateX 滑动），隐藏面板在几何上【确实落在
  //   视口横坐标范围内】——比如窗口 1440px 宽时，第二个面板从 x≈876 开始，
  //   它整个都在视口右边之外吗？并没有，它的 rect 依然报告 left=876 < 1440。
  //   父级 .tab-slider 的 overflow: hidden 只裁掉"绘制"，不会改变
  //   getBoundingClientRect() 的返回值，所以按坐标过滤根本筛不掉隐藏面板，
  //   会出现"正在读第一部分，焦点却亮着第二部分某条"的错乱。
  //   按"这条属于哪个面板"过滤才是准的，顺带还省掉 3/4 的布局读取。
  const items = partItems[activePart.value]
  if (!items || !items.length) return

  const center = window.innerHeight / 2   // 视口中心线（顶栏 sticky 会让真实视觉中心略低，
                                          // 但差值远小于一条卡片的高度，不影响判定）

  // 读 DOM 的活留在这里（getBoundingClientRect 只有视图层干得了），
  // 读完立刻把元素降级成 {key, top, bottom} 三个纯数字，"谁离中心最近"交给
  // domain/focus.js 判。原来的写法把读坐标、比距离、写状态揉在同一个 for 循环里，
  // 那个形状**只能靠手动滚动页面来验证**；现在判据是纯函数，node --test 直接断言。
  const rects = items.map((el) => {
    const r = el.getBoundingClientRect()
    return { key: el.dataset.fk, top: r.top, bottom: r.bottom }
  })

  // 一个候选都没有（比如滚到了页面最底部的来源面板区域，当前面板已全部划出屏幕）
  // 时返回 null，保持现状 —— 不要把焦点"跳"到屏幕外的条目上，
  // 那会让最后一条无缘无故地亮着
  const bestKey = pickFocusKey(rects, center)
  if (bestKey) focusedKey.value = bestKey
}

// rAF 节流：滚动一次会连发几十个 scroll 事件（每个事件之间布局可能没变），
// 这里保证"一帧最多重算一次"，重算永远发生在浏览器即将绘制之前
function requestUpdate() {
  if (rafId) return   // 已经排队了，本帧不用再排
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateFocus()
  })
}

onMounted(() => {
  // 要等 DOM 渲染完才能拿到条目元素。
  // nextTick 后立刻算一次：浏览器"恢复上次滚动位置"（刷新页面时的 scroll restoration）
  // 会让页面一进来就停在中间，不主动算一次的话焦点会错在第一部分第一条
  nextTick(() => {
    // 一次遍历按面板分好组：焦点键前缀就是面板名（'laning-3' → 'laning'）
    rootEl.value.querySelectorAll('.adv-item[data-fk]').forEach((el) => {
      const part = el.dataset.fk.split('-')[0]
      if (!partItems[part]) partItems[part] = []
      partItems[part].push(el)
    })
    updateFocus()
  })

  // passive: true —— 声明"这个监听器不会调 preventDefault"，浏览器可以不等回调结束就滚动，滚动更跟手。
  // capture: true —— 用捕获阶段监听，保证任何滚动容器（不只是 window）滚动时都能收到
  window.addEventListener('scroll', requestUpdate, { passive: true, capture: true })
  // 窗口尺寸变化会改变视口中心线和条目位置，必须重算
  window.addEventListener('resize', requestUpdate)
})

// 页签切换时（点页签 switchPart 和浏览器前进/后退两条路径都会改 activePart，
// 所以监听 activePart 而不是写在 switchPart 里，一处覆盖两条路）：
//   ① 滑动动画进行中先"钉"在新面板第一条上，并忽略滚动重算——
//      滑动是靠 transform 位移实现的，中途每个条目都在动，不屏蔽的话焦点会疯狂乱跳
//   ② 动画结束后主动重算一次。为什么不能等 scroll 事件？——四个面板条目数不同
//      （10/12/11/13），切换后文档总高度会变，浏览器可能调整 scrollTop 并触发 scroll，
//      但也可能不触发，不能依赖它
watch(activePart, (part) => {
  sliding = true
  focusedKey.value = fk(part, 0)
  clearTimeout(slideTimer)
  slideTimer = window.setTimeout(() => {
    sliding = false
    requestUpdate()
  }, 400)   // 400 = 滑动动画 0.3s + 一点余量，确保动画真的结束了再放开
})

// 组件卸载（切到别的路由）时必须清理，否则监听器/定时器会一直挂着——
// 它们闭包引用着这个组件的状态，不清就是内存泄漏
onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestUpdate, { capture: true })
  window.removeEventListener('resize', requestUpdate)
  cancelAnimationFrame(rafId)
  clearTimeout(slideTimer)
})

// ==================== 进阶教学要点（通用教学内容） ====================
// 总结自久远Vortex《DOTA2 0-5分钟运营教学》《DOTA2 5-10分钟运营教学》
// 《DOTA2 10分钟开始的运营方向教学》《DOTA2 装备解构分析教学》四篇 PDF
// （B站空间 https://space.bilibili.com/3845087）
//
// 为什么放在前端常量里、而不是存数据库？
//   这份内容是"通用教学"——127 名英雄共享同一份，和具体英雄无关。
//   存数据库的话每行都要重复存一遍，纯冗余，更新还不方便；
//   前端常量改一处全站生效，是最合适的方案。
//   如果以后想做"每个英雄专属的进阶技巧"，再考虑给 hero 表加列。
//
// 每条 { title 要点名, desc 一句话精华 }，模板里 v-for 渲染
const LANING_TIPS = [
  { title: '养成思考习惯', desc: '从 10 个英雄敲定就开始想：这段时间我最需要的是什么？对线的本质是双方对固定资源点（兵线/野点/莲花）的博弈，具体打法只是表象。' },
  { title: '兵线是核心资源', desc: '优势路兵线自然交汇在己方一塔前（安全补刀）；劣势路要想办法把线"回拉"到己方塔前。一波兵里多个远程兵必定推线，是低分"控不住线"的头号原因。第一波兵全吃刚好到 2 级——抢 2 是边路最重要的节点。' },
  { title: '拉野的本质：消兵 + 回线', desc: '用野点损耗兵线让对方少拿经验（消兵），让兵线交汇点离己方更近（回线）。5 号位出门必带 2 个真眼控野点；兵线已在优一塔前完美位置时，别画蛇添足去拉小野。' },
  { title: '莲花是推线方的奖励', desc: '3 分钟刷新莲花（回 125 血蓝）。线推过去的一方才有空去吃——所以 3 分钟前有对应的推线运营，理解了本质就能预判推线时间点。' },
  { title: '赏金符不是对线内容', desc: '只给不到 50 块钱且远离兵线，为它长时间离开线上就是舍本逐末。它通常是中单补瓶、或辅助游走点眼的顺带奖励。' },
  { title: '状态管理：吃树续航、大药修整', desc: '吃树每秒回 7 血且不能叠加，只适合日常续航；大残时只有大药能救，但要提前买（信使送达要时间）。实在没状态，打空蓝"死回去"补满也行——但 TP 有 80 秒 CD，别把 TP 一起死了。' },
  { title: '进攻要有依据', desc: '补给断档（对面没带药）、等级优势（抢 2/3 叫杀）、野点竞争、3 分钟莲花争夺——在这些时间点前主动压血，比无脑对拼高效得多。' },
  { title: '勾兵：弱势路的妥协手段', desc: '对线完全打不过时，4 号位把对方兵线勾到己方一二塔之间制造安全交汇点——本质是示弱 + 互肥，而且要持续勾，不是勾一波就完事。' },
  { title: '游走前想清楚两件事', desc: '①兵线位置能让核心单混吗？②核心扛得住对方双人压线吗？做不到就走，就是"逛街辅助"（小强/米拉娜/帕吉被骂的根源）。' },
  { title: '模块化训练', desc: '单机练补刀控线：5 分钟一组，正补全收 + 兵线控在河道中间。复盘流程：分路判断（练到 10 秒内）→ 分析英雄特点 → 跳固定时间点检查（1 分钟野点/到 2 时间/3 分钟莲花）→ 回忆比对 → 参考高分同英雄录像。' }
]

// 5-10 分钟运营要点（总结自《DOTA2 5-10分钟运营教学》）
// 和 0-5 分钟不同：5 分钟入夜后"继续对线"从默认动作变成了你的选择之一，
// 团队开始围绕 6 分钟功能符 / 7 分钟经验神龛 / 一塔 / 传送门这些新资源点做多人联动
const MIDGAME_TIPS = [
  { title: '入夜 = 对线的分界点', desc: '5 分钟入夜，视野从 1800 码骤降到 800 码，出门的假眼同时消失。从此"继续对线"是你的选择而不是默认动作——进攻、防守、换路，都是选项。' },
  { title: '6 分钟功能符 = 团队节奏的起点', desc: '中单 5 分钟出头到 6、6 分钟正好拿符，"大招 + 神符"两张手牌就位——这就是"节奏中"的本质。团队要提前铺好河道视野、辅助站另一个符点；辅助去中之前先安顿边路（拉好野/换血死回去 TP 中），否则 3 号位要挂机一分钟。' },
  { title: '7 分钟经验神龛', desc: '直接决定双辅助 10 分钟能否到 6（辅助没 6 就是团队累赘）。抢对方神龛只有两条路：攻劣一塔打赢团后开抢，或趁对方少人时偷。守方要留 TP、留人，防对面偷家。' },
  { title: '一塔的真正价值', desc: 'TP 支援点 + 把兵线顶出去解锁兵线视野（线野双收的前提）。优一塔易攻难守（离二塔远 + 传送门），高分局 5 分钟后常互换优一塔；中一塔最重要（丢了大半野区失守）；劣一塔保经验神龛，优先级最低。' },
  { title: '传送门 = 换线的唯一手段', desc: '联通两条边路，让边路换线成为可能。注意 75 点蓝耗——辅助坐门前一定要管好蓝量。1 号位到 6 后也可以带大招坐门去另一路换人头收益。' },
  { title: '中单离开中路先算账', desc: '离开中路的收益（人头/拔塔/团队优势）必须大于成本（兵线损失 + 塔血 + 可能丢塔）。三个判断锚点：团队能赢团拔塔、去边路必拿至少一个人头、支援能速战速决。' },
  { title: '5 分钟投石车：被忽视的关键牌', desc: '第一辆投石车 5 分钟刷新：近千血、魔抗高——停在塔前能卡住兵线位置（对劣势路致命）；打塔 3 秒 60 血，保车 + 两波兵基本能拿下一塔。5 分钟集合推塔前先想想这辆车。' },
  { title: '3 号位保经济', desc: '辅助离开后保本吃线：封小野、拉大野、断线、塔后勾兵、回撤打野都行——最下策是挂机站着等线过来。核心原则：一定不能中断经济获取。' },
  { title: '1 号位的两条路', desc: '能高效打野 → 规划打钱路线（动线规划：最短路径串联野点 + 兵线，别折返跑）；不能打野 → 坐传送门带大招支援另一路换人头收益，别只会赖线补刀当地缚灵。' },
  { title: '辅助 = 团队的眼睛', desc: '报点是单方面输出信息（屏蔽 9 个人也能报，让团队看到就有价值）。沟通三阶段：①自己有清晰方向 ②把想法表达出来 ③队友反馈。视野原则就一句：哪里需要视野，就在哪里点眼。' },
  { title: '辅助见缝插针吃资源', desc: '10 分钟要到 6。吃"团队弃置资源"（中单游走时顶中线、推塔时蹭塔后经验），先帮团队开源、再顺手吃资源，没人反感——和"毒瘤抢钱"的区别就在这。' },
  { title: '5-10 分钟复盘流程', desc: '看 10 分钟经济（正常发育核心 4000 上下，3000 出头就有问题）→ 跳固定时间点（6/8/10 分钟符、7 分钟经验符、野点屯矿）→ 回忆团队方向并检查结果 → 对照概念分析 → 回忆当时自己的想法 → 参考高分同英雄录像。' }
]

// 10 分钟开始的运营方向要点（总结自《DOTA2 10分钟开始的运营方向教学》）
// 10 分钟后全队到 6、关键装出炉，团队具备基本作战能力——
// 作者强调：10 分钟的团和 30 分钟的团逻辑本质相同，所以 10 分钟以后不再按时间段切分
const LATEGAME_TIPS = [
  { title: '胜利的本质：摧毁基地', desc: 'DOTA 的胜利条件有且只有一个——推掉对方基地，KDA 永远只是过程数据。一切运营沿着一条链走：获取资源 → 关键等级/关键装 → 破外塔 → 上高地 → 推基地。' },
  { title: '10 分钟后即入正轨', desc: '全队到 6 + 关键装出炉 = 具备基本作战能力。核心思考问题：我们的强势期需要满足什么条件？该攻还是守？该打还是该刷？在哪里进行？' },
  { title: '复盘定位三招', desc: '①20 分钟经济条：核心低于该英雄高分平均（可查 dota2protracker.com）就是打钱出问题；②关键装时间：PA 狂战 14-15 分钟、4 号位跳刀 15 分钟，慢了说明之前运营有问题；③经济面板上的人头堆=团战时间点，拉到那看录像。' },
  { title: '明确团战关键英雄', desc: '对方最依赖的手段就是我们最要打击的方向——关键英雄不一定是核心：守塔强辅助（剧毒/光法）、高输出脆皮核心（TB）、有大招的保护型辅助（神谕）。决策流程：分析对方运作机制 → 识别关键英雄 → 评估己方针对能力 → 定策略。' },
  { title: '团战视野：就地布眼', desc: '预判团战位置提前点眼；开雾遭遇战破雾后立刻就地插眼——这眼之后 100% 被反也值，它就是为了打赢这波团。开雾出门手里一定带眼。' },
  { title: '站位 = 英雄理解的反馈', desc: '要抗伤害站前面；不能第一个死站后面；容易被找到就躲得再靠后、用装备补（跳刀/以太/微光/绿杖）。分析站位是否合理：你的作用诉求和实际位置是否匹配。' },
  { title: '进攻一定有诉求', desc: '把"看着打"扔进垃圾桶。手牌理论：大招、神符、多人就位就是强力手牌，牌打完了就等下一波。常见诉求：6/8/10 分钟符点团（多人同行）、14 分钟经验神龛（12 分钟中单带符攻劣势路）、抓人（预判打钱路线 + 开雾）。' },
  { title: '占区、扫图、二塔', desc: '占区=站住对方区域刷（要够肉够威慑，兽王式）；扫图=绝对强势期推土机式平推，碾碎对方资源循环；二塔本身不值钱，拔它是为了把对方兵线压到高地门口、锁死活动空间。' },
  { title: '肉山盾与逼高', desc: '优势方一定要打盾——防减员、给容错，杜绝对方拼命一搏翻盘。带盾逼高：上高逼对方 TP 回防就立刻撤退，用盾的时间压制；别把逼高打成真上高，盾被耗掉就丧失压制力。' },
  { title: '痛苦魔方：赢团后再打', desc: '20 分钟刷新，一般要 4 个人打（3 人会出事），打完状态大残必须避战。收益是给团队最穷的两个人之一发魔晶（对部分辅助相当于"辅助的肉山盾"）——所以时机是：赢团杀人后，或对方被扫烂时。' },
  { title: '劣势：换区避战 + 放弃资源', desc: '对方控区英雄只能站一片区（兽王站你家半区，他家半区必空）——换区刷钱，但千万别在对方野区接大团。核心打钱路线里做变数（换区/蹲一会）：地图没人=可能开雾，关键装快好时最危险。' },
  { title: '拉扯空间 = 获取信息', desc: '辅助顶危险线/去危险区，用一次死亡换团队一段安全时间（但别用"打信息"掩盖白给）；带线打散——兵线是劣势方的探照灯，还能逼对方回防减员；守不住的二塔放掉，用塔换发育时间。' },
  { title: '复盘模块化', desc: '按 5 分钟/白天黑夜切模块；检查 20 分钟经济 + 关键装时间 → 跳时间点 → 对照概念分析 → 回忆当时想法 → 参考高分同英雄录像。' }
]

// 装备解构分析要点（总结自《DOTA2 装备解构分析教学》）
// 本篇核心：装备是实现想法的工具——先有诉求，再选装备；
// 时间是装备最重要的词条，抛开时间段谈装备没有任何意义
const ITEMS_TIPS = [
  { title: '装备是实现想法的工具', desc: '先有诉求，再选装备。装备是你当前时间段方向的辅助手段；讨论装备的作用一定不能抛开时间；理解他人出装，一定要理解其背后的想法。' },
  { title: '点子不值钱，流程才值钱', desc: '冰女 225 攻速天赋案例：有人憋大炮想转物理核，结果被谁路过都能踹两脚。开发打法四步流程：明确核心诉求 → 提出若干方案 → 选择逻辑最自洽的方案 → 实战测试。主观逻辑自洽 + 客观能出效果，两者都满足才成立。' },
  { title: '三围属性的实际价值', desc: '力量=血量+回血，敏捷=攻速+护甲，智力=蓝量+回蓝+魔抗；主属性 1:1 加攻击（全才英雄三维总和×0.45）。3 个树枝=66 血+36 蓝+3 攻击≈多抗一次平A或半个 1 级技能。低级属性装便宜且高效，1 点属性没那么不堪。' },
  { title: '撑属性还是直奔关键装', desc: '夜魔双护腕案例：裸装被巫妖 3 轮消耗就得撤，双护腕后 1000 血+8 回血，巫妖耗不动了。判断标准就一句：混不住先让自己混住（撑属性求生存），混得住就直奔关键装。这个选择直接反映你对前 10 分钟阵容运营的理解。' },
  { title: '护甲：粗估即可', desc: '减伤对照：0 甲 0%、2 甲 10%、4 甲 20%、6 甲 25%、8 甲 32%。撑到 5 甲以上，每下平A少掉十几点血。出门不足 4 甲且对方平A频繁，指环就是高优先级选项。不用精算，实战里估出"疼不疼"心里有数就行。' },
  { title: '积攒价格 = 专门要攒的钱', desc: '积攒价格 = 装备原价 − 对你有提升的补强小件价。它直接代表装备平滑度：先锋盾小件全有用、平滑；辉耀积攒价=全款、极不平滑。积攒价越低估价越准——差 500 块能估出"1 分多钟搞定"，全款憋大件时间一长就估不准了。' },
  { title: '泡沫经济：存款不转化为战斗力', desc: '猴子 20 分钟 1 万 3 经济、存了 4500 买冰眼，照样团不过——存的钱在买出装备前对你没有任何提升。经济条领先只是表象。如果大件必须憋，就把这段时间纳入运营：避战、刷钱，别带着一包存款去和对面掰手腕。' },
  { title: '小件虽好，得适量', desc: '先夜叉再狂战比先狂战再夜叉慢不少——狂战让打钱质变，越早越好。大圣对线堆 2 系带+猎鹰+假腿，把电锤从 11-12 分钟拖到 16-17 分钟，一穷到底。1 号位分配 1000 左右经济给小件足矣，为了"平滑"拖慢关键装是饮鸩止渴。' },
  { title: '关键装必须在时间窗内做出', desc: '狂战 14-15 分钟正常（12-13 无解肥，18 分钟后说明打钱运营有极大问题）；紫苑 13-14 分钟正常（11 无解肥，17 分钟后对面早有微光/吹风应对）。每早 1 分钟=雪球效应，每晚 1 分钟=恶性循环。照抄出装不看时间，无效。' },
  { title: '出装必须贴合当下诉求', desc: '案例：大鱼在团队 10-15 分钟急需先手时出点金→全队挂机罚站；POM 14 分钟出大骨灰被白牛剑圣蓝猫满图提（吹风才是刚需）；虚空打 TB 输出不够时，BKB 保命不如穷尽输出。买错装备花的钱，和存款一样也是泡沫。' },
  { title: '性价比是伪命题', desc: '先满足性能要求，再谈价格是否合适。打高甲出金箍棒/胸针、打闪避出血辣、常规爆输出大炮、需要闪避蝴蝶——本质是带着诉求货比三家，看哪件装备能满足诉求，而不是比性价比数字。' },
  { title: '装备的出题与解题', desc: '出题：微光/隐刀逼对面带粉占格子、盘子逼对面出否决、紫苑卡帕克出装路线（帕克被迫吹风自降战力）；还有"全款杀招"——不买散件，全款紫苑/BKB 到手直接开雾叫杀，对面猝不及防。解题：预读对面装备提前反应，提前带粉、主要战场脚下插真眼，80 块买保险。分越高越重要。' },
  { title: '复盘暂停法训练', desc: '复盘时找一个时间点暂停，问自己：对面某英雄下一件装备是什么？大概多久做出来？然后继续游戏或看赛后面板验证。估偏了分析原因：不了解打钱效率/被压制只能吃低效资源/这段时间积极求战。装备理解是辅助模块，依附于运营。' }
]
</script>

<template>
  <div class="advanced" ref="rootEl">
    <div class="banner">
      <h1 class="gradient-title">进阶</h1>
      <p>运营 + 装备教学总结 —— 从对线到上高，读懂一场 Dota 的完整逻辑</p>
      <p class="meta-line">内容更新：{{ UPDATE_DATE }} · 通用概念，不随版本失效</p>
    </div>

    <!-- 页签切换：四个部分左右滑动切换。
         标签缩短为单行短名（用户要求），完整标题见各面板内的 h2 -->
    <div class="part-tabs">
      <!-- :class 动态绑定：当前激活的页签加 active 类（金色高亮）。
           用的是全局 .chapter-tab（和新手须知页同一套章节导航页签）——
           以前两页各写一份长得几乎一样的 .tab-btn，改了一处另一处不动 -->
      <button
        class="chapter-tab"
        :class="{ active: activePart === 'laning' }"
        @click="switchPart('laning')"
      >0–5 分钟 · 对线</button>
      <button
        class="chapter-tab"
        :class="{ active: activePart === 'midgame' }"
        @click="switchPart('midgame')"
      >5–10 分钟 · 运营</button>
      <button
        class="chapter-tab"
        :class="{ active: activePart === 'lategame' }"
        @click="switchPart('lategame')"
      >10 分钟后 · 方向</button>
      <button
        class="chapter-tab"
        :class="{ active: activePart === 'items' }"
        @click="switchPart('items')"
      >装备 · 解构</button>
    </div>

    <!-- 滑动容器：overflow hidden 把"滑出去"的面板裁掉（滑动效果的关键） -->
    <div class="tab-slider">
      <!-- 轨道：四个面板并排排开，靠 translateX 位移实现滑动。
           ⚠️ translateX 的百分比是相对"轨道自身宽度"（= 容器 4 倍）计算的，
           所以每切换一个面板只需位移 -25%（一个面板宽）；
           写错百分比会滑过头造成整屏空白。
           位移量由 script 里的 trackShift 计算属性统一算好，模板不用手写三元嵌套 -->
      <div
        class="tab-track"
        :style="{ transform: 'translateX(' + trackShift + '%)' }"
      >
        <!-- 第一部分：0-5 分钟对线运营要点 -->
        <section class="panel tab-page card">
          <h2>第一部分：0-5 分钟对线运营</h2>
          <p class="lead">
            对线是这个游戏<strong>逻辑最简单的部分</strong>：4 个英雄、一条兵线、两个野点、一个莲花池，
            你需要的资源从出门前就固定了。对线的本质，就是双方对这些固定资源点的<strong>博弈</strong>。
            搞清楚"这段时间我最需要什么"，一切打法都万变不离其宗。
          </p>

          <!-- 要点列表：v-for 渲染，序号 + 要点名 + 一句话精华。
               前三部分是时间顺序 → timeline 类，纵轴时间轴样式（见样式区） -->
          <div class="adv-list timeline">
            <!-- 滚动聚光灯：data-fk 是这条的"身份牌"（部分名-下标），
                 onMounted 时按它建 DOM→键 的映射；:class 绑定决定谁被点亮 -->
            <div
              v-for="(tip, i) in LANING_TIPS"
              :key="tip.title"
              class="adv-item card card-sm"
              :data-fk="fk('laning', i)"
              :class="{ focused: focusedKey === fk('laning', i) }"
            >
              <div class="adv-title">
                <span class="adv-num">{{ i + 1 }}</span>{{ tip.title }}
              </div>
              <p class="adv-desc">{{ tip.desc }}</p>
            </div>
          </div>
        </section>

        <!-- 第二部分：5-10 分钟运营要点 -->
        <section class="panel tab-page card">
          <h2>第二部分：5-10 分钟运营</h2>
          <p class="lead">
            5 分钟<strong>入夜</strong>之后，"继续对线"从默认动作变成了你的<strong>选择之一</strong>。
            团队开始围绕 6 分钟功能符、7 分钟经验神龛、一塔、传送门这些新资源点做多人联动——
            进攻、防守、换路，每一个都应该是经过思考的运营行为。
          </p>

          <div class="adv-list timeline">
            <div
              v-for="(tip, i) in MIDGAME_TIPS"
              :key="tip.title"
              class="adv-item card card-sm"
              :data-fk="fk('midgame', i)"
              :class="{ focused: focusedKey === fk('midgame', i) }"
            >
              <div class="adv-title">
                <span class="adv-num">{{ i + 1 }}</span>{{ tip.title }}
              </div>
              <p class="adv-desc">{{ tip.desc }}</p>
            </div>
          </div>
        </section>

        <!-- 第三部分：10 分钟开始的运营方向要点 -->
        <section class="panel tab-page card">
          <h2>第三部分：10 分钟开始的运营方向</h2>
          <p class="lead">
            10 分钟后全队到 6、关键装出炉，团队具备<strong>基本作战能力</strong>——
            10 分钟的团和 30 分钟的团，逻辑本质相同。所以这一篇不再按时间段切分，
            讲的是团队运营的<strong>大方向</strong>：胜利的本质、团战怎么打、进攻怎么组织、劣势怎么防守。
          </p>

          <div class="adv-list timeline">
            <div
              v-for="(tip, i) in LATEGAME_TIPS"
              :key="tip.title"
              class="adv-item card card-sm"
              :data-fk="fk('lategame', i)"
              :class="{ focused: focusedKey === fk('lategame', i) }"
            >
              <div class="adv-title">
                <span class="adv-num">{{ i + 1 }}</span>{{ tip.title }}
              </div>
              <p class="adv-desc">{{ tip.desc }}</p>
            </div>
          </div>
        </section>

        <!-- 第四部分：装备解构分析要点 -->
        <section class="panel tab-page card">
          <h2>第四部分：装备解构分析</h2>
          <p class="lead">
            装备是<strong>实现想法的工具</strong>——先有诉求，再选装备。
            <strong>时间</strong>是装备最重要的词条：每件装备都有它强势的时间窗口，
            抛开时间段谈装备没有任何意义。这一篇讲怎么思考装备、怎么规划"经济 → 装备"的转化。
          </p>

          <!-- 第四部分（装备）不是时间顺序，用卡片网格而不是时间轴（见样式区 .adv-list.grid） -->
          <div class="adv-list grid">
            <div
              v-for="(tip, i) in ITEMS_TIPS"
              :key="tip.title"
              class="adv-item card card-sm"
              :data-fk="fk('items', i)"
              :class="{ focused: focusedKey === fk('items', i) }"
            >
              <div class="adv-title">
                <span class="adv-num">{{ i + 1 }}</span>{{ tip.title }}
              </div>
              <p class="adv-desc">{{ tip.desc }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ==================== 第三部分：内容来源 ==================== -->
    <section class="panel source-panel card">
      <h2><Library :size="18" class="h-icon" />内容来源</h2>
      <p>
        本页内容总结自 B 站 UP 主 <strong>久远Vortex</strong> 的教学，原文分析更深入，
        含大量图解与职业选手案例，强烈建议看一遍原版。
      </p>
      <p>
        B 站空间：
        <a href="https://space.bilibili.com/3845087" target="_blank" rel="noopener">
          https://space.bilibili.com/3845087
        </a>
      </p>
    </section>
  </div>
</template>

<style scoped>
/* 页面布局：和 GuideView 新手须知页保持一致（居中 + 卡片面板风格） */
.advanced {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* （横幅 .banner / .banner h1 / .banner p / .meta-line / .panel / .panel h2 /
   .h-icon / .panel p / .panel strong 的样式都收进了 main.css 的"四页共用"一节；
   页签也从本页自己的 .tab-btn 换成了全局 .chapter-tab。
   ⚠️ 本页只剩下面这些"只属于进阶页"的东西，其中滑动轨道那一组尤其别动 ——
   见本页顶部关于聚光灯的说明） */

.lead {
  margin-bottom: 20px;
}

/* ---------- 页签切换 + 左右滑动 ---------- */
.part-tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;   /* 窄屏自动换行，防止 4 个长页签挤破页面 */
}

/* 滑动容器：把滑出视野的面板裁掉（没有它两个面板会同时可见） */
.tab-slider {
  overflow: hidden;
}

/* 轨道：四个面板横向并排，轨道总宽 = 容器的 4 倍；
   transition 让 translateX 变化时产生平滑的左右滑动动画 */
.tab-track {
  display: flex;
  width: 400%;
  transition: transform 0.3s ease;
}

/* 每个面板占轨道的 1/4（= 滑动容器的 100% 宽）
   ⚠️ 面板数变了这两处宽度要同步改：轨道 = N×100%，面板 = 100/N% */
.tab-page {
  width: 25%;
  flex-shrink: 0;  /* 不许被 flex 压缩，保证面板宽度固定 */
}

/* ---------- 要点列表 ---------- */
.adv-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---------- 纵向时间轴（第二批，前三部分） ----------
   列表左侧一条竖线，每条要点的序号圆标"钉"在线上——
   前三部分是 0-5 / 5-10 / 10 分钟后的时间顺序，用时间轴呈现更贴切。
   实现：线画在列表的 ::before 上（绝对定位）；
   序号圆标本来是行内元素，这里改成绝对定位、左移出卡片贴到线上。
   ⚠️ 圆标要自带底色（--card，即面板底色），把穿过它的竖线"盖断" */
.adv-list.timeline {
  position: relative;
  padding-left: 36px;   /* 给左侧的线和圆标让出空间 */
}

.adv-list.timeline::before {
  content: '';
  position: absolute;
  left: 11px;           /* 圆标宽 22px，圆心在 11px，线对准圆心 */
  top: 10px;
  bottom: 10px;
  width: 2px;
  /* 线做"上金下暗"的渐变，呼应时间从早到晚；末端留一点渐隐不突兀。
     ⚠️ --border（10% 白）画成 2px 细线偏淡，
     这里单独用一个亮一点的中性色（18% 白），只在时间轴这一处用 */
  background: linear-gradient(
    180deg,
    var(--gold) 0%,
    rgba(255, 255, 255, 0.18) 30%,
    rgba(255, 255, 255, 0.18) 100%
  );
}

.adv-list.timeline .adv-item {
  position: relative;   /* 让圆标以卡片为参照物定位 */
}

.adv-list.timeline .adv-num {
  position: absolute;
  left: -36px;          /* 卡片左边 = 列表的 36px 内边距，左移回去正好落在线上 */
  top: 12px;
  margin-right: 0;
  /* 底色把竖线断开（否则线会穿过圆标）。
     ⚠️ 浅色主题必须换成【不透明】的 --surface：
     圆标是浮在卡片上的，只有底色完全不透明才能把线真正盖住；
     原来的 --card 现在只是"半透明白"，线会从圆标里透出来 */
  background: var(--surface);
}

/* ---------- 装备卡片网格（第二批，第四部分） ----------
   装备要点之间没有时间先后，改用网格排列，和前三部分的时间轴区分开；
   min(240px, 100%)：窄屏自动减列、极窄屏一列，不会横向溢出 */
.adv-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: 14px;
}

/* 每条要点：左侧序号 + 要点名 + 描述。
   底色/边框/圆角由全局 .card.card-sm 提供（嵌套小卡：底色提一档） */
.adv-item {
  padding: 14px 16px;
}

.adv-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--gold);
  margin-bottom: 6px;
}

/* 序号小圆标：金色描边圆形，标出"这是第几条" */
.adv-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-right: 8px;
  border: 1px solid var(--gold);
  border-radius: 50%;
  font-size: 12px;
  color: var(--gold);
  vertical-align: middle;
}

.adv-desc {
  font-size: 13px;
  color: var(--muted);
  margin: 0;
}

/* ---------- 来源面板：链接可点击 ---------- */
.source-panel a {
  color: var(--link);
  word-break: break-all; /* URL 很长，窄屏时允许换行避免撑破面板 */
}

/* hover 反馈：链接亮一档（用户要求所有可交互元素都有 hover） */
.source-panel a:hover {
  color: var(--gold-bright);
}

/* ---------- 滚动聚光灯（焦点态） ----------
   配合 script 里的 focusedKey：离视口中心最近的那条加 .focused 类，
   其余条目压暗。焦点换人时播一次动画，播完静止。
   ⚠️ transition 是"整体覆盖"而不是叠加的：
   全局 .card 声明了 transform/box-shadow/border-color 三项过渡，
   这里为了让 opacity 和背景色也能平滑过渡，必须重写 transition，
   而重写会【把 .card 那三项一起顶掉】——所以下面把它们原样抄一遍，
   漏掉的话卡片 hover 上浮会变成瞬间跳变（没有过渡）。
   （为什么能顶掉全局 .card？scoped 样式编译后会加 [data-v-xxx] 属性选择器，
     权重比全局的 .card 高一档，跟打包顺序无关） */
.adv-item {
  transition: opacity var(--dur-std) var(--ease-out),
              background-color var(--dur-std) var(--ease-out),
              transform var(--dur-std) var(--ease-out),
              box-shadow var(--dur-std) var(--ease-out),
              border-color var(--dur-micro) ease;
}

/* 非焦点条目：压暗，让焦点那条"跳出来"。
   为什么是压暗而不是隐藏？——压暗后仍能扫读、也能感知"后面还有很多条"，
   藏起来反而会加重"读不下去"的感觉。
   hover 时恢复到全亮，方便读者停下来细看某一条。

   ⚠️ 为什么是 0.75 而不是常见的 0.5？（这个数是【量出来的】，不是拍的）
   压暗会等比拉低文字对比度，0.5 时实测：描述文字只剩 4.23:1、金色标题只剩 2.85:1，
   双双跌破 WCAG AA 的 4.5:1——而"便于阅读"正是这次改版的前提。
   逐档扫描后：描述文字要到 0.53 才达标，金色标题要到 0.75 才达标
   （金色本来就靠"亮"撑对比度，压暗时掉得比灰色文字更快，是瓶颈）。
   取两者的较高值 0.75，实测描述 7.6:1、标题 4.7:1，都稳过。
   聚光灯的"聚焦感"主要由焦点条自己的金边/发光/实心金序号提供，
   不靠把其余条目压到看不清——那反而是在伤害可读性 */
.adv-item:not(.focused) {
  opacity: 0.75;
}

.adv-item:not(.focused):hover {
  opacity: 1;
}

/* 焦点条目：暖金底 + 金边 + 金色光晕（--shadow-gold 是全局变量）。
   这里是聚光灯效果的【主要来源】而不是压暗——因为压暗会等比拉低文字对比度，
   想靠"把别的压得更暗"来制造焦点，代价就是别的条目读不清（见上面 0.75 的推导）。
   反过来把焦点这条做得足够醒目，就既能拉开层次又不牺牲任何可读性。
   暖金底（--gold-tint-2，20% 的金）比单纯提亮的灰底更有辨识度，
   也呼应时间轴的"金色进度"语义 */
.adv-item.focused {
  background: var(--gold-tint-2);
  border-color: rgba(240, 178, 50, 0.55);
  box-shadow: var(--shadow-gold);
}

/* 焦点扫描光带：复用全局 .card::after 的渐变和尺寸（250% 宽、停在 200% 0），
   这里只是让它"自动播一次"，不用把鼠标移上去。
   ⚠️ opacity 必须写在 keyframes 里面、不能写在 .adv-item.focused::after 上：
   动画默认 fill-mode: none，播完就回到基态（全局 .card::after 的 opacity: 0、
   background-position: 200% 0），光带自动消失、不残留。
   如果把 opacity: 1 写在基态，动画结束后光带会永久停在卡片上。
   （CSS 动画的优先级高于 transition，所以播放期间不会和 hover 的过渡打架） */
.adv-item.focused::after {
  animation: focus-scan var(--dur-sheen) var(--ease-std) 1;
}

@keyframes focus-scan {
  from { opacity: 1; background-position: 200% 0; }
  to   { opacity: 1; background-position: -100% 0; }
}

/* 序号圆标"点亮"：空心金圈 → 实心金底 + 深色数字，并放大一下再收回来。
   ⚠️ 选择器要多带一个 .adv-list 前缀：时间轴里有一条
   `.adv-list.timeline .adv-num { background: var(--surface) }` 用不透明底色
   挡住穿过圆标的竖线，权重和本条相同，不加强前缀就得靠"组件样式在 main.css 之后"
   这个隐含顺序取胜，太脆弱。
   金色同样是不透明的，所以时间轴竖线照样被盖断，不会出现"线穿过圆标" */
.adv-list .adv-item.focused .adv-num {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--bg);
  animation: num-pulse 0.45s var(--ease-out) 1;
}

@keyframes num-pulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); }   /* 放大到 1.35 倍再收回来，制造"点亮"的一下 */
  100% { transform: scale(1); }
}

/* 无障碍：系统开了"减少动态效果"时关掉动画。
   ⚠️ 这条必须写，不能靠全局 main.css 里那条：全局 media 查的是 .card，
   而上面 scoped 的 .adv-item 权重更高，全局那条压不住我们新加的过渡。
   注意只关动画，静态的焦点样式（金边/提亮/压暗）保留——
   视觉焦点本身是"信息"而不是"装饰"，关掉用户就分不清在看哪条了 */
@media (prefers-reduced-motion: reduce) {
  .adv-item {
    transition-duration: 0.01ms;
  }

  .adv-item.focused::after,
  .adv-list .adv-item.focused .adv-num {
    animation: none;
  }
}
</style>
