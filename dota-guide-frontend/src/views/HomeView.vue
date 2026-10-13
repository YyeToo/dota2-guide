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
-->
<script setup>
// Vue 组合式 API 的常用函数：
// ref      : 定义"响应式"数据（值变化时页面自动更新）
// computed : 计算属性（由其他数据推导出的值，自动缓存）
// onMounted: 生命周期钩子，组件挂载完成后执行一次（适合发请求）
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
// lucide 图标：全站 emoji 统一换成 SVG 图标库
import { Target, Library, Eraser, SearchX, CircleX } from 'lucide-vue-next'
// useRouter：编程式导航（用代码跳转页面）
import { useRouter } from 'vue-router'
// 自己封装的 API 函数（见 api/hero.js）
import { getHeroList } from '../api/hero'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'

const router = useRouter()

// ---------- 页面状态 ----------
const heroes = ref([])         // 已加载的英雄（"加载更多"时向后累积）
const recommended = ref([])    // 新手推荐英雄：难度"简单"的前 8 个（独立请求，不受筛选影响）
const total = ref(0)           // 符合条件的英雄总数（后端返回，用来判断是否还有更多）
const loading = ref(false)     // 首次/筛选加载中标记：true 时显示骨架屏
const loadingMore = ref(false) // "加载更多"进行中标记：true 时按钮显示"加载中…"
const error = ref('')          // 错误信息：非空时显示错误提示

// ---------- 筛选条件（v-model 双向绑定到表单控件） ----------
const keyword = ref('')     // 搜索关键词（匹配英雄名/简介）
const role = ref('')        // 定位筛选：官网 9 定位之一，'' 表示全部
const pos = ref('')         // 号位筛选：1-5号位，'' 表示全部
const attr = ref('')        // 主属性筛选：力量/敏捷/智力/全才，'' 表示全部
const complexity = ref('')  // 复杂度筛选：1/2/3，'' 表示全部

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

// ---------- 加载更多状态 ----------
const page = ref(1)         // 当前已加载到第几页，从 1 开始
const size = 24             // 每次加载的条数

// 还有没有更多：已加载数量 < 总数
const hasMore = computed(() => heroes.value.length < total.value)

// 有没有任何筛选生效（决定"清空"按钮是否显示）
const hasFilter = computed(() => keyword.value || role.value || pos.value || attr.value || complexity.value)

// （原来的 star() 工具函数已删除：难度显示从 ★ 文本改成"实心难度点"，
//   直接由模板 v-for 渲染 3 个圆点、按复杂度点亮，不再需要拼字符串）

// ---------- 数据加载 ----------
// append 参数：false = 重新加载第 1 页（筛选变化时），true = 追加下一页（"加载更多"）
async function loadHeroes(append = false) {
  // 两种加载用两个独立的状态：整页骨架屏 vs 按钮上的"加载中…"
  // （追加时不能把整个列表换成骨架屏，否则页面会闪一下）
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''      // 清空上一次的错误
  try {
    // 组装查询参数：只把非空的筛选条件传给后端
    // 后端 attr/complexity 是精确匹配（=），role/pos 是模糊匹配（LIKE）
    const params = { page: page.value, size }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (role.value) params.role = role.value
    if (pos.value) params.pos = pos.value
    if (attr.value) params.attr = attr.value
    if (complexity.value) params.complexity = complexity.value

    // 后端返回 { total, list }（拦截器已把 data 解出来）
    const data = await getHeroList(params)
    // 追加模式：新数据拼到旧列表尾部；重新加载：直接替换
    heroes.value = append ? [...heroes.value, ...data.list] : data.list
    total.value = data.total
  } catch (e) {
    // 失败：把原因展示到页面上（如"后端没启动""网络错误"）
    error.value = e.message || '加载失败，请确认后端服务已启动'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

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

// 组件挂载完成后自动加载：推荐区 + 英雄列表第一页
onMounted(() => {
  loadRecommended()
  loadHeroes()
})

// ---------- 交互 ----------
// 搜索防抖：输入停止 300ms 后才自动查询。
// 为什么防抖？输入"剑圣"会触发两次 input，每次都发请求太浪费；
// clearTimeout 把上一次还没执行的查询取消掉，只保留最后一次。
// 这就是"即时生效"的搜索：不用点按钮，也不用敲回车。
let searchTimer = null
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadHeroes()
  }, 300)
}

// 组件卸载时清掉还没执行的防抖定时器，避免页面都走了还发请求
onBeforeUnmount(() => clearTimeout(searchTimer))

// 下拉框切换筛选：自动重置到第 1 页并查询（@change 即时生效）
function onFilterChange() {
  page.value = 1
  loadHeroes()
}

// 页签点击：选中该页签并查询；再点一次已选中的页签 = 取消筛选
// ⚠️ 为什么传"名字字符串"而不是传 ref 对象：
//   Vue 模板里的 ref 会自动解包——@click="pickTab(attr, a)" 传过去的是 attr 的"值"（字符串），
//   不是 ref 本身，函数里写 attr.value 就会报错。所以这里传 'attr'/'complexity' 名字，
//   在函数内部用 script 里的 ref 变量（script 里不会自动解包，.value 正常用）。
function pickTab(name, value) {
  const target = name === 'attr' ? attr : complexity
  target.value = target.value === value ? '' : value
  page.value = 1
  loadHeroes()
}

// "加载更多"：页码 +1，把下一页数据追加到列表尾部
function loadMore() {
  page.value += 1
  loadHeroes(true)
}

// 清空所有筛选条件
function resetFilters() {
  keyword.value = ''
  role.value = ''
  pos.value = ''
  attr.value = ''
  complexity.value = ''
  page.value = 1
  loadHeroes()
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
    <!-- 顶部横幅：说明 + 数据来源合并成一行（用户要求，原来两行） -->
    <div class="banner">
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
          :class="'stripe-' + hero.attr"
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
          <span class="attr-badge" :class="'attr-' + hero.attr">{{ hero.attr }}</span>
        </div>
      </div>
    </div>

    <!-- 全部英雄：受下方筛选栏控制 -->
    <h2 class="section-title"><Library :size="18" class="h-icon" />全部英雄</h2>

    <!-- 筛选栏：主属性页签 + 复杂度页签 + 搜索框 + 定位/号位下拉框
         position: sticky 吸顶（见样式区）：往下翻列表时筛选栏固定在视口顶部 -->
    <div class="filter-bar">
      <!-- 主属性页签：官网同款分组（力量/敏捷/智力/全才），精确筛选。
           选中色与卡片徽章一致（见样式区 .attr-btn-力量.active 等） -->
      <div class="tab-group">
        <span class="group-label">主属性</span>
        <button
          v-for="a in ATTRS"
          :key="a"
          class="tab-btn attr-tab"
          :class="['attr-btn-' + a, { active: attr === a }]"
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
          :class="{ active: complexity === c.value }"
          @click="pickTab('complexity', c.value)"
        >{{ c.label }}<span class="dots">
            <i v-for="n in 3" :key="n" :class="{ on: n <= c.level }"></i>
          </span></button>
      </div>
      <!-- 搜索框（@input 即时搜索 + 300ms 防抖，没有搜索按钮）+ 定位/号位下拉框 -->
      <div class="filter-row">
        <input
          v-model="keyword"
          class="search-input"
          type="text"
          placeholder="搜索英雄名 / 俗称（剑圣、冰女）/ 简介关键词"
          @input="onKeywordInput"
        />
        <select v-model="role" class="filter-select" @change="onFilterChange">
          <option value="">全部定位</option>
          <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="pos" class="filter-select" @change="onFilterChange">
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

    <!-- 状态二：加载失败（后端没启动、网络错误等） -->
    <div v-else-if="error" class="status error">
      <p><CircleX :size="36" class="error-icon" /></p>
      <p>{{ error }}</p>
      <button @click="loadHeroes">重试</button>
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
        <!-- v-for 循环渲染卡片；:key 必须唯一，Vue 用它做高效更新 -->
        <div
          v-for="hero in heroes"
          :key="hero.id"
          class="hero-card card"
          :class="'stripe-' + hero.attr"
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
              <!-- 主属性徽章：力量红/敏捷绿/智力蓝/全才紫（Dota 属性配色） -->
              <span class="attr-badge" :class="'attr-' + hero.attr">{{ hero.attr }}</span>
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

.banner {
  text-align: center;
  margin-bottom: 24px;
}

.banner h1 {
  font-size: 32px;
  /* 颜色由全局 .gradient-title 提供（白→金渐变），这里不写 color */
  margin-bottom: 8px;
}

.banner p {
  color: var(--muted);
  font-size: 14px;
}

/* "基于版本 / 更新日期"一行（各内容页统一） */
.meta-line {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted-2);
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

/* 标题里的 SVG 图标 */
.h-icon {
  color: var(--gold);
  flex-shrink: 0;
}

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

/* ---------- 筛选栏 ----------
   吸顶玻璃工具条（2026-10-07 改版）：
   原来是一块"页面底色的实心板"——浅色主题下实心板会在光斑背景上
   切出一条突兀的色带；改成和卡片同一套毛玻璃配方，
   它就从"一块遮罩"变成了"一张浮在内容上面的玻璃工具条"，
   和参考站里那些浮动的玻璃面板是同一个语言 */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  /* 吸顶工具条（用户要求）：往下翻英雄列表时，筛选栏固定在视口顶部 */
  position: sticky;
  top: var(--header-h);     /* 让开吸顶顶栏的高度（main.css 定义，随断点变化） */
  z-index: 20;              /* 盖过下方卡片（顶栏 z-index 50 在其上） */
  background: var(--glass-bg);   /* 毛玻璃底：盖住滚上来的卡片，又不完全挡死 */
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--glass-shadow);
  padding: 14px 16px;
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
   模板里按钮的 class 是 'attr-btn-' + 属性名（如 attr-btn-力量），
   只有同时带 active 才上色——未选中时保持默认灰。 */
.attr-btn-力量.active { color: var(--bg); border-color: var(--str); background: var(--str); }
.attr-btn-敏捷.active { color: var(--bg); border-color: var(--agi); background: var(--agi); }
.attr-btn-智力.active { color: var(--bg); border-color: var(--int); background: var(--int); }
.attr-btn-全才.active { color: var(--bg); border-color: var(--all); background: var(--all); }

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
   所以这里只关模糊、保留其余玻璃质感；大面板（.panel/.banner）数量少，模糊照留 */
.hero-card,
.recommend-card,
.skeleton-card {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ---------- 3px 属性竖条（第二批） ----------
   卡片最左侧一条属性色竖条：不点开详情也能一眼看出主属性。
   实现：给卡片加 stripe-属性 类（模板 :class="'stripe-' + hero.attr"），
   类里把属性色写进 --stripe 变量；.card 是 12px 圆角，
   竖条要贴圆角裁切，所以卡片 overflow: hidden（不影响悬停的位移动画） */
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
  background: var(--stripe, transparent);
}

/* 四种主属性 → 竖条色 + 发光色：stripe-属性 类定义在 main.css（全局），
   图鉴卡片和详情页横幅共用 */

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
  border-color: var(--stripe);
  box-shadow: 0 0 18px var(--stripe-glow);
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
   用户要求方角：原来是 999px 胶囊，现在 4px 小圆角（和全站圆角风格不打架的"方形"） */
.attr-badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid;
}

.attr-力量 { color: var(--str); border-color: var(--str); background: var(--str-tint); }
.attr-敏捷 { color: var(--agi); border-color: var(--agi); background: var(--agi-tint); }
.attr-智力 { color: var(--int); border-color: var(--int); background: var(--int-tint); }
.attr-全才 { color: var(--all); border-color: var(--all); background: var(--all-tint); }

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
