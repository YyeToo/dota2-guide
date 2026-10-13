// ============================================================
// composables/useHeroQuery.js —— 英雄列表的查询状态
// ============================================================
//
// 这个 module 存在的理由只有一个：**把"页码"关起来**。
//
// 改之前，page 是 HomeView 里的一个 ref，7 个调用点各自负责在查询前把它
// 处理好 —— 4 处手写 `page.value = 1`，1 处 `page.value += 1`，还有 2 处
// 什么都没写。这种"每个调用方都得记住的约定"不是 interface，是口口相传的规矩：
// 漏一处就出现「筛选变了却追加第 N 页」，列表静默重复或缺行，接口照样返回 200。
//
// 已经真的踩到过一次（HomeView.vue 的「重试」按钮）：
//     <button @click="loadHeroes">重试</button>
// Vue 对裸方法引用会把 $event 当第一个实参传进去，而 loadHeroes(append = false)
// 判的是真假 —— MouseEvent 是 truthy，于是"重试"实际走的是**追加**模式：
// 不显示骨架屏，还把结果拼到旧列表尾部。首次加载失败时列表是空的，追加等于正常加载，
// 所以谁都没发现；只有"已经有数据了、然后某次筛选请求失败"才现形。
//
// 现在 page 只被下面三个方法写，调用方拿不到能破坏不变量的句柄：
//
//     search()            回第 1 页重新查（首次加载 / 筛选变化 / 重试都走它）
//     loadMore()          追加下一页
//     setFilter(name, v)  改一个筛选条件 —— 内部就是"改完再 search()"
//     reset()             清空全部筛选条件 —— 内部也是 search()
//
// ⚠️ 关于 api 依赖：这里直接 import getHeroList，没有做成参数注入。
// 判据是 codebase-design 的那条：**一个 adapter 是假缝，两个才是真缝**。
// 全站只有这一个真实实现，没有任何东西会跨这道缝变化；注入进来只是为想象中的
// 测试留个口子。将来真写测试了，import 换成参数是一行的事。

import { computed, reactive, ref } from 'vue'
import { getHeroList } from '../api/hero'

/** 每页条数。上限见后端 HeroQuery.MAX_SIZE（500），这里远低于它 */
const SIZE = 24

export function useHeroQuery() {
  // ---------- 查询结果 ----------
  const list = ref([]) // 已加载的英雄（"加载更多"时向后累积）
  const total = ref(0) // 符合条件的总数（后端返回，用来判断还有没有更多）
  const loading = ref(false) // 首次/筛选加载中：true 时显示骨架屏
  const loadingMore = ref(false) // "加载更多"进行中：true 时按钮显示"加载中…"
  const error = ref('') // 错误信息：非空时页面显示错误提示

  // ---------- 筛选条件 ----------
  // 用一个对象装 5 个条件，是为了让下面两个派生值和 reset() 都能一行写完；
  // 分成 5 个独立 ref 的话，每加一个筛选项就要在这三处各补一行。
  // 名字必须和后端的查询参数名一致（见 api/hero.js），拼参数时直接用键名。
  const filters = reactive({
    keyword: '',
    role: '',
    pos: '',
    attr: '',
    complexity: ''
  })

  // ---------- 页码：**不对外暴露** ----------
  // 唯一的写入点在 search() / loadMore() 里。这就是整个 module 的全部价值。
  const page = ref(1)

  /** 还有没有更多：已加载数量 < 总数 */
  const hasMore = computed(() => list.value.length < total.value)

  /** 有没有任何筛选生效（决定"清空"按钮是否显示） */
  const hasFilter = computed(() => Object.values(filters).some(Boolean))

  /**
   * 真正发请求的那一层。append=false 时替换列表（回第 1 页），
   * true 时把结果拼到列表尾部（加载更多）。
   *
   * 这里**不读也不写 page**，页码由调用方先设好 —— 只发一个请求，
   * 顺带把"页码该是多少"和"列表该怎么合"这两件事分开。
   */
  async function fetchPage(append) {
    // 两种加载用两个独立标记：整页骨架屏 vs 按钮上的"加载中…"
    //（追加时不能把整个列表换成骨架屏，否则页面会闪一下）
    if (append) loadingMore.value = true
    else loading.value = true
    error.value = ''

    try {
      // 只把非空的筛选条件传给后端。
      // 后端 attr/complexity 是精确匹配（=），role/pos/keyword 是模糊匹配（LIKE），
      // 这一点是后端的事，前端只管"空的就不传"。
      const params = { page: page.value, size: SIZE }
      for (const [name, value] of Object.entries(filters)) {
        if (typeof value === 'string' && value.trim()) params[name] = value.trim()
      }

      // 返回 { total, list }（axios 拦截器已经把 data 解出来了）
      const data = await getHeroList(params)
      list.value = append ? [...list.value, ...data.list] : data.list
      total.value = data.total
    } catch (e) {
      // 失败：把原因展示到页面上（如"后端没启动""网络错误"）
      error.value = e.message || '加载失败，请确认后端服务已启动'
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  /**
   * 回第 1 页重新查。首次加载、筛选变化、以及失败后点「重试」都走它。
   * 三个场景机制相同（都是"按现在这批筛选条件，从头拿第一屏"），
   * 所以只有一个方法，不另外造一个 retry() 直通。
   */
  function search() {
    page.value = 1
    return fetchPage(false)
  }

  /** "加载更多"：页码 +1，把下一页追加到列表尾部 */
  function loadMore() {
    page.value += 1
    return fetchPage(true)
  }

  /**
   * 改一个筛选条件，然后重新查。
   *
   * 名字写错时只警告不抛错：这是调用方的笔误，不该让整个页面白屏。
   * 但不能静默 —— 静默正是这个文件要消灭的东西。
   */
  function setFilter(name, value) {
    if (!(name in filters)) {
      console.warn(`[useHeroQuery] 没有这个筛选条件：${name}`)
      return Promise.resolve()
    }
    filters[name] = value
    return search()
  }

  /** 清空全部筛选条件并重新查（"清空"按钮） */
  function reset() {
    for (const name of Object.keys(filters)) filters[name] = ''
    return search()
  }

  return {
    // 结果
    list,
    total,
    loading,
    loadingMore,
    error,
    // 派生值
    hasMore,
    hasFilter,
    // 筛选条件（模板里 v-model 直接绑）
    filters,
    // 能改状态的方法 —— 就这四个
    search,
    loadMore,
    setFilter,
    reset
  }
}
