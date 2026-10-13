<!--
  英雄图鉴（路由 /heroes）—— 第四阶段对齐 dota2.com 官网 + 本阶段体验优化
  数据流：筛选/加载更多 → 调用后端 GET /api/heroes?page=&size=&keyword=&role=&pos=&attr=&complexity=
          → 渲染推荐区 + 卡片网格 + "加载更多"按钮
  交互：点击卡片 → 跳转详情页 /heroes/:key（用 slug，如 /heroes/sven）
  本阶段（2026-10-06）改动：
    1. 顶部新增"新手推荐英雄"区：复杂度=简单的前 8 个（独立请求，不受筛选影响）
    2. 主属性页签选中色 = 卡片徽章色（力量红/敏捷绿/智力蓝/全才紫），选中态实底填充
    3. 筛选栏显示"共 N 个结果" + "清除筛选"按钮
    4. 搜索即时生效（input 300ms 防抖），去掉"搜索"按钮
    5. 头像 loading="lazy"；分页条改成"加载更多"（每次 24 个，向后累积）
    6. 空状态提示 + 简介文字提亮
    7. 顶部说明两行合并成一行；按钮组加"主属性/难度"分组标题
    8. 筛选栏做成吸顶工具条（position: sticky，滚动列表时固定在视口顶部）
    9. 定位标签统一中性灰（红绿蓝紫只留给主属性标签）；推荐卡竖排（头像/名字/属性）
    10. 更新日期抽全局常量 UPDATE_DATE（底部"下一步"引导卡片后经用户要求删除）
  第二批视觉美化（2026-10-06）：
    - 卡片左侧 3px 属性色竖条（力量红/敏捷绿/智力蓝/全才紫）
    - 悬停时头像放大 1.06 + 属性色光晕
    - 难度 ★ 文本换成 3 个实心难度点（卡片 + 难度页签）
    - "近战/远程"标签从标签行挪到头像正下方（用户要求），骨架屏同步加占位块
    - 难度圆点也挪进头像列（和"近战/远程"竖排），右侧标签行只剩定位标签
  官网对齐点：
    1. 卡片带头像（官网 CDN 图，hero.avatar 字段）
    2. 主属性页签：全部 / 力量 / 敏捷 / 智力 / 全才（官网同款分组，attr 精确筛选）
    3. 复杂度页签：全部 / 简单 / 中等 / 困难（官网"新手可玩"= 复杂度 1）
    4. 定位下拉框换成官网 9 种定位（核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手）
    5. 号位筛选保留（本教学站自创体系，官网没有）
  滚动动效（2026-10-13）：
    - 127 张英雄卡滚动触发入场（v-reveal），骨架卡不挂
    - 筛选栏吸住之后加深阴影、底更实（哨兵 + IntersectionObserver，见 setupSentinel）
    - 顶部横幅挂视差（v-parallax）：比卡片滚得慢一点
    - ≤640px 推荐区改成横向滑动 + 滚动吸附（全站唯一一处 snap）
    - 从详情页返回时补恢复滚动位置（见 restoreScroll）
-->
<script setup>
// Vue 组合式 API 的常用函数：
// ref      : 定义"响应式"数据（值变化时页面自动更新）
// onMounted: 生命周期钩子，组件挂载完成后执行一次（适合发请求）
// （原来还用了 computed —— 现在派生值都搬进 useHeroQuery 了，这里不再需要）
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
// lucide 图标：全站 emoji 统一换成 SVG 图标库
import { Target, Library, Eraser, SearchX, CircleX } from 'lucide-vue-next'
// useRouter：编程式导航（用代码跳转页面）
import { useRouter } from 'vue-router'
// 自己封装的 API 函数（见 api/hero.js）—— 只给"新手推荐区"用
import { getHeroList } from '../api/hero'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'
// 英雄列表的查询状态：筛选条件、分页、加载标记全在里面。
// **页码关在那个 module 里**，这里拿不到，也就没法搞错（见该文件头部的说明）
import { useHeroQuery } from '../composables/useHeroQuery'
// 值 → 标识的映射（主属性色 token 等）
import { attrToken } from '../domain/vocab'
// 从详情页"返回"过来时，本页要补恢复的滚动位置（见上面 onMounted 的说明）
import { takePendingScroll } from '../composables/scrollRestore'

const router = useRouter()

// ---------- 列表查询状态（全部来自 composable） ----------
// list 重命名成 heroes：模板里 8 处都叫 heroes，改名会让 diff 全是噪音
const {
  list: heroes,      // 已加载的英雄（"加载更多"时向后累积）
  total,             // 符合条件的英雄总数（后端返回，用来判断是否还有更多）
  loading,           // 首次/筛选加载中标记：true 时显示骨架屏
  loadingMore,       // "加载更多"进行中标记：true 时按钮显示"加载中…"
  error,             // 错误信息：非空时显示错误提示
  hasMore,           // 还有没有更多
  hasFilter,         // 有没有任何筛选生效（决定"清空"按钮是否显示）
  filters,           // 5 个筛选条件（模板里 v-model 直接绑）
  search,            // 回第 1 页重新查（首次加载 / 筛选变化 / 重试都走它）
  loadMore,          // 追加下一页
  setFilter,         // 改一个筛选条件并重查
  reset: resetFilters
} = useHeroQuery()

// 推荐区是独立请求，不受筛选影响，也不属于"查询状态"，所以留在视图里
const recommended = ref([])

// ---------- 页签选项（v-for 渲染成按钮组） ----------
// 主属性页签：官网同款四类分组
const ATTRS = ['力量', '敏捷', '智力', '全才']
// 复杂度页签：1 简单（官网"新手可玩"）/ 2 中等 / 3 困难
// level 是点数（1~3）：按钮上的难度不再写 ★ 文本，由模板渲染实心难度点
const COMPLEXITIES = [
  { value: '1', label: '简单', level: 1 },
  { value: '2', label: '中等', level: 2 },
  { value: '3', label: '困难', level: 3 }
]
// 官网 9 种定位（下拉框选项）
const ROLES = ['核心', '辅助', '爆发', '控制', '打野', '肉盾', '逃生', '推进', '先手']

// （原来的 star() 工具函数已删除：难度显示从 ★ 文本改成"实心难度点"，
//   直接由模板 v-for 渲染 3 个圆点、按复杂度点亮，不再需要拼字符串）

// ---------- 数据加载 ----------
// 主列表的加载逻辑（fetchPage / search / loadMore / setFilter / reset）
// 已经搬进 composables/useHeroQuery.js —— 页码必须和筛选条件待在一起，
// 分开就会重演「筛选变了却追加第 N 页」那类静默错乱。

// 新手推荐英雄：难度"简单"的前 8 个（后端按 id 排序，取第一页 8 条即可）。
// 失败时静默处理——推荐区只是锦上添花，不能因为它挡住主列表。
async function loadRecommended() {
  try {
    const data = await getHeroList({ page: 1, size: 8, complexity: '1' })
    recommended.value = data.list
  } catch (e) {
    // 静默失败：推荐区不显示，主列表照常
  }
}

// ---------- 筛选栏的"已吸住"状态 ----------
// 筛选栏本来就吸顶，但它吸住前后长得一模一样 —— 卡片从它下面滚过去时，
// 看着像"栏忽然压住了内容"，层次靠猜。这里在它吸住之后把阴影加深、
// 再加一层更实的底，让它明确地"浮"起来。
//
// 判据用哨兵元素 + IntersectionObserver，而不是每帧读坐标：
// 哨兵是一个 1px 高、透明的小方块，就贴在筛选栏【上面一行】。
// 它和筛选栏在文档里占同一个位置，所以"哨兵滚到顶栏后面去了"
// 和"筛选栏吸住了"是同一件事。
//
// ⚠️ 为什么非要一个哨兵，不能直接观察筛选栏自己？
//   因为它吸住了之后，自己的位置**永远停在顶栏下面**、永远不会离开视口 ——
//   观察它自己，它会一直报告"我在视口里"，状态永远翻不过去。
//   要观察的东西必须能真的滚走，所以得另放一个。
const sentinelEl = ref(null)
const barScrolled = ref(false)
let sentinelObserver = null

function setupSentinel() {
  // 顶栏高度随断点变（≤900px 从一行变两行），每次重设都重新读一遍
  const headerH =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0

  sentinelObserver?.disconnect()
  sentinelObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1]
      if (!entry) return
      // ⚠️ 判据是"哨兵的顶边越过顶栏下缘"，**不是** !isIntersecting。
      //   因为 isIntersecting 为 false 有两种截然不同的情况：
      //     ① 哨兵滚到顶栏后面去了 —— 这时筛选栏确实吸住了（要的状态）
      //     ② 哨兵还在屏幕下方、压根没进来 —— 筛选栏还好端端待在原地
      //   用 !isIntersecting 的话，页面刚打开、筛选栏离屏幕底还有一段距离时
      //   就会误判成"已吸住"，一进页面就带着吸住的样式。
      //   比较坐标就分得清 ① 和 ②：只有 ① 会让哨兵跑到顶栏下缘上面去。
      //   （观察范围被下面的 rootMargin 收窄过，所以"顶栏下缘"就是这条线）
      barScrolled.value = entry.boundingClientRect.top < headerH
    },
    // 负的 top margin 把"观察范围的顶边"从 0 挪到顶栏下缘：
    // 不加它的话，哨兵要一直滚出屏幕顶才算数 —— 而筛选栏早就吸住了
    { rootMargin: `-${headerH}px 0px 0px 0px` }
  )
  if (sentinelEl.value) sentinelObserver.observe(sentinelEl.value)
}

// ---------- 从详情页返回时，把滚动位置补回来 ----------
// 这个页面和另外三页不一样：内容要等后端。浏览器恢复滚动位置发生在
// **路由切换完成的那一刻**，那时页面上只有骨架屏、整页还不够高，
// 于是"想去 3000px"会被钳到当时的页面底部（实测 606px）—— 等数据回来
// 页面变长了，已经没人再去纠正，用户就落在列表中间某处。
//
// 所以路由把"本来该落到哪"记在 composables/scrollRestore.js 里，
// 由知道数据什么时候到的这一页自己补一次。
async function restoreScroll() {
  const top = takePendingScroll()
  if (!top) return          // 0 = 不是"返回"过来的，从顶部看就行

  // ⚠️ 必须等 nextTick：await search() 之后 list 变了，
  //   但 Vue 把新数据画进 DOM 是在下一个微任务里 ——
  //   不等它，量到的页面高度还是骨架屏那一版，白恢复一次
  await nextTick()
  // 再等一帧：让浏览器把新的布局算完再落位（图片都是 CSS 定尺寸的，
  // 不会因为加载而再次改变高度，所以这一帧之后位置就是最终的了）
  requestAnimationFrame(() => window.scrollTo(0, top))
}

// 组件挂载完成后自动加载：推荐区 + 英雄列表第一页
onMounted(async () => {
  loadRecommended()
  // fetchPage 内部把错误都吞进 error.value 了，这个 await 不会抛
  await search()
  await restoreScroll()
  setupSentinel()
  // 窗口宽度变化会改 --header-h（顶栏换行），观察范围得跟着重设
  window.addEventListener('resize', setupSentinel)
})

// ---------- 交互 ----------
// 下面几个 handler 只表达"意图"，都不再自己管页码 ——
// search() / setFilter() / reset() 内部会把页码处理好。
// 这是本阶段重构的重点：以前每个 handler 都要记得写 `page.value = 1`，
// 漏一处就出现"筛选变了却追加第 N 页"（列表静默重复或缺行）。

// 搜索防抖：输入停止 300ms 后才自动查询。
// 为什么防抖？输入"剑圣"会触发两次 input，每次都发请求太浪费；
// clearTimeout 把上一次还没执行的查询取消掉，只保留最后一次。
// 这就是"即时生效"的搜索：不用点按钮，也不用敲回车。
let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(search, 300)
}

// 组件卸载时清掉还没执行的防抖定时器和观察器，
// 否则页面都走了还发请求 / 观察器闭包一直引用着这个组件的状态（内存泄漏）
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  sentinelObserver?.disconnect()
  window.removeEventListener('resize', setupSentinel)
})

// 下拉框切换筛选（@change 即时生效）：改了条件就重查，两行都不用管页码
function onFilterChange() {
  search()
}

// 页签点击：选中该页签并查询；再点一次已选中的页签 = 取消筛选。
//
// ⚠️ 为什么要传"名字字符串"而不是传值：
//   模板里的 ref 会自动解包 —— @click="pickTab(filters.attr, a)" 传过去的是 attr 的
//   **值**（字符串"力量"），函数里没法拿它去改 filters。所以传 'attr'/'complexity'
//   这个名字，由 setFilter 去 filters 对象上取值和写值。
//
// "再点一次取消"这种切换逻辑留在视图里，没塞进 composable：
// 那是**界面手势**，不是查询状态的职责 —— composable 只该知道
// "筛选变了 → 回第 1 页重查"，不该知道"双击页签等于取消筛选"。
function pickTab(name, value) {
  const current = filters[name]
  setFilter(name, current === value ? '' : value)
}

// 点击卡片 → 跳转到详情页
function goDetail(hero) {
  // 编程式导航：等价于用户点击 <router-link to="/heroes/sven">
  // 用 slug 而不是 id —— 它是英雄的英文内部名，全表唯一且稳定，
  // 数据重灌（update_all.sh 会按官网顺序重新编号 id）之后链接依然有效。
  // 新手须知页的「代表英雄」表格也是用 slug，两处保持一致。
  router.push(`/heroes/${hero.slug}`)
}
</script>

<template>
  <div class="home">
    <!-- 顶部横幅：说明 + 数据来源合并成一行（用户要求，原来两行）。
         挂视差：往下滚时它比列表慢一点，页面有"层"的感觉 -->
    <div class="banner parallax" v-parallax="{ speed: 0.1, max: 24 }">
      <h1 class="gradient-title">英雄图鉴</h1>
      <p class="meta-line">127 名英雄 · 数据对齐 dota2.com 官网 · 点击卡片查看技能与新手打法 · 数据更新：{{ UPDATE_DATE }}</p>
    </div>

    <!-- 新手推荐英雄：难度"简单"的前 8 个（固定展示，不受下方筛选影响） -->
    <div v-if="recommended.length" class="recommend-panel">
      <h2 class="section-title"><Target :size="18" class="h-icon" />新手推荐英雄 <span class="section-sub">难度 ★ 简单 · 适合刚上手</span></h2>
      <div class="recommend-grid">
        <!-- 卡片统一竖排三行：头像 → 名字 → 属性标签；grid 默认 stretch，同行卡片等高 -->
        <div
          v-for="hero in recommended"
          :key="'rec-' + hero.id"
          class="recommend-card card"
          :data-token="attrToken(hero.attr)"
          @click="goDetail(hero)"
        >
          <img
            class="recommend-avatar"
            :src="hero.avatar"
            :alt="hero.name"
            loading="lazy"
            @error="($event) => ($event.target.style.display = 'none')"
          />
          <span class="recommend-name">{{ hero.name }}</span>
          <span class="attr-badge">{{ hero.attr }}</span>
        </div>
      </div>
    </div>

    <!-- 全部英雄：受下方筛选栏控制 -->
    <h2 class="section-title"><Library :size="18" class="h-icon" />全部英雄</h2>

    <!-- 哨兵：筛选栏的"已吸住"探针（见 script 里的 setupSentinel）。
         高度 1px + 下边距 -1px = 在布局上完全不占位置，
         但它能像普通元素一样被滚动、被观察。
         aria-hidden：它是纯装饰，读屏软件不该读它 -->
    <div class="filter-sentinel" ref="sentinelEl" aria-hidden="true"></div>

    <!-- 筛选栏：主属性页签 + 复杂度页签 + 搜索框 + 定位/号位下拉框。
         吸顶玻璃配方来自全局 .sticky-bar（position/top/模糊/边框/圆角）；
         滚上去吸住之后额外加 .scrolled，阴影加深、底更实 -->
    <div class="filter-bar sticky-bar" :class="{ scrolled: barScrolled }">
      <!-- 主属性页签：官网同款分组（力量/敏捷/智力/全才），精确筛选。
           data-token 带着该属性的颜色（见 main.css 的 [data-token="…"]），
           选中态直接读 --attr，和卡片徽章同一份定义 -->
      <div class="tab-group">
        <span class="group-label">主属性</span>
        <button
          v-for="a in ATTRS"
          :key="a"
          class="tab-btn attr-tab"
          :data-token="attrToken(a)"
          :class="{ active: filters.attr === a }"
          @click="pickTab('attr', a)"
        >{{ a }}</button>
      </div>
      <!-- 复杂度页签：官网"新手可玩"就是 1 星简单 -->
      <div class="tab-group">
        <span class="group-label">难度</span>
        <button
          v-for="c in COMPLEXITIES"
          :key="c.value"
          class="tab-btn"
          :class="{ active: filters.complexity === c.value }"
          @click="pickTab('complexity', c.value)"
        >{{ c.label }}<span class="dots">
            <i v-for="n in 3" :key="n" :class="{ on: n <= c.level }"></i>
          </span></button>
      </div>
      <!-- 搜索框（@input 即时搜索 + 300ms 防抖，没有搜索按钮）+ 定位/号位下拉框 -->
      <div class="filter-row">
        <input
          v-model="filters.keyword"
          class="search-input"
          type="text"
          placeholder="搜索英雄名 / 俗称（剑圣、冰女）/ 简介关键词"
          @input="onKeywordInput"
        />
        <select v-model="filters.role" class="filter-select" @change="onFilterChange">
          <option value="">全部定位</option>
          <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="filters.pos" class="filter-select" @change="onFilterChange">
          <option value="">全部号位</option>
          <option value="1号位">1号位</option>
          <option value="2号位">2号位</option>
          <option value="3号位">3号位</option>
          <option value="4号位">4号位</option>
          <option value="5号位">5号位</option>
        </select>
      </div>

      <!-- 结果计数 + 清除筛选：有筛选条件时才显示清除按钮 -->
      <div class="filter-meta">
        <span class="result-count">共 <strong>{{ total }}</strong> 个结果</span>
        <button v-if="hasFilter" class="reset-btn" @click="resetFilters"><Eraser :size="14" />清除筛选</button>
      </div>
    </div>

    <!-- 状态一：加载中 → 骨架屏（12 张灰色占位卡片，模拟真实卡片布局） -->
    <div v-if="loading" class="hero-grid">
      <div v-for="n in 12" :key="'sk-' + n" class="hero-card skeleton-card card">
        <!-- 头像列（骨架屏版）：头像占位 + 下方"近战/远程"标签占位 + 难度点占位，
             保持和真实卡片一样的结构，加载完成时布局不跳动 -->
        <div class="avatar-col">
          <div class="skeleton sk-avatar"></div>
          <div class="skeleton sk-attack"></div>
          <div class="skeleton sk-dots"></div>
        </div>
        <div class="skeleton sk-name"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
      </div>
    </div>

    <!-- 状态二：加载失败（后端没启动、网络错误等）
         ⚠️ 这里以前写的是 @click="loadHeroes"。Vue 对裸方法引用会把 $event 当第一个
         实参传进去，而旧 loadHeroes(append = false) 判的是真假 —— MouseEvent 是 truthy，
         于是「重试」实际走的是**追加**模式：不显示骨架屏，还把结果拼到旧列表尾部。
         首次加载失败时列表是空的，追加等于正常加载，所以一直没暴露。
         现在改成 search()：它明确是"按当前筛选条件回第 1 页重查"，没有第二个参数可传错。 -->
    <div v-else-if="error" class="status error">
      <p><CircleX :size="36" class="error-icon" /></p>
      <p>{{ error }}</p>
      <button @click="search">重试</button>
    </div>

    <!-- 状态三：正常展示
         v-else 与前两个 v-if 互斥，三种状态只会显示一种 -->
    <div v-else>
      <!-- 空状态：筛选条件太苛刻时给用户反馈 -->
      <div v-if="heroes.length === 0" class="status">
        <p><SearchX :size="36" class="empty-icon" /></p>
        <p>没有找到符合条件的英雄，换个关键词或调整筛选试试</p>
        <button @click="resetFilters"><Eraser :size="14" />清除筛选</button>
      </div>

      <div v-else class="hero-grid">
        <!-- v-for 循环渲染卡片；:key 必须唯一，Vue 用它做高效更新。
             reveal + v-reveal：卡片滚进视口时淡入上浮一次。
             首屏那批由指令判定"本来就在视口里"，直接显示、不播动画；
             "加载更多"追加的新卡挂载时还在屏幕外，滚到才会动。
             骨架卡不挂 —— 它们是临时占位，闪一下没意义 -->
        <div
          v-for="hero in heroes"
          :key="hero.id"
          class="hero-card card reveal"
          v-reveal
          :data-token="attrToken(hero.attr)"
          @click="goDetail(hero)"
        >
          <!-- 头像列：头像 + 下方"近战/远程"标签（用户要求：攻击方式贴头像下面，
               原来是挤在右边标签行里的一个小灰字） -->
          <div class="avatar-col">
            <!-- 头像：官网 CDN 图片，加载失败时隐藏不显示裂图 -->
            <img
              class="hero-avatar"
              :src="hero.avatar"
              :alt="hero.name"
              loading="lazy"
              @error="($event) => ($event.target.style.display = 'none')"
            />
            <span class="attack-tag">{{ hero.attack }}</span>
            <!-- 难度：3 个实心圆点，按复杂度点亮。
                 用户要求：和"近战/远程"一起排在头像下面（原来在右侧标签行里） -->
            <span class="dots" :title="'操作难度 ' + (hero.complexity || 1) + ' / 3'">
              <i v-for="n in 3" :key="n" :class="{ on: n <= (hero.complexity || 1) }"></i>
            </span>
          </div>
          <div class="card-main">
            <div class="card-header">
              <h2 class="hero-name">{{ hero.name }}</h2>
              <!-- 主属性徽章：力量红/敏捷绿/智力蓝/全才紫（Dota 属性配色）。
                   颜色由卡片上的 data-token 提供，徽章只管形状 -->
              <span class="attr-badge">{{ hero.attr }}</span>
            </div>
            <!-- 定位标签统一中性灰（用户要求：红绿蓝紫只留给主属性标签）；
                 攻击方式和难度点都已移到头像下面，这一行现在只剩定位标签 -->
            <div class="card-tags">
              <span class="role-tag">{{ hero.role }}</span>
            </div>
            <p class="hero-intro">{{ hero.intro }}</p>
          </div>
        </div>
      </div>

      <!-- 加载更多：还有数据时显示按钮（每次追加 24 个）；
           全部加载完显示总数提示 -->
      <div class="load-more">
        <button v-if="hasMore" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
        <span v-else class="page-info">已加载全部 {{ total }} 名英雄</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 1100px;
  margin: 0 auto;   /* 水平居中 */
  padding: 32px 24px;
}

/* 横幅的文字样式（居中、h1 字号、meta 行）在 main.css 的四页共用部分，这里不重复。
   只留一个间距：本页是普通的块级流式布局（没有 flex gap 帮忙排间距），
   横幅和下方内容之间的距离得自己给 */
.banner {
  margin-bottom: 24px;
}

/* ---------- 区块标题（新手推荐 / 全部英雄） ---------- */
.section-title {
  display: flex;      /* 图标和文字一行对齐 */
  align-items: center;
  gap: 8px;
  font-size: 20px;
  color: var(--text);
  margin-bottom: 14px;
}

/* （.h-icon 标题图标已收进 main.css 的四页共用部分） */

/* 空状态的大图标：灰色，呼应空状态的"无结果"氛围 */
.empty-icon {
  color: var(--muted-2);
  margin-bottom: 8px;
}

/* 错误状态的大图标：红色，呼应错误提示 */
.error-icon {
  color: var(--danger);
  margin-bottom: 8px;
}

.section-sub {
  font-size: 13px;
  color: var(--muted);
  font-weight: normal;
}

/* ---------- 新手推荐英雄 ---------- */
.recommend-panel {
  margin-bottom: 28px;
}

/* 推荐卡片网格：一行 8 个，窗口变窄自动换行
   min(110px, 100%)：极窄屏时列宽收缩到 100%，防止横向溢出 */
.recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(110px, 100%), 1fr));
  gap: 12px;
}

/* 底色/边框/圆角/悬停由全局 .card 统一提供（悬停上移 2px + 金边） */
.recommend-card {
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.recommend-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);   /* 图片加载前/失败时的底色 */
}

/* 推荐卡名字：单行显示，过长省略号（保证竖排三行整齐、卡片等高） */
.recommend-name {
  font-size: 14px;
  font-weight: bold;
  color: var(--text);
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 推荐区：手机端改成横滑轮播（全站唯一一处滚动吸附） ----------
   为什么只有这里用滚动吸附：宽屏下 8 张推荐卡一屏放得下，
   吸附没有作用对象；窄屏下它们会折成 3~4 行，把"新手该先看什么"
   这一屏能看完的信息推到了需要滚动的位置。
   改成一行横滑之后，手指一划、一松，卡片**自动停在格子上**（snap），
   不需要精确地对齐——这才是吸附真正解决的问题，不是"让滚动变好看" */
@media (max-width: 640px) {
  .recommend-grid {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    /* mandatory：松手一定吸附（proximity 是"差不多才吸"，手感更糊） */
    scroll-snap-type: x mandatory;
    /* 两端出血：让卡片能一直滚到屏幕边缘，视觉上像"还有更多"，
       但 padding 又把第一张/最后一张从边缘推回来，不贴边 */
    margin: 0 -24px;
    padding: 4px 24px;
    /* 滚动条在手机上本来就隐藏，桌面窄窗口下会冒出来挡住卡片底部，
       这里直接收掉——横滑的内容靠露出半张卡片暗示，不靠滚动条 */
    scrollbar-width: none;
  }

  .recommend-grid::-webkit-scrollbar {
    display: none;
  }

  .recommend-card {
    /* flex 下卡片不再被网格拉宽，得自己定宽；110px 沿用桌面端的列宽 */
    flex: 0 0 110px;
    scroll-snap-align: start;
  }
}

/* ---------- 筛选栏的"已吸住"探针 ----------
   高度 1px、下边距 -1px：在文档流里占 1px 高度但又被负边距抵消回去，
   等于**对布局零影响**，却是一个能被滚动、被 IntersectionObserver 观察的真实元素。
   为什么要 1px 不能是 0：零面积的元素在观察器里报不报"相交"各家浏览器
   历史上不一致，1px 是最省心的写法 */
.filter-sentinel {
  height: 1px;
  margin-bottom: -1px;
}

/* ---------- 筛选栏 ----------
   吸顶玻璃工具条（2026-10-07 改版）：
   原来是一块"页面底色的实心板"——浅色主题下实心板会在光斑背景上
   切出一条突兀的色带；改成和卡片同一套毛玻璃配方，
   它就从"一块遮罩"变成了"一张浮在内容上面的玻璃工具条"。
   2026-10-13：那套配方收进了全局 .sticky-bar（须知页的章节页签栏也要用），
   这里只留本页特有的布局 */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding: 14px 16px;
  /* 只过渡阴影：它是这里唯一会随滚动状态变化、又能被插值的属性 */
  transition: box-shadow var(--dur-std) var(--ease-out);
}

/* 第二层"玻璃"：和 .sticky-bar 同一个渐变，叠上去就厚了一档。
   ⚠️ 为什么要这么绕——背景是一条 linear-gradient，**渐变没法插值过渡**，
   把 background 从 A 换成 B 只会"啪"地跳过去。所以把要淡入的那层
   拿出来做成伪元素，改它能被插值的 opacity。
   ⚠️ z-index: -1 的位置很关键：.sticky-bar 有 z-index: 20，
   本身就是个层叠上下文，负 z-index 的伪元素会画在
   【父元素自己的背景之上、所有子元素之下】——正好是"覆盖层"该在的位置。
   ⚠️ 别再给 .filter-bar 加 position: relative 来"帮忙"定位：
   sticky 也是定位元素，绝对定位伪元素照样以它为参照；
   改成 relative 反而会把吸顶弄坏 */
.filter-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;   /* 跟着父元素圆角，不然四个角会露出直角 */
  background: var(--glass-bg);
  opacity: 0;
  transition: opacity var(--dur-std) var(--ease-out);
}

/* ---------- 筛选栏的"已吸住"状态 ----------
   用户要求的手法是"滚动联动"：往下一翻工具条贴住顶栏，
   它得**看起来**跟刚才不一样，否则读者分不清"这是页面的一块"
   还是"这是浮在最上面的一条"。两处变化：底更实、影子更重 */
.filter-bar.scrolled {
  box-shadow: var(--glass-shadow-hover);
}

.filter-bar.scrolled::before {
  opacity: 1;
}

/* 页签组：一排按钮，选中项高亮 */
.tab-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 按钮组分组标题（主属性/难度）：小灰字，和按钮同行（用户要求） */
.group-label {
  align-self: center;
  font-size: 12px;
  color: var(--muted-2);
  margin-right: 2px;
}

.tab-btn {
  padding: 6px 18px;
  font-size: 13px;
}

/* 页签选中态：实底填充（用户要求）——复杂度页签金色实底 + 深色文字 */
.tab-btn.active {
  border-color: var(--gold);
  background: var(--gold);
  color: var(--bg);
}

/* 主属性页签选中态：实底填充成对应属性色 + 深色文字（力量红/敏捷绿/智力蓝/全才紫）。
   颜色来自按钮自己的 data-token（见 main.css），这里只管"选中时实底填充"这个形状；
   未选中时不上色，保持默认灰。unknown 属性也会跟着 --attr 变成中性灰，不会没颜色。 */
.attr-tab.active {
  color: var(--bg);
  border-color: var(--attr);
  background: var(--attr);
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;   /* 窗口窄时自动换行 */
}

.search-input {
  flex: 1;           /* 搜索框占满剩余宽度 */
  min-width: 200px;  /* 太窄时保证可用 */
}

.filter-select {
  cursor: pointer;
}

/* 结果计数行：左边"共 N 个结果"，右边"清除筛选"按钮 */
.filter-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-count {
  color: var(--muted);
  font-size: 13px;
}

.result-count strong {
  color: var(--gold);
  font-size: 15px;
}

.reset-btn {
  background: transparent;
  border-color: var(--red);  /* Dota 红边框，暗示"危险操作" */
  color: var(--danger);
  display: inline-flex;   /* 图标和文字一行对齐 */
  align-items: center;
  gap: 5px;
}

/* 加载中 / 错误提示 / 空结果的通用样式 */
.status {
  text-align: center;
  padding: 60px 0;
  color: var(--muted);
}

.status.error {
  color: var(--danger);   /* 错误提示用红色 */
}

.status button {
  margin-top: 16px;
}

/* 卡片网格：自动填充布局
   repeat(auto-fill, minmax(min(320px, 100%), 1fr))：
   每列最少 320px，窗口变宽自动加列，实现响应式；
   min(320px, 100%) 保证极窄屏（<320px 视口）时列宽收缩到 100%，不横向溢出 */
.hero-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 20px;        /* 卡片间距 */
}

/* 底色/边框/圆角/悬停由全局 .card 统一提供
   （悬停上浮 4px + 金边 + 金色投影；骨架屏卡片 pointer-events:none 不响应悬停） */
.hero-card {
  padding: 16px;
  cursor: pointer;  /* 可点击的暗示 */
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.skeleton-card {
  cursor: default;  /* 占位卡片不可点击 */
  pointer-events: none;
}

/* ---------- 性能：卡片网格关掉毛玻璃的模糊 ----------
   .card 的 backdrop-filter 会把"卡片背后的画面"实时拍一张、模糊、再合成，
   这个开销是按元素数量走的。本页一次性最多有 127 张英雄卡 + 12 张骨架卡，
   每张都做一次模糊，滚动时会明显掉帧。

   关掉会不会变丑？几乎不会——模糊只有在"背后有清晰纹理"时才有视觉意义，
   而卡片背后是页面底色 + 三团大面积柔光斑（本来就是糊的），
   对着一片已经是渐变的背景再模糊一次，结果和没模糊基本一样。
   真正让卡片显"玻璃"的是半透明底 + 顶部内高光 + 柔和投影，这三样都还在。
   所以这里只关模糊、保留其余玻璃质感；
   大面板（详情页/进阶页的 .panel）一页只有几个，模糊照留。
   （横幅 .banner 从 2026-10-13 起是纯文字块，已经没有模糊了） */
.hero-card,
.recommend-card,
.skeleton-card {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ---------- 3px 属性竖条（第二批） ----------
   卡片最左侧一条属性色竖条：不点开详情也能一眼看出主属性。
   实现：卡片挂 data-token（模板 :data-token="attrToken(hero.attr)"），
   main.css 把属性色写进 --attr，这里只管"3px 贴左边"这个形状。
   .card 是 12px 圆角，竖条要贴圆角裁切，所以卡片 overflow: hidden
   （不影响悬停的位移动画） */
.hero-card,
.recommend-card {
  position: relative;
  overflow: hidden;
}

.hero-card::before,
.recommend-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--attr, transparent);
}

/* ---------- 头像放大 + 发光（第二批） ----------
   悬停卡片时头像轻微放大（1.06）并浮起一圈属性色光晕。
   过渡写在常态上，移出时同样有动画 */
.hero-avatar,
.recommend-avatar {
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.hero-card:hover .hero-avatar,
.recommend-card:hover .recommend-avatar {
  transform: scale(1.06);
  border-color: var(--attr);
  box-shadow: 0 0 18px var(--attr-glow);
}

/* ---------- 实心难度点（第二批） ----------
   3 个圆点，亮 complexity 个（替代原来的 ★ 文本）：
   点亮的填金色实心，未点亮的是空心描边，1/2/3 星一眼可辨 */
.dots {
  display: inline-flex;
  gap: 3px;
  vertical-align: middle;
}

.dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--muted);
}

.dots i.on {
  background: var(--gold);
  border-color: var(--gold);
}

/* 难度页签里的点跟在文字后面，留一点间距 */
.tab-btn .dots {
  margin-left: 6px;
}

/* 难度页签选中时按钮是金色实底，金色点会"隐身"——
   把点反过来用页面底色画：实心=深色点，空心=深色描边 */
.tab-btn.active .dots i {
  border-color: var(--bg);
}

.tab-btn.active .dots i.on {
  background: var(--bg);
  border-color: var(--bg);
}

/* ---------- 头像列：头像 + 下方攻击方式标签 ---------- */
/* 头像和"近战/远程"标签竖排成一组，整体作为一个单位参与卡片的横向布局 */
.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;   /* 标签在头像正下方居中 */
  gap: 6px;
  flex-shrink: 0;        /* 在卡片的横向 flex 里不被压缩 */
}

/* "近战/远程"标签：头像下方的小号灰字。
   用户要求去掉圆框——原来的描边 + 圆角 + 淡底（胶囊样式）全部删掉，只留纯文字；
   margin-top 是在头像列的 gap(6px) 之上再加 6px —— 合计 12px：
   让它和头像拉开距离（用户要求），同时又和下面的难度点（保持 6px）凑成一组 */
.attack-tag {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1;
  color: var(--muted);
  white-space: nowrap;
}

.hero-avatar {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);   /* 图片加载前/失败时的底色 */
  flex-shrink: 0;        /* 不随卡片内容压缩 */
}

/* 头像加载失败时的兜底：显示首字（配合模板里的 @error 隐藏逻辑用不上，
   这里主要给 CDN 慢的情况一个底色） */

.card-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;          /* 占满头像右侧剩余宽度 */
  min-width: 0;     /* 允许内部文字换行收缩 */
}

/* 骨架屏内的占位块尺寸：模拟真实卡片的内容布局 */
.sk-avatar {
  width: 72px;
  height: 72px;
}

/* 头像下方"近战/远程"标签的占位块（尺寸按去掉圆框后的纯文字调整，
   margin-top 和 .attack-tag 保持一致，骨架屏和真卡间距才对得上） */
.sk-attack {
  margin-top: 6px;
  width: 26px;
  height: 11px;
  border-radius: 2px;
}

/* 头像下方难度点的占位块（一条细横条，代表 3 个点） */
.sk-dots {
  width: 30px;
  height: 6px;
  border-radius: 999px;
}

.sk-name {
  width: 60%;
  height: 20px;
}

.sk-line {
  width: 100%;
  height: 14px;
}

.sk-line.short {
  width: 60%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-name {
  font-size: 20px;
  color: var(--text);
}

/* 主属性徽章：小方块，Dota 属性配色（力量红/敏捷绿/智力蓝/全才紫）。
   颜色不在这里 —— 徽章是卡片的后代，直接继承卡片 data-token 定下的 --attr。
   用户要求方角：原来是 999px 胶囊，现在 4px 小圆角（和全站圆角风格不打架的"方形"） */
.attr-badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid var(--attr);
  color: var(--attr);
  background: var(--attr-tint);
}

/* 卡片第二行：定位标签 + 攻击方式/难度 */
.card-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 定位标签：小圆角胶囊，统一中性灰描边（用户要求：
   红绿蓝紫只留给主属性标签，定位标签不再各自配色） */
.role-tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;   /* 胶囊形 */
  border: 1px solid var(--muted);
  color: var(--muted);
  background: var(--muted-tint);
}

/* （.meta-tag 已删除：攻击方式移到头像下面了，原样式没人用） */

.hero-intro {
  font-size: 13px;
  color: var(--muted);   /* 比 var(--muted) 亮一档：简介在深色卡片上对比度更高 */
  /* 最多显示 3 行，超出省略，保证卡片高度一致 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ---------- 加载更多 ---------- */
.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 32px;
}

/* 请求进行中：按钮变半透明，光标提示等待 */
.load-more button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.page-info {
  color: var(--muted);
  font-size: 14px;
}
</style>
