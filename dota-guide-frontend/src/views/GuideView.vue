<!--
  新手须知页 = 站点首页（路由 /）
  内容：1~5 号位体系 + Dota 与 LOL/王者 的关键差异 + 两个"为什么"

  ============================================================
  2026-10-13 滚动动效改版（本页变化最大的一处）
  ============================================================
  改之前：三个部分是【上下滑动的面板】——外面套一个 75vh 定高的容器，
  里面三个面板叠成 300% 高的轨道，切页签靠 translateY 位移。
  那个做法有两个绕不开的毛病：
    1. 面板内部要自己再滚一次（overflow-y: auto），于是"滚动条里套着滚动条"，
       滑到面板底部还得停一下换到外层继续滚；
    2. 每屏只能看一部分，三节之间的先后关系被藏进了页签里。

  现在改成【整页纵向滚动】：三个面板依次排开，跟着整页一起滚。
    滚动触发  —— 每一节滚进视口时淡入上浮一次（v-reveal）
    吸顶定位  —— 页签栏滚动时钉在顶栏下面（.sticky-bar）
    滚动联动  —— 读到哪一节，哪个页签自己变金色（下面这段 scroll-spy）
    平滑锚点  —— 点页签平滑滚过去，并把它写进 URL（刷新/分享都停在原地）
    视差      —— 顶部横幅滚得比正文慢一点（v-parallax）

  原来的滑动机制（tab-slider / tab-track / tab-page / trackShift / 窄屏媒体查询）
  已经全部删掉，不留"兼容旧写法"的分支。
-->
<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// lucide 图标：全站 emoji 统一换成 SVG 图标库（矢量图，任何分辨率都清晰）
// Table/Shuffle/HelpCircle 除了做各节的标题图标，还兼职做页签上的小图标（见 SECTIONS）
import { Table, Shuffle, HelpCircle, Map, Ban, Swords, Coins, Users, ScrollText, Trees, Lightbulb, TriangleAlert, KeyRound } from 'lucide-vue-next'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'
// scroll-spy 判据："这几节里，判定线落在谁身上" —— 纯数字进出，可单测
import { pickActiveSection } from '../domain/scrollspy'
// 系统"减弱动态效果"开关：开了就不做平滑滚动，直接跳过去
import { prefersReducedMotion } from '../motion'

const route = useRoute()
const router = useRouter()

// ---------- 三个章节 --------------------------------------------------
// 一个数组同时喂三处：页签按钮、模板里的 data-spy（收集 DOM 用）、
// 以及 switchSection 的合法性判断。原来这三处各写一份，加一节要改三个地方。
// icon 存的是组件本身（lucide 的图标就是组件），模板里用 <component :is> 渲染
const SECTIONS = [
  { key: 'positions', label: '号位体系', icon: Table },
  { key: 'differences', label: '关键差异', icon: Shuffle },
  { key: 'whys', label: '两个为什么', icon: HelpCircle }
]

// ---------- 滚动联动：读到哪一节，哪个页签亮 ----------
// null = 还在顶部读横幅，谁都不高亮（判定规则见 src/domain/scrollspy.js 的注释）
const activeSection = ref(null)

const guideEl = ref(null)    // 页面根元素：--guide-offset 写在它身上
const tabBarEl = ref(null)   // 吸顶页签栏：scroll-spy 的"判定线"就是它的下边缘

const sections = []          // [{key, el}]，onMounted 时收集
let rafId = 0                // 排队中的 rAF 句柄

/** 锚点落位时，章节顶部停在页签栏下方留出的空隙 */
const ANCHOR_GAP = 16

/**
 * 重算高亮。只读 DOM、只写一个 ref —— 判断本身在纯函数里。
 *
 * ⚠️ 判定线取的是页签栏**实时**的下边缘（getBoundingClientRect().bottom），
 * 不是"顶栏高 + 页签栏高"这种算出来的值。为什么：
 *   · 页签栏吸顶后下边缘正好是"正文从哪开始露出来"的那条边，语义就是它
 *   · 顶栏在 ≤900px 会从一行变两行（--header-h 从 68 变 104）
 *   · 页签栏自己也会在窄屏换行变高
 * 直接把这几件事一起量进来，就不用维护一串会过期的加法
 */
function updateSpy() {
  const line = tabBarEl.value ? tabBarEl.value.getBoundingClientRect().bottom : 0

  // 读矩形这一步只有视图层干得了，读完立刻降级成三个纯数字再交给判据函数
  const rects = sections.map(({ key, el }) => {
    const r = el.getBoundingClientRect()
    return { key, top: r.top, bottom: r.bottom }
  })

  const doc = document.documentElement
  // ⚠️ 必须带上 scrollY > 0：内容比视口还短的页面永远满足后半句，
  //    不加这个前提，页面一打开就会被当成"已经到底"，最后一个页签直接点亮
  const atBottom =
    window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2

  // 这里直接赋值（包括 null），不能用 `if (best)` 兜住旧值：
  // 滚回页面顶部时高亮是【该灭掉】的，兜住就会一直亮着最上面那个
  activeSection.value = pickActiveSection(rects, line, { atBottom })
}

/** rAF 节流：滚动一次连发几十个事件，一帧重算一次就够 */
function requestSpy() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    updateSpy()
  })
}

/**
 * 重算锚点落位偏移，写进 --guide-offset。
 * scroll-margin-top 要躲开"顶栏 + 吸顶页签栏"两层，而且这两层的高度
 * 都会随窗口宽度变（顶栏换行、页签栏换行），所以不能写死在 CSS 里。
 */
function syncOffset() {
  if (!guideEl.value) return
  const headerH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--header-h')
  ) || 0
  const barH = tabBarEl.value ? tabBarEl.value.offsetHeight : 0
  guideEl.value.style.setProperty('--guide-offset', headerH + barH + ANCHOR_GAP + 'px')
}

/**
 * 跳到某一节：点页签走的就是这条。
 * 三件事：①立刻高亮（不等滚动到位，点击要有即时反馈）
 *        ②平滑滚过去 ③写进 URL 的 hash
 */
function switchSection(key) {
  const target = sections.find((s) => s.key === key)
  if (!target) return

  activeSection.value = key
  // replace 而不是 push：和进阶页的页签一个道理 ——
  // 否则每点一次页签，浏览器的"后退"都得先退一遍页签才能退出本页
  router.replace({ hash: '#' + key })

  target.el.scrollIntoView({
    // 开了"减弱动态效果"就瞬移过去（平滑滚动本身就是一段长距离位移）
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start'
  })
}

onMounted(() => {
  // 要等 DOM 渲染完才拿得到章节元素
  nextTick(() => {
    guideEl.value?.querySelectorAll('[data-spy]').forEach((el) => {
      sections.push({ key: el.dataset.spy, el })
    })
    syncOffset()

    // URL 上带 hash（刷新页面 / 别人发的链接）时直接落到那一节。
    // ⚠️ hash 用的是 'positions' 这种名字，**故意不对应任何元素的 id**：
    //    一旦有同名的 id，浏览器自己会在加载完后"跳到锚点"，
    //    那个时机和我们的渲染、和 scroll-margin-top 都不一定对得上，会抢着滚一次。
    //    名字对不上任何 id，浏览器就永远不会插手，这里说了算。
    const hash = route.hash.slice(1)
    if (SECTIONS.some((s) => s.key === hash)) {
      const target = sections.find((s) => s.key === hash)
      if (target) {
        // 直接落位、不播平滑滚动：这是"打开页面"而不是"页面内跳转"
        target.el.scrollIntoView({ block: 'start' })
        activeSection.value = hash
      }
    }

    // 先算一次：刷新时浏览器会恢复上次的滚动位置，
    // 不主动算的话，第一帧的页签高亮会停在"最上面那个"上
    updateSpy()
  })

  // passive: 声明不会 preventDefault，浏览器不用等回调结束就能滚，更跟手
  window.addEventListener('scroll', requestSpy, { passive: true })
  // 窗口尺寸变化会改顶栏高度、页签栏换行与否 —— 判定线和落位偏移都要重算
  window.addEventListener('resize', onResize)
})

function onResize() {
  syncOffset()
  requestSpy()
}

// 卸载时必须清理：监听器/定时器闭包引用着本组件的状态，不清就是内存泄漏
onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestSpy)
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(rafId)
})

// ---------- 号位表数据 ----------
// res  ：资源量 1~5，决定能量条点亮几格
// hero/slug：代表英雄名字 + 官网英文内部名（跳详情页的链接）
const POS_ROWS = [
  { pos: 1, alias: '大哥', duty: '后期主力输出，前中期疯狂发育避战', res: 5, hero: '斯温', slug: 'sven' },
  { pos: 2, alias: '中单', duty: '前期等级最高，带动全队节奏', res: 4, hero: '影魔', slug: 'nevermore' },
  { pos: 3, alias: '劣势路', duty: '抗压 + 先手开团，中期团队支点', res: 3, hero: '斧王', slug: 'axe' },
  { pos: 4, alias: '游走辅助', duty: '全图游走搞事，帮队友建立优势', res: 2, hero: '帕吉', slug: 'pudge' },
  { pos: 5, alias: '纯辅助', duty: '买眼做视野保大哥，几乎不吃资源', res: 1, hero: '水晶室女', slug: 'crystal_maiden' }
]
</script>

<template>
  <div class="guide" ref="guideEl">
    <!-- 顶部横幅：纯文字居中（原来是个带光晕的卡片，和详情页的英雄横幅撞脸了）。
         挂了视差：滚的时候它比正文慢一点，页面有"层"的感觉 -->
    <div class="banner parallax" v-parallax="{ speed: 0.1, max: 24 }">
      <h1 class="gradient-title">新手须知</h1>
      <p>写给从《英雄联盟》《王者荣耀》转过来的你 —— 五分钟搞懂 Dota 2 最核心的概念</p>
      <p class="meta-line">内容更新：{{ UPDATE_DATE }} · 通用概念，不随版本失效</p>
    </div>

    <!-- 章节页签：滚动时吸顶钉在顶栏下面（.sticky-bar）。
         除了"点了跳过去"，它还是滚动联动的指示器 —— 读到哪一节，哪个自己变金色 -->
    <div class="part-tabs sticky-bar" ref="tabBarEl">
      <button
        v-for="s in SECTIONS"
        :key="s.key"
        class="chapter-tab"
        :class="{ active: activeSection === s.key }"
        @click="switchSection(s.key)"
      ><component :is="s.icon" :size="15" />{{ s.label }}</button>
    </div>

    <!-- ==================== 第一节：1~5 号位 ==================== -->
    <!-- data-spy 是这一节的"身份牌"：onMounted 按它收集 DOM、算高亮；
         reveal 类 + v-reveal 让它在滚进视口时淡入上浮一次 -->
    <section data-spy="positions" class="panel card reveal" v-reveal>
      <h2><Table :size="18" class="h-icon" />什么是 1~5 号位？</h2>
      <p class="lead">
        号位是 Dota 独有的概念，本质是<strong>全队吃资源的优先级排序</strong>：
        1 号位吃最多资源（全队倾家荡产养他），5 号位吃最少资源（工资几乎全用来买眼）。
        LOL/王者 没有这个体系——为什么，
        <a class="text-link" href="#" @click.prevent="switchSection('whys')">见本页最后一部分</a>。
      </p>
      <!-- 窄屏时表格 5 列放不下：外包一层 overflow-x:auto，在窗口内横向滚动而不是撑破页面 -->
      <div class="table-wrap">
        <table class="pos-table">
          <thead>
            <tr>
              <th>号位</th>
              <th>别称</th>
              <th>职责</th>
              <th>资源量</th>
              <th>代表英雄</th>
            </tr>
          </thead>
          <tbody>
            <!-- 代表英雄可点击跳详情：链接用 slug（官网英文内部名，hero 表的唯一标识列），
                 比数字 id 稳定可读——后端按 slug 查询 -->
            <tr v-for="row in POS_ROWS" :key="row.pos">
              <!-- 号位数字：金色圆形徽章 -->
              <td class="pos-cell"><span class="pos-badge">{{ row.pos }}</span></td>
              <td>{{ row.alias }}</td>
              <td>{{ row.duty }}</td>
              <!-- 资源量：5 格能量条，点亮 row.res 格 -->
              <td>
                <span class="pips" :title="'资源量 ' + row.res + ' / 5'">
                  <i v-for="n in 5" :key="n" :class="{ on: n <= row.res }"></i>
                </span>
              </td>
              <td><router-link :to="'/heroes/' + row.slug" class="hero-link">{{ row.hero }}</router-link></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="pos-laning"><Map :size="16" class="h-icon" />分路怎么站？</h3>
      <p>
        Dota 的地图是<strong>对角线镜像</strong>的：你的"优势路"对面就是敌方的"劣势路"。
        新手默认阵容叫 "2-1-2"：优势路两人（1 号位 + 5 号位保他）、
        中路一人（2 号位）、劣势路两人（3 号位 + 4 号位）。
        进游戏选完人后看队友往哪走、跟着补位即可。
      </p>

      <!-- 警示型提示块（红）——把"最容易踩的坑"从正文里提出来单独强调 -->
      <div class="notice notice-warn">
        <TriangleAlert :size="18" class="notice-icon" />
        <div>
          <strong class="notice-title">新手最容易犯的错</strong>
          <p>别去抢 1 号位的补刀。想帮忙就去买眼、拉野、游走——补刀留给全队吃资源最多的那个人。</p>
        </div>
      </div>
    </section>

    <!-- ==================== 第二节：关键差异 ==================== -->
    <section data-spy="differences" class="panel card reveal" v-reveal>
      <h2><Shuffle :size="18" class="h-icon" />和 LOL / 王者的关键差异</h2>
      <div class="diff-grid">
        <!-- 对比卡：图标独立成金色圆徽章，卡片是三行结构（徽章 → 标题 → 正文） -->
        <div class="diff-card card card-sm">
          <span class="diff-icon"><Ban :size="17" /></span>
          <h3>没有固定打野位</h3>
          <p>Dota 2 默认没有 LOL 那样的专职打野，野区是"谁顺路谁刷"。原因详见第三部分——这是转学玩家最需要适应的一点。</p>
        </div>
        <div class="diff-card card card-sm">
          <span class="diff-icon"><Swords :size="17" /></span>
          <h3>可以反补</h3>
          <p>能 A 掉自己的残血小兵，让对手拿不到钱和经验。压制对手的重要手段，LOL 完全没有这个机制。</p>
        </div>
        <div class="diff-card card card-sm">
          <span class="diff-icon"><Coins :size="17" /></span>
          <h3>死亡会掉钱</h3>
          <p>阵亡会损失一部分金钱，而且<strong>"不可靠金钱"</strong>（补刀所得）掉得更多。"别送"在 Dota 里是真金白银的惩罚。</p>
        </div>
        <div class="diff-card card card-sm">
          <span class="diff-icon"><Users :size="17" /></span>
          <h3>英雄全免费</h3>
          <p>没有任何解锁/购买英雄的机制，注册即全英雄可玩。要花钱的只有皮肤饰品（纯外观）。</p>
        </div>
        <div class="diff-card card card-sm">
          <span class="diff-icon"><ScrollText :size="17" /></span>
          <h3>回城要买 TP</h3>
          <p>回城不是免费技能：90 金币一张 TP 卷轴，80 秒冷却，可传送到任何友方建筑。时刻备一张，保命支援都靠它。</p>
        </div>
        <div class="diff-card card card-sm">
          <span class="diff-icon"><Trees :size="17" /></span>
          <h3>树林会卡视野</h3>
          <p>Dota 的树林能藏人、绕视野，地形高低差还会影响命中率。吃透地图需要时间，新手先学会别脸探草丛……不对，别脸探树林。</p>
        </div>
      </div>

      <!-- 建议型提示块（金）——给"下一步做什么"的指路，链到图鉴 -->
      <div class="notice notice-tip">
        <Lightbulb :size="18" class="notice-icon" />
        <div>
          <strong class="notice-title">不知道从哪开始？</strong>
          <p>
            去<router-link to="/heroes" class="text-link">英雄图鉴</router-link>顶部的「新手推荐英雄」区
            挑一个难度 ★ 的英雄，先打几局人机熟悉操作和地图。
          </p>
        </div>
      </div>
    </section>

    <!-- ==================== 第三节：两个"为什么" ==================== -->
    <section data-spy="whys" class="panel card reveal" v-reveal>
      <h2><HelpCircle :size="18" class="h-icon" />两个新手最常问的"为什么"</h2>

      <h3 id="why-no-jungler">为什么 Dota 没有打野位？</h3>
      <p>
        <strong>经济账算不过来。</strong>Dota 的野怪刷新慢（每分钟一波）、前期金币低，
        专职打野的经济远不如线上（LOL 的打野位是靠"打野刀 + 野区高经济"的设计硬撑起来的）。
        更关键的是拉野机制：辅助可以把野怪拉进兵线、让线上英雄顺手收掉，
        野区资源根本不需要一个专职的人去吃；再加上 TP 便宜、支援快，
        "边路出事打野来不了"的缺口也被补上了。Dota 早期其实也有陈、谜团这类打野英雄，
        但随着版本经济调整，专职打野已退出主流，现在的野区是"谁顺路谁刷"。
      </p>

      <!-- 结论型提示块（蓝）——把这一节的答案压缩成一句话，方便记忆 -->
      <div class="notice notice-key">
        <KeyRound :size="18" class="notice-icon" />
        <div>
          <strong class="notice-title">一句话总结</strong>
          <p>野区资源不需要专人吃，专职打野在经济上算不过来。</p>
        </div>
      </div>

      <h3 id="why-no-pos">为什么 LOL / 王者没有 1~5 号位？</h3>
      <p>
        <strong>因为两款游戏的经济哲学不同。</strong>Dota 死亡掉钱 + 后期装备质变（大哥六神装可以一打五），
        所以全队的策略是"把资源极致倾斜给一个人"——这就需要 1~5 号位的排序。
        LOL 死亡不掉钱、装备成长相对平滑，设计上选择了更均衡的分工：
        固定五个位置（上/野/中/下/辅），每人拿自己该拿的资源。
        王者荣耀沿袭的是 LOL 的思路。
      </p>

      <div class="notice notice-key">
        <KeyRound :size="18" class="notice-icon" />
        <div>
          <strong class="notice-title">一句话总结</strong>
          <p>LOL 按"位置"分工，Dota 按"优先级"分资源。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.guide {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;   /* 三节之间、以及和横幅/页签栏之间的间距都靠它 */
}

/* 每一节的锚点落位偏移：躲开"顶栏 + 吸顶页签栏"。
   具体数值由 script 的 syncOffset() 量出来写进 --guide-offset ——
   这两层的高度都会随窗口宽度变，写死在 CSS 里必然对不上 */
.guide section[data-spy] {
  scroll-margin-top: var(--guide-offset, 24px);
}

/* ---------- 章节页签栏 ---------- */
/* 吸顶玻璃（position/模糊/边框/圆角）由全局 .sticky-bar 提供，
   这里只管"三个页签平铺一行、滚动时不许被压扁" */
.part-tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;      /* 窄屏自动换行，防止挤破页面 */
  padding: 10px 12px;
}

/* ---------- 正文里的锚点链接 ---------- */
.text-link {
  color: var(--link);
  text-decoration: none;
}

.text-link:hover {
  text-decoration: underline;
}

/* ---------- 面板内部的小标题 ----------
   h2（标题图标 + 文字）和正文样式已收进 main.css 的四页共用部分，这里不重复。
   h3 只有本页用，留在本地 */
.panel h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  color: var(--gold);
  margin: 20px 0 8px;
}

.lead {
  margin-bottom: 16px;
}

/* ---------- 号位表格 ---------- */
/* 窄屏 5 列放不下：窗口内横向滚动，而不是撑破页面 */
.table-wrap {
  overflow-x: auto;
}

.pos-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.pos-table th,
.pos-table td {
  border: 1px solid var(--border);
  padding: 10px 12px;
  text-align: left;
  white-space: nowrap;   /* 窄屏横向滚动时单元格不折行 */
}

.pos-table th {
  background: var(--card-2);
  color: var(--muted);
}

.pos-table td {
  color: var(--text);
}

/* 斑马纹：偶数行铺一层极淡的白色，长表格横向扫读时不串行 */
.pos-table tbody tr:nth-child(even) td {
  background: var(--zebra);
}

/* 号位列：圆形徽章居中。
   ⚠️ 这里必须写全 ".pos-table td.pos-cell" 而不是只写 ".pos-cell"：
   上面 ".pos-table td" 是 text-align: left，只写 .pos-cell 权重比它低、居中不生效 */
.pos-table td.pos-cell {
  text-align: center;
}

/* 号位数字：金色圆形徽章 */
.pos-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--gold);
  background: var(--gold-tint);
  color: var(--gold);
  font-weight: bold;
  font-size: 16px;
}

/* ---------- 资源量：5 格能量条 ----------
   5 个固定格子，点亮 res 格；未点亮的格子是暗底 + 细边框，
   一眼能比出"谁吃资源多"，比一串星星更直观 */
.pips {
  display: inline-flex;
  gap: 3px;
  vertical-align: middle;
}

.pips i {
  width: 14px;
  height: 8px;
  border-radius: 2px;
  background: var(--card-3);
  border: 1px solid var(--border);
}

.pips i.on {
  background: var(--gold);
  border-color: var(--gold);
}

/* 代表英雄链接：链接蓝 + hover 下划线（链接色不跟强调金混用） */
.hero-link {
  color: var(--link);
  text-decoration: none;
  font-weight: bold;
}

.hero-link:hover {
  text-decoration: underline;
}

/* ---------- 差异卡片网格 ---------- */
.diff-grid {
  display: grid;
  /* min(250px, 100%)：极窄屏（<250px+内边距）时列宽收缩到 100%，防止横向溢出 */
  grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
  gap: 16px;
}

/* 底色/边框/圆角由全局 .card.card-sm 提供（面板内嵌套小卡变体） */
.diff-card {
  padding: 16px;
}

/* 对比卡图标：金色圆形徽章 */
.diff-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--gold-tint);
  border: 1px solid var(--gold-tint-2);
  color: var(--gold);
  margin-bottom: 10px;
}

.diff-card h3 {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--text);   /* 标题用正文字色，金色让给图标徽章（覆盖 .panel h3 的金色） */
}

.diff-card p {
  font-size: 15px;
  line-height: 1.7;
}

/* ---------- 三类提示块 ----------
   同一个 .notice 骨架（图标 + 标题 + 正文），靠变体类换"左边框色 + 淡色底 + 图标色"：
     notice-tip  金 → 建议型：该怎么做（指路）
     notice-warn 红 → 警示型：别踩的坑
     notice-key  蓝 → 结论型：一句话总结，要记住的
   左边框加宽成 3px，是"提示块"最典型的视觉标记 */
.notice {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  margin-top: 16px;
  border: 1px solid var(--border);
  border-left-width: 3px;
  border-radius: var(--radius-sm);
}

.notice p {
  font-size: 15px;
}

/* 图标不参与压缩、和标题行对齐 */
.notice-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.notice-title {
  display: block;      /* 标题独占一行，正文另起一行 */
  margin-bottom: 4px;
  font-size: 14px;
}

.notice-tip {
  background: var(--gold-tint);
  border-left-color: var(--gold);
}

.notice-tip .notice-icon,
.notice-tip .notice-title {
  color: var(--gold);
}

.notice-warn {
  background: var(--danger-tint);
  border-left-color: var(--danger);
}

.notice-warn .notice-icon,
.notice-warn .notice-title {
  color: var(--danger);
}

.notice-key {
  background: var(--int-tint);
  border-left-color: var(--int);
}

.notice-key .notice-icon,
.notice-key .notice-title {
  color: var(--int);
}
</style>
