<!--
  新手须知页 = 站点首页（路由 /）
  内容：1~5 号位体系 + Dota 与 LOL/王者 的关键差异 + 两个"为什么"
  交互：三个部分分成页签，点页签时内容【垂直滑动】切换（进阶页滑动页签的上下版）
  本阶段（2026-10-06）改动：
    - 表格末列"本项目示例"→"代表英雄"，英雄名可点击跳详情页（链接用 slug，见下）
    - 正文 16px / 行高 1.7；每段最多保留一处橙色加粗
    - emoji 图标统一换 lucide SVG 图标
    - 代表英雄链接改用 slug（官网英文内部名，hero 表唯一标识列）：
      斯温 sven / 影魔 nevermore / 斧王 axe / 帕吉 pudge / 水晶室女 crystal_maiden
    - "见本页最后一部分"是切页签链接（直接 switchPart，跳到第三部分）
    - 窄屏（≤640px）滑动页签改为整页滚动（面板平铺，无嵌套滚动）
    - 更新日期抽全局常量 src/constants.js 的 UPDATE_DATE
    - 页内目录已删除（用户要求：和页签功能重复，没啥用）
    - 底部"下一步"引导卡片已删除（用户要求：没啥用）
  第二批视觉美化（2026-10-06）：
    - 顶部 banner 改成卡片式 hero 区（金/红径向光晕 + 圆角边框）
    - 号位表：数据抽成 POS_ROWS 数组 v-for 渲染；偶数行斑马纹；号位数字金色圆形徽章；
      资源量 ★ 文本换成 5 格能量条
    - 差异对比卡：图标独立成金色圆徽章，卡片变三行结构
    - 新增三类提示块：金=建议 / 红=警示 / 蓝=一句话总结
-->
<script setup>
import { ref, computed, nextTick } from 'vue'
// lucide 图标：全站 emoji 统一换成 SVG 图标库（矢量图，任何分辨率都清晰）
// 第二批新增三个：提示块用（Lightbulb 建议 / TriangleAlert 警示 / KeyRound 结论）
import { Table, Shuffle, HelpCircle, Map, Ban, Swords, Coins, Users, ScrollText, Trees, Lightbulb, TriangleAlert, KeyRound } from 'lucide-vue-next'
// 全站共享常量：更新日期四页统一取这里
import { UPDATE_DATE } from '../constants'

// 当前页签：'positions' = 号位体系，'differences' = 关键差异，'whys' = 两个为什么
// 垂直滑动靠 .tab-track 的 transform: translateY 位移（见样式区注释）
const activePart = ref('positions')

// 轨道位移量：N 个面板纵向叠放，第 n 个面板进视野需要位移 -(n × 100/N)%。
// ⚠️ translateY 的百分比相对"轨道自身高度"计算（不是容器高度），
//    所以每个面板的位移量 = 100 ÷ 面板数（3 个面板 ≈ 33.333%）
const PART_ORDER = ['positions', 'differences', 'whys']
const trackShift = computed(() => -(PART_ORDER.indexOf(activePart.value) * (100 / PART_ORDER.length)))

// 是否窄屏（≤640px）：窄屏下面板取消滑动、整页纵向平铺（见样式区媒体查询），
// 切页签/目录跳转的行为也要跟着变——滚整页而不是面板内部
const isNarrow = () => window.matchMedia('(max-width: 640px)').matches

// 滚到某个面板顶部（窄屏整页滚动用；宽屏面板靠 translateY 位移，不需要滚）
function scrollToPanel(name) {
  document.getElementById('panel-' + name)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 切换页签：只改 activePart，滑动动画由 CSS 的 transition 自动完成。
// 窄屏例外：面板平铺排列，切页签 = 滚动整页到对应面板
function switchPart(name) {
  activePart.value = name
  if (isNarrow()) {
    nextTick(() => scrollToPanel(name))
  }
}

// （页内目录已按用户要求删除：三个部分本来就有页签切换，目录与之重复、没啥用）

// ---------- 号位表数据（第二批：表格改成 v-for 渲染） ----------
// 之前 5 行是手写的 HTML，现在抽成数据数组：①"5 格能量条"需要按每行的资源量点数，
// 手写要重复 25 个格子标签；②以后改表只需动这个数组。
// res  ：资源量 1~5，决定能量条点亮几格（对应原来的 ★ 数量）
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
  <div class="guide">
    <div class="banner">
      <h1 class="gradient-title">新手须知</h1>
      <p>写给从《英雄联盟》《王者荣耀》转过来的你 —— 五分钟搞懂 Dota 2 最核心的概念</p>
      <p class="meta-line">内容更新：{{ UPDATE_DATE }} · 通用概念，不随版本失效</p>
    </div>

    <!-- 页签切换：三个部分上下滑动切换 -->
    <div class="part-tabs">
      <!-- :class 动态绑定：当前激活的页签加 active 类（金色高亮） -->
      <button
        class="tab-btn"
        :class="{ active: activePart === 'positions' }"
        @click="switchPart('positions')"
      ><Table :size="15" />号位体系</button>
      <button
        class="tab-btn"
        :class="{ active: activePart === 'differences' }"
        @click="switchPart('differences')"
      ><Shuffle :size="15" />关键差异</button>
      <button
        class="tab-btn"
        :class="{ active: activePart === 'whys' }"
        @click="switchPart('whys')"
      ><HelpCircle :size="15" />两个为什么</button>
    </div>

    <!-- 滑动容器：overflow hidden 把"滑出去"的面板裁掉（滑动效果的关键）。
         垂直滑动比水平多一个前提：容器必须有确定的高度，translateY 的百分比才有参照物 -->
    <div class="tab-slider">
      <!-- 轨道：三个面板纵向叠放，靠 translateY 位移实现滑动。
           ⚠️ translateY 的百分比是相对"轨道自身高度"（= 容器 3 倍）计算的，
           所以每切换一个面板只需位移 -33.333%（一个面板高）；
           写错百分比会滑过头造成整屏空白。
           位移量由 script 里的 trackShift 计算属性统一算好，模板不用手写三元嵌套 -->
      <div
        class="tab-track"
        :style="{ transform: 'translateY(' + trackShift + '%)' }"
      >
        <!-- ==================== 第一部分：1~5 号位 ==================== -->
        <!-- id 供窄屏整页滚动定位（scrollToPanel 里 getElementById 找的就是它） -->
        <section id="panel-positions" class="panel tab-page card">
          <h2><Table :size="18" class="h-icon" />什么是 1~5 号位？</h2>
          <p class="lead">
            号位是 Dota 独有的概念，本质是<strong>全队吃资源的优先级排序</strong>：
            1 号位吃最多资源（全队倾家荡产养他），5 号位吃最少资源（工资几乎全用来买眼）。
            LOL/王者 没有这个体系——为什么，
            <a class="text-link" href="#" @click.prevent="switchPart('whys')">见本页最后一部分</a>。
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
                <!-- 每行由 POS_ROWS 数据渲染（第二批：原来是手写 5 行 HTML）。
                     代表英雄可点击跳详情：链接用 slug（官网英文内部名，hero 表的唯一标识列，
                     来自官网头像文件名），比数字 id 稳定可读——后端按 slug 查询 -->
                <tr v-for="row in POS_ROWS" :key="row.pos">
                  <!-- 号位数字：金色圆形徽章（第二批，原来是普通文字） -->
                  <td class="pos-cell"><span class="pos-badge">{{ row.pos }}</span></td>
                  <td>{{ row.alias }}</td>
                  <td>{{ row.duty }}</td>
                  <!-- 资源量：5 格能量条（第二批，替代原来的 ★ 文本），点亮 row.res 格 -->
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

          <!-- id 是普通锚点：留着方便以后引用（如正文里的跳转链接） -->
          <h3 id="pos-laning"><Map :size="16" class="h-icon" />分路怎么站？</h3>
          <p>
            Dota 的地图是<strong>对角线镜像</strong>的：你的"优势路"对面就是敌方的"劣势路"。
            新手默认阵容叫 "2-1-2"：优势路两人（1 号位 + 5 号位保他）、
            中路一人（2 号位）、劣势路两人（3 号位 + 4 号位）。
            进游戏选完人后看队友往哪走、跟着补位即可。
          </p>

          <!-- 提示块之二：警示型（红）——把"最容易踩的坑"从正文里提出来单独强调，
               正文只讲道理，行动警告放这里，两者不重复 -->
          <div class="notice notice-warn">
            <TriangleAlert :size="18" class="notice-icon" />
            <div>
              <strong class="notice-title">新手最容易犯的错</strong>
              <p>别去抢 1 号位的补刀。想帮忙就去买眼、拉野、游走——补刀留给全队吃资源最多的那个人。</p>
            </div>
          </div>
        </section>

        <!-- ==================== 第二部分：关键差异 ==================== -->
        <section id="panel-differences" class="panel tab-page card">
          <h2><Shuffle :size="18" class="h-icon" />和 LOL / 王者的关键差异</h2>
          <div class="diff-grid">
            <!-- 对比卡（第二批改造）：图标从标题里拿出来，放进金色圆形徽章；
                 标题独立成行，正文在下——三行结构比原来"图标+标题挤一行"更好扫读 -->
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

          <!-- 提示块之一：建议型（金）——给"下一步做什么"的指路，链到图鉴 -->
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

        <!-- ==================== 第三部分：两个"为什么" ==================== -->
        <section id="panel-whys" class="panel tab-page card">
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

          <!-- 提示块之三：结论型（蓝）——把这一节的答案压缩成一句话，方便记忆 -->
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

          <!-- 结论型提示块：原来这句总结跟在正文段落末尾，提出来单独成块更好记 -->
          <div class="notice notice-key">
            <KeyRound :size="18" class="notice-icon" />
            <div>
              <strong class="notice-title">一句话总结</strong>
              <p>LOL 按"位置"分工，Dota 按"优先级"分资源。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guide {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 顶部 hero 区（第二批改造：原来是纯文字，现在是带光晕的卡片式横幅）：
   两层径向渐变叠在卡片底色上——顶部中央一层金、左上一角一层红，
   和全站"深色底 + 红金点缀"的主题呼应，把标题区和下方内容拉开层次 */
.banner {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 32px 24px 28px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background:
    radial-gradient(600px 200px at 50% -60px, var(--gold-tint), transparent 70%),
    radial-gradient(520px 200px at 15% -60px, var(--red-tint), transparent 70%),
    var(--card);
  margin-bottom: 8px;
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

/* 正文里的锚点链接（如 lead 里的"见本页最后一部分"） */
.text-link {
  color: var(--link);
  text-decoration: none;
}

.text-link:hover {
  text-decoration: underline;
}

/* ---------- 页签切换 + 上下滑动 ---------- */
.part-tabs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;   /* 窄屏自动换行，防止挤破页面 */
}

/* 页签按钮：默认灰色，激活时金色高亮（和进阶页同一套样式） */
.tab-btn {
  flex: 1;               /* 各页签均分一行 */
  padding: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  display: inline-flex;      /* 图标和文字一行对齐 */
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--gold);
  border-color: var(--gold);
  background: var(--gold-tint);
}

/* 滑动容器：把滑出视野的面板裁掉。
   ⚠️ 垂直滑动的关键前提：容器必须有【确定的高度】——
   水平滑动时面板宽度定死、高度自然生长就行；
   垂直滑动反过来，translateY 的百分比需要参照轨道高度，
   而轨道高度 = 容器高度 × N，容器不定高的话百分比会塌陷。
   这里取 75vh（视口高度的 75%），页面本身基本不需要滚动 */
.tab-slider {
  overflow: hidden;
  height: 75vh;
}

/* 轨道：三个面板纵向叠放，轨道总高 = 容器的 3 倍；
   transition 让 translateY 变化时产生平滑的上下滑动动画 */
.tab-track {
  display: flex;
  flex-direction: column;  /* 纵向叠放（水平版这里是默认的 row） */
  height: 300%;
  transition: transform 0.3s ease;
}

/* 每个面板占轨道的 1/3（= 滑动容器的 100% 高）
   ⚠️ 面板数变了这两处高度要同步改：轨道 = N×100%，面板 = 100/N%
   面板内部允许上下滚动：内容比窗口高时不会被裁掉（overflow-y: auto） */
.tab-page {
  height: 33.333%;
  flex-shrink: 0;     /* 不许被 flex 压缩，保证面板高度固定 */
  overflow-y: auto;   /* 面板内容超出时在面板内部滚动 */
}

/* 面板内部滚动条已删除：全局深色细滚动条在 main.css 里统一处理 */

/* ---------- 面板与内容样式 ---------- */
/* 底色/边框/圆角/悬停由全局 .card 统一提供（2026-10-06 美化），这里只留布局 */
.panel {
  padding: 24px;
}

/* 标题图标与文字用 flex 排布、gap 8px（用户要求，替代 vertical-align 基线对齐） */
.h-icon {
  color: var(--gold);
  flex-shrink: 0;   /* 图标不被压缩变形 */
}

.panel h2,
.panel h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel h2 {
  font-size: 20px;
  color: var(--text);
  margin-bottom: 16px;
}

.panel h3 {
  font-size: 17px;
  color: var(--gold);
  margin: 20px 0 8px;
  /* 锚点定位补偿：scrollIntoView 滚到 h3 时，留出上方一点呼吸空间 */
  scroll-margin-top: 12px;
}

/* 正文：16px + 行高 1.7（用户要求 15-16px/1.7，阅读舒适优先取上限） */
.panel p {
  font-size: 16px;
  line-height: 1.7;
  color: var(--text);
}

/* 橙色加粗：每段最多保留一处（用户要求），只标段落主旨 */
.panel strong {
  color: var(--gold);
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

/* 斑马纹（第二批）：偶数行铺一层极淡的白色，长表格横向扫读时不串行。
   --zebra 是 2.5% 透明度的白（main.css 定义），比整行换底色更柔和 */
.pos-table tbody tr:nth-child(even) td {
  background: var(--zebra);
}

/* 号位列：圆形徽章居中。
   ⚠️ 这里必须写全 ".pos-table td.pos-cell" 而不是只写 ".pos-cell"：
   上面 ".pos-table td" 是 text-align: left，只写 .pos-cell 权重比它低、居中不生效 */
.pos-table td.pos-cell {
  text-align: center;
}

/* 号位数字：金色圆形徽章（第二批，原来是普通金色文字） */
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

/* ---------- 资源量：5 格能量条（第二批，替代原来的 ★ 文本） ----------
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

/* 代表英雄链接：链接蓝 + hover 下划线（用户要求：链接色不跟强调橙混用） */
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

/* 对比卡图标：金色圆形徽章（第二批：图标原来跟标题挤在一行，
   现在独立成圆徽章，卡片结构变成"徽章 → 标题 → 正文"三行） */
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

/* ---------- 三类提示块（第二批新增） ----------
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

/* ---------- 窄屏（≤640px）：滑动切换改为整页滚动 ----------
   垂直滑动需要容器定高，窄屏上 75vh 的面板里再套一个滚动条
   （嵌套滚动）体验很差——滚动条套滚动条，滑到面板底部还得停一下。
   所以窄屏直接取消滑动：三个面板纵向平铺，切页签/目录跳转改为
   滚动整个页面到对应面板（script 里 switchPart/goToc 已配套处理） */
@media (max-width: 640px) {
  .tab-slider {
    height: auto;        /* 容器高度交给内容决定 */
    overflow: visible;   /* 不再裁切 */
  }

  .tab-track {
    height: auto;
    gap: 24px;                          /* 平铺后面板之间留间距 */
    transform: none !important;         /* 取消位移（!important 覆盖模板内联 style） */
  }

  .tab-page {
    height: auto;
    overflow-y: visible;                /* 面板不再内部滚动，滚动交给整页 */
    scroll-margin-top: 12px;            /* 滚到面板时留一点呼吸空间 */
  }
}
</style>
