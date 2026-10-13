// ============================================================
// 路由配置：管理"哪个 URL 显示哪个页面组件"
// 本项目有四个页面：/ 首页（新手须知）、/heroes 英雄图鉴、/heroes/:key 详情页、/advanced 进阶页
// ⚠️ 默认首页是新手须知（用户要求），英雄图鉴在 /heroes
// ============================================================
import { createRouter, createWebHistory } from 'vue-router'
// 内容异步加载的页面需要"补恢复"滚动位置，见 scrollBehavior 里的说明
import { setPendingScroll } from '../composables/scrollRestore'
import HomeView from '../views/HomeView.vue'
import HeroDetailView from '../views/HeroDetailView.vue'
import GuideView from '../views/GuideView.vue'
import AdvancedView from '../views/AdvancedView.vue'

// 路由表：一个对象 = 一条路由规则
const routes = [
  {
    path: '/',            // 首页 = 新手须知（用户要求：默认首页为新手须知）
    name: 'guide',
    component: GuideView
  },
  {
    path: '/heroes',      // 英雄图鉴（原首页，改到这里）
    name: 'heroes',
    component: HomeView
  },
  {
    // :key 是动态参数，两种写法都匹配：
    //   /heroes/sven            slug（站内链接用这个，如首页卡片、新手须知表格）
    //   /heroes/3               数字 id（第七阶段之前的老书签，仍然能用）
    // 参数名从 :id 改成 :key，因为它装的不一定是 id
    path: '/heroes/:key',
    name: 'hero-detail',
    component: HeroDetailView,
    // 把 URL 里的参数作为 props 传给组件，组件里就不用再写 useRoute() 了。
    //
    // ⚠️ 这里不能图省事写 props: true。
    // 路由参数叫 :key，props: true 会照着参数名生成 prop，也就是给组件传一个
    // 名叫 key 的 prop —— 而 key 在 Vue 里是**保留属性名**（和 ref 一样，
    // 属于 vnode 自身用来做 diff 的字段，不是普通 prop）。
    // 后果是静默的：组件里 props.key 永远是 undefined，
    // 页面会去请求 /api/heroes/undefined，报"英雄不存在"。
    // 命令行里能看到的唯一线索是一句警告："Invalid prop name: "key" is a reserved property"。
    //
    // 所以用一个 props 函数把参数重新命名成 heroKey 再传进去。
    props: (route) => ({ heroKey: route.params.key })
  },
  {
    path: '/advanced',    // 进阶页：久远Vortex 四篇教学 PDF 的总结，纯静态
    name: 'advanced',
    component: AdvancedView
  }
]

const router = createRouter({
  // HTML5 History 模式：URL 干净无 # 号（如 /heroes/3）
  // 另一种 hash 模式 URL 是 /#/heroes/3，不需要服务器配置，但不好看
  history: createWebHistory(),
  routes,

  // 切换路由时滚动到哪 —— 三个分支，缺一个都会出问题
  scrollBehavior(to, from, savedPosition) {
    // ① 浏览器前进/后退：恢复离开时的位置。
    //    savedPosition 只在"有历史记录可回"时才有值，也就是走了 router.back()
    //    或浏览器后退按钮的那条路。
    //    ⚠️ 详情页的"返回列表"必须用 router.back() 才吃得到这一条：
    //    写 router.push('/heroes') 是**新开**一条历史，savedPosition 是 null，
    //    结果就是每次返回都回到列表顶部 —— 而用户刚刚是在第 80 张卡那里点进去的
    if (savedPosition) {
      // 顺手记一笔，让内容异步加载的页面（图鉴页）在数据到位后自己补一次。
      // ⚠️ 光靠这里返回 savedPosition 是不够的：这个函数返回的那一刻，
      //    图鉴页上还只有骨架屏、整页不够高，浏览器会把滚动位置**钳到页面底部**
      //   （实测想去 3000px，实际停在 606px），等数据回来也没人再纠正。
      //    详见 composables/scrollRestore.js 的说明。
      setPendingScroll(savedPosition.top)
      return savedPosition
    }

    // ② 同一个页面内换参数：不动。
    //    ⚠️ 这条是给进阶页的页签用的：它靠 router.replace({query:{part:N}}) 把页签
    //    写进 URL。如果这里返回 {top:0}，每点一次页签页面就"跳回顶部"，
    //    而页签切换本来应该是原地左右滑动 —— 那是最容易被当成"滑动坏了"的回归。
    if (to.name === from.name) return false

    // ③ 其余的页面跳转：从新页面顶部开始看。
    //    换页后停在上一页的滚动深度是没道理的（两个页面的内容毫无关系）。
    //    这里必须把①记下的那笔**清掉**：否则"用户点导航栏去图鉴页"这种
    //    正常的前进跳转，也会被一个过期的位置拽到半空中去
    setPendingScroll(0)
    return { top: 0 }
  }
})

export default router
