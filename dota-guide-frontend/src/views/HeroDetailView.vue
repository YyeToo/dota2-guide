<!--
  详情页：展示单个英雄的完整资料（简介 / 技能 / 克制 / 打法建议）
  数据流：从路由参数拿 key（数字 id 或 slug，如 /heroes/18 或 /heroes/sven）
          → 调用后端 GET /api/heroes/{key}（后端自己判断是 id 还是 slug）
          → 后端 LEFT JOIN 技能表，返回 { 英雄字段..., skills: [...] }
  第二批视觉美化（2026-10-06）：
    - 头部改成卡片式"英雄横幅"：左侧主属性色竖条 + 淡光晕 + 头像描边/发光
    - 侧栏属性速览：难度、号位加数值进度条；主属性值用属性色
    - 技能卡：大招/魔晶/神杖卡左侧 3px 色条，悬停按键徽章放大
  滚动动效（2026-10-13）：
    - 横幅头像挂视差（v-parallax）：比名字/徽章滚得慢一点
    - 四个左侧/主列面板 + 技能卡挂滚动触发入场（v-reveal），技能卡逐张错开 60ms
    - 侧栏进度条改成"滚到才从 0 长到目标宽度"，只长一次
    - goBack() 改成优先 router.back()：否则返回列表页拿不回滚动位置
-->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getHeroDetail } from '../api/hero'
// 系统"减弱动态效果"的首选项（进度条在那种情况下直接给终态，不走观察器）
import { prefersReducedMotion } from '../motion'
// lucide 图标：全站 emoji 统一换成 SVG 图标库
import { Target, BookOpen, Swords, Gem, ClipboardList, Scale, CircleX, ArrowLeft } from 'lucide-vue-next'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'
// 值 → 界面标识的映射（主属性色 token、技能徽章、技能色条类名）
import { attrToken, categoryBadge, skillBarClass } from '../domain/vocab'
// 技能的领域谓词（算不算"强化类"、算不算"先天"）
import { isUpgradeSkill, isInnate } from '../domain/skill'
// 英雄字段的展示换算（定位拆分 / 难度星 / 号位进度条）
import { splitRoles, complexityStars, posFillPercent } from '../domain/hero'

// router/index.js 里配了一个 props 函数，把 URL 里的 :key 改名成 heroKey 传进来：
//   访问 /heroes/sven 这里 heroKey 是 "sven"（站内链接都用 slug）
//   访问 /heroes/3    这里 heroKey 是 "3"（老书签，还是能打开）
// 两种都是字符串。不用在这里分辨是哪种 —— 后端一个地址就认下了。
//
// 为什么不直接叫 key：key 是 Vue 的保留属性名，声明成 prop 会永远收到 undefined
// （详见 router/index.js 里的注释）。
const props = defineProps({
  heroKey: { type: String, required: true }
})

const router = useRouter()

const hero = ref(null)    // 英雄详情数据（含 skills 数组）
const loading = ref(true)
const error = ref('')

// 技能分两类展示：
//   1. keyedSkills   —— 有按键的独立技能（Q/W/E/R 基础技能 + 魔晶/神杖"新增"的 D/F）
//   2. upgradeSkills —— "强化类"（魔晶/神杖只强化已有技能、不占新按键）
//     这类技能单独放一个面板展示，不标按键字母
//
// 判据、徽章、色条这三件事的实现都搬去了 src/domain/ —— 它们是"技能值长什么样"
// 的领域知识，不是这个页面的视图规则。这里只剩"把 hero 塞进去"的接线。
const keyedSkills = computed(() => (hero.value?.skills || []).filter((s) => !isUpgradeSkill(s)))
const upgradeSkills = computed(() => (hero.value?.skills || []).filter(isUpgradeSkill))

// 官网定位（role 字段）是顿号分隔的多个标签（如"核心、控制、肉盾、先手"），
// 拆成数组后逐个渲染成小徽章
const roleList = computed(() => splitRoles(hero.value?.role))

// 复杂度 1/2/3 → ★/★★/★★★，头部徽章展示
const starText = computed(() => complexityStars(hero.value?.complexity))

// 号位 → "资源优先级"进度条填充百分比（第二批新加，侧栏属性速览用）。
// 解析不出合法号位（1~5）时是 0，模板里 v-if 判断不渲染进度条
const posFill = computed(() => posFillPercent(hero.value?.pos))

async function loadHero() {
  loading.value = true
  error.value = ''
  try {
    // heroKey 是字符串（"sven" 或 "3"）都行：axios 拼进 URL，后端自己分辨是 id 还是 slug
    hero.value = await getHeroDetail(props.heroKey)
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadHero)

// ---------- 侧栏进度条：滚到才从 0 长到目标宽度 ----------
// 难度和号位这两条进度条本来是一进页面就"啪"地满格。
// 现在从 0 长出去，长度本身就成了"这个英雄有多难 / 多能吃资源"的示意。
//
// 目标宽度不在 CSS 里，也不在这段 JS 里 —— 它由模板内联写在 <i> 的 --target 上，
// 样式只管"该不该长"（.side-col.filled）。原因：内联 style 的权重最高，
// 类选择器压不过它，所以内联只能写**数据**（目标多长），不能写**状态**（现在多长）。
const sideColEl = ref(null)
const sideFilled = ref(false)
let sideObserver = null

// ⚠️ 盯的是**元素本身**（模板 ref），不是 hero。
//   .side-col 只在"加载完成且没出错"那一支里渲染，盯着 hero 的话，
//   回调跑起来时那个分支可能还没渲染完、元素还是 null，观察器就永远建不起来。
//   而模板 ref 从 null 变成元素的那一刻，正好就是这个元素真正进 DOM 的时刻。
//   flush: 'post' —— ref 是在 DOM 更新过程中赋值的，默认的 'pre' 会跑在它前面。
watch(
  sideColEl,
  (el) => {
    sideObserver?.disconnect()
    sideObserver = null
    if (!el) return

    if (prefersReducedMotion()) {
      // 不走观察器、也不留 0 宽的那一帧，直接给终态
      sideFilled.value = true
      return
    }

    sideObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (!entry?.isIntersecting) return
        sideFilled.value = true
        // 一次性：长完就断开，之后再怎么滚都不重播
        // （切换英雄时 hero 变了也不会回到 0 再长一遍 —— 那种"每次都演一遍"
        //   的动画第二次看就只剩烦躁了）
        sideObserver.disconnect()
        sideObserver = null
      },
      // 底部往上收 10%：进度条要露出来一点才动
      { rootMargin: '0px 0px -10% 0px' }
    )
    sideObserver.observe(el)
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  sideObserver?.disconnect()
  sideObserver = null
})

// 返回列表页（英雄图鉴在 /heroes）
//
// ⚠️ 优先 router.back()，而不是 router.push('/heroes')：
//   push 是**新开**一条历史记录，等于"又去了一次列表页"，
//   浏览器的滚动恢复拿不到 savedPosition（见 router/index.js 的 scrollBehavior），
//   于是每次返回都把用户扔回列表顶部 —— 而他刚刚明明是在第 80 张卡那里点进来的。
//   back() 才是"回到刚才那一页"，滚动位置、筛选条件都还在。
//
//   但不能无脑 back()：直接打开链接 / 从收藏夹进来时**站内没有上一页**，
//   back() 会把人送出站外。history.state.back 是 vue-router 记下的"上一页在站内的地址"，
//   它为空就说明没有可回的地方，老老实实跳到列表页当兜底。
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/heroes')
}
</script>

<template>
  <div class="detail">
    <!-- 状态一：加载中 → 骨架屏（占位块模拟页面结构） -->
    <div v-if="loading" class="detail-body">
      <div class="skeleton sk-btn"></div>
      <div class="skeleton sk-title"></div>
      <div class="skeleton sk-panel"></div>
      <div class="skeleton sk-panel tall"></div>
    </div>

    <!-- 状态二：加载失败 -->
    <div v-else-if="error" class="status error">
      <p><CircleX :size="36" class="error-icon" /></p>
      <p>{{ error }}</p>
      <button @click="loadHero">重试</button>
      <button @click="goBack">返回列表</button>
    </div>

    <!-- 状态三：正常展示 -->
    <!-- ⚠️ data-token 挂在这一层，不是挂在横幅上。
         因为要用主属性色的不只是横幅里的东西（竖条 / 光晕 / 徽章 / 头像描边），
         还有右栏「属性速览」里那个主属性值 —— 而右栏是横幅的**兄弟**，不是后代。
         挂在横幅上的话 --attr 传不到右栏，`color: var(--attr)` 会静默失效
         （变量没定义时声明整条作废，文字退回默认色，不报错）。
         挂在共同祖先上，一套 --attr 供两处用，且换英雄只改这一个属性。
         骨架屏/错误分支不需要颜色，所以不挂在外层的 .detail 上 -->
    <div v-else class="detail-body" :data-token="attrToken(hero.attr)">
      <button class="back-btn" @click="goBack"><ArrowLeft :size="14" />返回列表</button>

      <!-- 英雄横幅（第二批改造：原来是裸排的头像+文字，现在包成卡片式横幅）：
           头像 + 名字 + 基础徽章 + 官方定位标签；
           颜色读祖先的 data-token 写下的 --attr（main.css 全局定义），
           横幅的左侧竖条、背景光晕、头像描边/发光都跟着主属性变色 -->
      <div class="hero-header card">
        <!-- 头像挂视差：往下滚时它比名字/徽章慢一点点，横幅有了"厚度"。
             ⚠️ 位移上限 16px 是被横幅内边距（上下各 20px）卡死的：
             横幅是 overflow: hidden，位移超过内边距头像就会被切掉一块 -->
        <img
          class="hero-avatar parallax"
          v-parallax="{ speed: 0.08, max: 16 }"
          :src="hero.avatar"
          :alt="hero.name"
          @error="($event) => ($event.target.style.display = 'none')"
        />
        <div class="header-info">
          <h1 class="gradient-title">{{ hero.name }}</h1>
          <!-- 主属性 / 攻击方式 / 复杂度 / 号位 四个基础徽章 -->
          <div class="header-tags">
            <span class="attr-badge">{{ hero.attr }}</span>
            <span class="meta-badge">{{ hero.attack }}</span>
            <span class="meta-badge">难度 {{ starText }}</span>
            <span v-if="hero.pos" class="meta-badge">{{ hero.pos }}</span>
          </div>
          <!-- 官网 9 定位：顿号分隔的多标签逐个渲染 -->
          <div class="role-tags">
            <span v-for="r in roleList" :key="r" class="role-tag">{{ r }}</span>
          </div>
        </div>
      </div>

      <!-- 打法建议面板：教学站最核心的内容，放头部正下方 + 金色描边，一眼就看到。
           它和下面几个面板都挂 v-reveal：滚到才淡入上浮一次
           （横幅不挂 —— 它是页面第一眼，让它等一下再出现只会显得慢） -->
      <section class="panel tips-panel card reveal" v-reveal>
        <h2><Target :size="18" class="h-icon" />打法建议</h2>
        <p>{{ hero.tips }}</p>
      </section>

      <!-- 两栏主体：左 = 主内容（简介/技能/强化），右 = 侧栏（属性速览/克制关系）
           Grid 两栏布局由样式区的 .content-grid 控制 -->
      <div class="content-grid">
        <div class="main-col">
          <!-- 简介面板 -->
          <section class="panel card reveal" v-reveal>
            <h2><BookOpen :size="18" class="h-icon" />英雄简介</h2>
            <p>{{ hero.intro }}</p>
          </section>

          <!-- 技能面板：skills 数组来自后端的一对多 JOIN 查询 -->
          <section class="panel card reveal" v-reveal>
            <h2><Swords :size="18" class="h-icon" />技能介绍</h2>
            <div class="skill-grid">
              <!-- 技能卡逐张错开 60ms 出场（i % 3 让每行内的三张错开，
                   第四张又回到 0 —— 一行一行地"铺"下来，而不是整片一起冒）。
                   ⚠️ 卡片上的 :class 是动态绑定的，v-reveal 对此是安全的，
                   但前提是绑定值对同一张卡**不会变**（skillBarClass 只跟按键字母有关，
                   见 directives/reveal.js 顶部那条约束） -->
              <div
                v-for="(skill, i) in keyedSkills"
                :key="skill.id"
                class="skill-card card card-sm reveal"
                v-reveal="60 * (i % 3)"
                :class="skillBarClass(skill)"
              >
                <!-- 按键徽章：Q/W/E 灰色，R（大招）金色，D（魔晶新技能）紫色，F（神杖新技能）蓝色 -->
                <span class="skill-key">{{ skill.skillKey }}</span>
                <div class="skill-info">
                  <!-- 技能名 + 四个状态徽章：先天（青）/ 被动（灰）/ 魔晶（紫）/ 神杖（金） -->
                  <div class="skill-title">
                    <h3>{{ skill.skillName }}</h3>
                    <span v-if="isInnate(skill)" class="badge badge-innate">先天</span>
                    <span v-if="skill.skillType === '被动'" class="badge badge-passive">被动</span>
                    <span v-if="categoryBadge(skill)" class="badge" :class="categoryBadge(skill).cls">{{ categoryBadge(skill).text }}</span>
                  </div>
                  <p>{{ skill.skillDesc }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 魔晶/神杖强化面板：只强化已有技能、不占新按键，所以不标按键字母 -->
          <section v-if="upgradeSkills.length" class="panel card reveal" v-reveal>
            <h2><Gem :size="18" class="h-icon" />魔晶 / 神杖强化</h2>
            <div class="skill-grid">
              <div
                v-for="(skill, i) in upgradeSkills"
                :key="skill.id"
                class="skill-card card card-sm reveal"
                v-reveal="60 * (i % 3)"
              >
                <div class="skill-info">
                  <div class="skill-title">
                    <h3>{{ skill.skillName }}</h3>
                    <span v-if="isInnate(skill)" class="badge badge-innate">先天</span>
                    <span v-if="skill.skillType === '被动'" class="badge badge-passive">被动</span>
                    <span v-if="categoryBadge(skill)" class="badge" :class="categoryBadge(skill).cls">{{ categoryBadge(skill).text }}</span>
                  </div>
                  <p>{{ skill.skillDesc }}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- 右栏：侧栏（窄栏固定宽度，信息速览用）。
             ref 用来挂"进度条该长了"的观察器；filled 就是这个状态（见 script） -->
        <aside class="side-col" :class="{ filled: sideFilled }" ref="sideColEl">
          <!-- 属性速览面板：和头部徽章信息相同，但这里用"标签:值"的表格形式，一眼扫全。
               第二批：数值型的项（难度/号位）在下面加了一条进度条，见下 -->
          <section class="panel card">
            <h2><ClipboardList :size="18" class="h-icon" />属性速览</h2>
            <ul class="stat-list">
              <li>
                <div class="stat-line">
                  <span class="stat-label">主属性</span>
                  <!-- 主属性值用属性色显示（和图鉴徽章同色系），不用进度条：
                       力量/敏捷/智力是"分类"不是"数值"，画进度条没有意义 -->
                  <span class="stat-value attr-text">{{ hero.attr }}</span>
                </div>
              </li>
              <li>
                <div class="stat-line">
                  <span class="stat-label">攻击方式</span>
                  <span class="stat-value">{{ hero.attack }}</span>
                </div>
              </li>
              <li>
                <div class="stat-line">
                  <span class="stat-label">操作难度</span>
                  <span class="stat-value">{{ starText }}</span>
                </div>
                <!-- 难度进度条：复杂度 1~3 映射成 33% / 66% / 100% 填充。
                     ⚠️ 内联写的是 --target（目标宽度），不是 width（当前宽度）：
                     内联 style 的权重最高，把 width 写在这里的话 CSS 就再也压不动它，
                     进度条会长不出来。当前宽度由样式根据 .side-col.filled 决定 -->
                <div class="stat-bar">
                  <i :style="{ '--target': ((hero.complexity || 1) / 3) * 100 + '%' }"></i>
                </div>
              </li>
              <li v-if="hero.pos">
                <div class="stat-line">
                  <span class="stat-label">推荐号位</span>
                  <span class="stat-value">{{ hero.pos }}</span>
                </div>
                <!-- 资源优先级进度条：1 号位吃资源最多（满格）→ 5 号位最少（1/5 格），
                     填充比例由 script 里的 posFill 算好 -->
                <div v-if="posFill" class="stat-bar">
                  <i :style="{ '--target': posFill + '%' }"></i>
                </div>
              </li>
            </ul>
          </section>

          <!-- 克制关系面板 -->
          <section class="panel card">
            <h2><Scale :size="18" class="h-icon" />克制关系</h2>
            <p>{{ hero.counters || '暂无数据' }}</p>
          </section>
        </aside>
      </div>

      <!-- "基于版本 / 更新日期"一行（各内容页统一，日期抽全局常量 UPDATE_DATE） -->
      <p class="meta-line">英雄数据来源 dota2.com 官网 · 数据更新：{{ UPDATE_DATE }} · 以游戏内最新版本为准</p>
    </div>
  </div>
</template>

<style scoped>
.detail {
  max-width: 1100px;  /* 两栏布局需要更宽的空间（原来是单列的 800px） */
  margin: 0 auto;
  padding: 32px 24px;
}

/* ---------- 两栏主体布局 ---------- */
/* Grid 两栏：左栏 1fr 自适应撑满剩余宽度，右侧栏固定 320px */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;  /* 两栏顶部对齐，各自高度独立：左高右矮时右栏不会被拉伸 */
}

/* 左栏 / 右栏内部都是纵向排列多个面板，间距保持一致 */
.main-col,
.side-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 防止技能卡等宽内容把 Grid 左栏撑破：
   Grid 子项默认 min-width:auto（按内容最小宽度），内容过宽时不会收缩，加 min-width:0 允许收缩 */
.main-col {
  min-width: 0;
}

/* 侧栏随页面滚动固定：左栏技能很多、页面很长时，属性速览/克制关系始终可见 */
.side-col {
  position: sticky;
  top: calc(var(--header-h) + 16px); /* 让开吸顶顶栏的高度 + 一点间距 */
}

/* 窄屏（手机 / 小窗口）：两栏变单栏，侧栏排到主内容下面；单栏里 sticky 无意义，取消掉 */
@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  .side-col {
    position: static;
  }
}

/* ---------- 属性速览面板：每行"标签 : 值"的表格形式 ---------- */
.stat-list {
  list-style: none;   /* 去掉 ul 默认的圆点 */
  margin: 0;
  padding: 0;
}

.stat-list li {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);  /* 行与行之间的分隔线 */
}

/* 每行的"标签 : 值"一行（第二批拆出来的：进度条另起一行，不在这一行里） */
.stat-line {
  display: flex;
  justify-content: space-between;  /* 标签靠左、值靠右 */
  align-items: center;
}

/* 最后一行不要分隔线（不然面板底部会多一条线） */
.stat-list li:last-child {
  border-bottom: none;
}

.stat-label {
  font-size: 14px;
  color: var(--muted);  /* 灰色标签 */
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

/* 主属性值用属性色（和图鉴徽章同色系）；力量/敏捷/智力是"分类"不是"数值"，
   所以只上色、不画进度条。
   颜色继承自 .detail-body 上的 data-token（见 main.css），这里只管
   "这个值用属性色写"的形状 */
.attr-text { color: var(--attr); }

/* ---------- 数值进度条（第二批，2026-10-13 改成"滚到才长"） ----------
   难度 / 号位这类"数值型"项在数值下面加一条 4px 进度条：
   底色是暗轨道，金色内条按百分比填充。
   目标宽度由模板内联写在 <i> 的 --target 上，这里分成两半：
     常态 width: 0（还没长）→ .side-col.filled 时才 = var(--target)（长到位） */
.stat-bar {
  margin-top: 8px;
  height: 4px;
  border-radius: 2px;
  background: var(--card-3);
  overflow: hidden;   /* 裁掉内条的圆角溢出 */
}

.stat-bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--gold);
  /* 起点：0 宽。没这一句的话内条会先按"浏览器默认宽度"闪一下再缩回去 */
  width: 0;
  /* 用入场时长而不是原来的 0.3s：这是"长出来"的展示动画，
     和卡片浮上来是同一类动作，时长该一致 */
  transition: width var(--dur-reveal) var(--ease-out);
}

/* "该长了"：滚到侧栏（或它本来就在首屏）时由 script 加上 filled。
   切换英雄时 hero 变了也**不会**回到 0 重长一遍（观察器已经断开）——
   那种"每次进来都演一遍"的动画，看第二次就只剩烦躁 */
.side-col.filled .stat-bar i {
  width: var(--target);
}

/* 系统要求减弱动态效果：直接给终态，不要那条"长出来"的过程 */
@media (prefers-reduced-motion: reduce) {
  .stat-bar i {
    transition: none;
  }
}

.status {
  text-align: center;
  padding: 60px 0;
  color: var(--muted);
}

.status.error {
  color: var(--danger);
}

.status button {
  margin: 16px 8px 0;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.back-btn {
  align-self: flex-start; /* 按钮宽度自适应内容，不撑满整行 */
  display: inline-flex;   /* 图标和文字一行对齐 */
  align-items: center;
  gap: 6px;
}

/* 错误状态的大图标：红色，呼应错误提示 */
.error-icon {
  color: var(--danger);
  margin-bottom: 8px;
}

/* （"基于版本 / 更新日期"这一行的 .meta-line 样式已收进 main.css 的四页共用部分） */

/* 英雄横幅（第二批）：不再是裸排的头像+文字，而是卡片式横幅——
   左侧 3px 主属性色竖条（和图鉴卡片呼应）、左上角一层属性色淡光晕。
   颜色来自横幅上的 data-token 写进 --attr 变量，换英雄自动变色 */
.hero-header {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;   /* 极窄屏：头像和信息自动换行，防止溢出 */
  position: relative;
  overflow: hidden;
  padding: 20px 24px;
  border-left: 3px solid var(--attr);
  background:
    radial-gradient(560px 220px at 8% -40%, var(--attr-tint), transparent 62%),
    var(--card);
}

/* 横幅不跟随全局 .card 的悬停反馈（它是页面头部，不是可点击的卡片）：
   把 .card:hover 的上浮/金边/投影全部还原，左边属性色竖条保留 */
.hero-header:hover {
  transform: none;
  border-color: var(--border);
  border-left-color: var(--attr);
  box-shadow: none;
}

/* 头部信息区允许收缩（长定位标签换行），防止撑破窄屏 */
.header-info {
  min-width: 0;
}

/* 详情页大图头像（官网 CDN，96px 圆角方图）：
   第二批加了主属性色描边 + 外发光，嵌在横幅里更精神 */
.hero-avatar {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--attr);
  background: var(--bg);   /* 加载失败时的底色 */
  box-shadow: 0 0 24px var(--attr-glow);
  flex-shrink: 0;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hero-header h1 {
  font-size: 36px;
  /* 颜色由全局 .gradient-title 提供（白→金渐变），这里不写 color */
}

/* 基础徽章行：主属性 / 攻击方式 / 难度 / 号位 */
.header-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 主属性徽章：Dota 属性配色（力量红/敏捷绿/智力蓝/全才紫）。
   颜色不在这里 —— 徽章是横幅的后代，继承横幅 data-token 定下的 --attr。
   用户要求方角：原来是 999px 胶囊，现在 4px 小圆角（和图鉴页保持同一形状） */
.attr-badge {
  font-size: 13px;
  padding: 3px 12px;
  border-radius: 4px;
  border: 1px solid var(--attr);
  color: var(--attr);
  background: var(--attr-tint);
}

/* 攻击方式 / 难度 / 号位：灰色小徽章 */
.meta-badge {
  font-size: 13px;
  padding: 3px 12px;
  border-radius: 999px;
  color: var(--muted);
  border: 1px solid var(--muted);
  background: var(--muted-tint);
}

/* 官方定位标签行 */
.role-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 官方定位标签：统一中性灰描边（用户要求：红绿蓝紫只留给主属性标签） */
.role-tag {
  font-size: 13px;
  padding: 4px 14px;
  border-radius: 999px;
  color: var(--muted);
  border: 1px solid var(--muted);
  background: var(--muted-tint);
}

/* 信息面板的底色/边框/圆角/悬停由全局 .card 提供，
   内边距和标题/正文的字号则来自 main.css 的"四页共用"一节
   （2026-10-13 收拢：四页原来各写各的，字号差 2px、margin 差 4px，
   单看哪一页都没问题，来回翻就露馅）。
   这里只剩一条本页独有的： */
.panel p {
  /* 保留换行：tips / intro / counters 这几段数据本来就是多行文本，
     而浏览器默认会把换行折成空格，整段糊成一大坨。
     只在这一页需要 —— 其他三页的面板正文都是单行文本，pre-wrap 没有作用对象 */
  white-space: pre-wrap;
}

/* 打法建议面板：金色描边 + 浅金底色，放在头部正下方最显眼的位置
   （.card 悬停也会变金边，这里常态就是金边） */
.tips-panel {
  border-color: var(--gold);
  background: var(--gold-tint);
}

/* ---------- 技能网格 ---------- */
.skill-grid {
  display: grid;
  /* min(280px, 100%)：极窄屏时列宽收缩到 100%，防止横向溢出 */
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  gap: 12px;
}

/* 底色/边框/圆角由全局 .card.card-sm 提供（面板内嵌套小卡变体） */
.skill-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  position: relative;   /* 左侧色条 ::before 的定位参照 */
  overflow: hidden;     /* 色条贴着卡片圆角裁切 */
}

/* 大招 R / 魔晶 D / 神杖 F 技能卡：左侧 3px 色条，和普通技能卡一眼区分。
   用 ::before 画色条而不是 border-left：悬停时全局 .card 会把边框整体变金色，
   写在 border 上会被"吃掉"，::before 不受影响

   ⚠️ 类名由 skillBarClass() 给（见 <script setup>），不是模板里现拼字符串。
   四个类名对应三支：有专属色的 R/D/F、确认无色条的 Q/W/E（skill-plain）、
   以及没见过的按键（skill-unknown）。三支的判断都在上面那个函数里。 */
.skill-r::before,
.skill-d::before,
.skill-f::before,
.skill-unknown::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.skill-r::before { background: var(--gold); }
.skill-d::before { background: var(--all); }
.skill-f::before { background: var(--int); }

/* Q/W/E：**故意没有色条**（上面那段共用声明里也故意没有 .skill-plain）。
   这一句不是废笔 —— 它把"不加色条"写成一个能搜到的决定，
   而不是靠"CSS 里没写"来表达，否则下一个人看到这仨卡片会以为漏了。 */
.skill-plain::before { content: none; }

/* 没见过的按键：中性色。故意不显眼——它只是个"这里有东西我没见过"的信号，
   不该抢走 R/D/F 三种战术色条的注意力 */
.skill-unknown::before { background: var(--muted); }

/* 按键徽章 */
.skill-key {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-weight: bold;
  color: var(--text);
  background: var(--card-3);
  transition: transform 0.2s;
}

/* 悬停技能卡：按键徽章轻微放大，给一点"可看"的反馈 */
.skill-card:hover .skill-key {
  transform: scale(1.08);
}

/* 大招 R 用金色徽章突出 */
.skill-r .skill-key {
  background: var(--gold);
  color: var(--bg);
}

/* 魔晶技能 D 用紫色徽章，神杖技能 F 用蓝色徽章（和道具配色对应） */
.skill-d .skill-key {
  background: var(--all);
  color: var(--bg);
}

.skill-f .skill-key {
  background: var(--int);
  color: var(--bg);
}

/* 技能名 + 状态徽章排成一行 */
.skill-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.skill-info h3 {
  font-size: 15px;
  color: var(--text);
  margin-bottom: 0;
}

/* 状态徽章：小圆角标签，颜色区分含义 */
.badge {
  font-size: 11px;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid;
}

/* 被动（灰）：自动生效、无需按键 */
.badge-passive {
  color: var(--muted);
  border-color: var(--muted);
  background: var(--muted-tint);
}

/* 先天（青）：出生自带、随等级自动升级（官网先天技能） */
.badge-innate {
  color: var(--innate);
  border-color: var(--innate);
  background: var(--innate-tint);
}

/* 魔晶（紫）：1400 金币购买后强化/新增的技能 */
.badge-shard {
  color: var(--all);
  border-color: var(--all);
  background: var(--all-tint);
}

/* 神杖（金）：4200 金币购买后强化/新增的技能 */
.badge-scepter {
  color: var(--gold);
  border-color: var(--gold);
  background: var(--gold-tint-2);
}

.skill-info p {
  font-size: 13px;
  color: var(--muted);
}

/* ---------- 详情页骨架屏占位块 ---------- */
.sk-btn {
  width: 90px;
  height: 36px;
}

.sk-title {
  width: 50%;
  height: 40px;
}

.sk-panel {
  width: 100%;
  height: 120px;
}

.sk-panel.tall {
  height: 200px;
}
</style>
