// ============================================================
// API 封装层：集中管理所有与后端交互的代码
// 好处：页面组件只管调用 getHeroList()，不关心 URL 和错误处理细节；
//       以后后端地址变了，只改这一个文件。
// ============================================================
import axios from 'axios'

// 创建 axios 实例（相当于"配置好默认参数的请求工具"）
const request = axios.create({
  // 后端地址：所有请求都会自动拼上这个前缀
  // 例如 request.get('/heroes') 实际请求 http://localhost:8080/api/heroes
  baseURL: 'http://localhost:8080/api',
  // 超过 5 秒没响应就报错，避免页面一直转圈
  timeout: 5000
})

// 响应拦截器：后端返回的 JSON 都会先经过这里
// 后端统一返回 { code, message, data } 格式（见后端 common/Result.java）
request.interceptors.response.use(
  (response) => {
    const { code, message, data } = response.data
    if (code === 200) {
      // 成功：直接把 data 交给页面，
      // 列表接口拿到的是 { total, list }，详情接口拿到的是英雄对象
      return data
    }
    // 业务失败（如 404 英雄不存在）：抛出错误，页面的 catch 里会收到
    return Promise.reject(new Error(message || '请求失败'))
  },
  (error) => {
    // 网络层错误：后端没启动、请求超时、跨域被拦截等都会走到这里
    return Promise.reject(new Error(error.message || '网络错误'))
  }
)

/**
 * 获取英雄列表（分页 + 筛选）
 * GET /api/heroes?page=1&size=24&keyword=斧&role=核心&pos=3号位&attr=力量&complexity=1
 *
 * 可选筛选参数：
 *   keyword    关键词（模糊匹配英雄名/简介）
 *   role       官方定位（核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手，模糊匹配）
 *   pos        号位（1号位~5号位，模糊匹配）
 *   attr       主属性（力量/敏捷/智力/全才，精确匹配）
 *   complexity 复杂度（1简单/2中等/3困难，精确匹配）
 *
 * @param params 查询参数对象，axios 会把它拼成 URL 的 ? 部分；
 *               没传的字段 axios 自动忽略（后端按"未筛选"处理）
 * @returns 后端 data：{ total: 总条数, list: [英雄...] }
 */
export function getHeroList(params = {}) {
  return request.get('/heroes', { params })
}

/**
 * 获取英雄详情（含技能列表）
 * 参数是数字 id → GET /api/heroes/{id}（如 /heroes/18）
 * 参数是 slug（英文内部名）→ GET /api/heroes/slug/{slug}（如 /heroes/sven）
 * 新手须知等教学页的链接用的是 slug（hero 表唯一标识列），
 * 数字 id 是数据库内部实现，slug 稳定可读，数据重灌也不会变
 */
export function getHeroDetail(idOrSlug) {
  if (/^\d+$/.test(String(idOrSlug))) {
    return request.get(`/heroes/${idOrSlug}`)
  }
  return request.get(`/heroes/slug/${idOrSlug}`)
}
