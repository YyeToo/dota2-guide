package com.dota.guide.controller;

import com.dota.guide.common.PageResult;
import com.dota.guide.common.Result;
import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailVO;
import com.dota.guide.query.HeroQuery;
import com.dota.guide.service.HeroService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HeroController —— 控制层（对外接口层）
 *
 * 职责：接收前端的 HTTP 请求，调用 Service 完成业务，把结果包装成 JSON 返回。
 * 一个 REST 接口的完整链路：
 *   前端 Axios → Controller → Service → Mapper → MySQL → 原路返回 JSON
 *
 * 常用注解速记：
 *   @RestController  : 类上标注，表示所有方法的返回值直接序列化成 JSON 写回响应体
 *   @RequestMapping   : 给本类所有接口统一加路径前缀
 *   @GetMapping       : 处理 GET 请求（查询）
 *   @PathVariable     : 取出 URL 路径中的参数，如 /api/heroes/3 中的 3
 *   @ModelAttribute   : 把 URL 问号后面的参数按名字装进一个对象（见接口一）
 *
 * ============================================================
 * 本类现在只有 2 个接口（原来 3 个）
 * ============================================================
 * 原来详情有两条路：
 *   GET /api/heroes/{id}        按数字 id 查
 *   GET /api/heroes/slug/{slug}  按 slug 查
 * 两边的 Service 方法、Mapper 方法、SQL 全都是成对的，差别只有 WHERE 条件一个用 id 一个用 slug。
 *
 * 现在合成一条：GET /api/heroes/{key}，key 是数字就当 id、不是数字就当 slug。
 * 判断只在这一处做，前端不用再"看参数是不是纯数字来决定请求哪个地址"。
 * 老链接 /api/heroes/3 照常能用（3 是数字，走 id 分支）。
 */
@RestController
@RequestMapping("/api/heroes") // 本类所有接口都以 /api/heroes 开头
public class HeroController {

    private final HeroService heroService;

    // 构造器注入，原理同 HeroService
    public HeroController(HeroService heroService) {
        this.heroService = heroService;
    }

    /**
     * 接口一：英雄列表（分页 + 筛选）
     * GET http://localhost:8080/api/heroes
     * GET http://localhost:8080/api/heroes?page=2&size=24&keyword=斧&role=核心&pos=3号位&attr=力量&complexity=1
     *
     * @ModelAttribute 做了什么：Spring 会把问号后面的参数按**名字**塞进 HeroQuery 的同名字段 ——
     *   ?keyword=斧       → query.setKeyword("斧")
     *   ?complexity=1     → query.setComplexity(1)
     *   ?page=2&size=24   → query.setPage(2)、query.setSize(24)
     * 没传的参数不去动它，字段的初始值（page=1、size=24）就生效，等于原来的 defaultValue。
     *
     * 换来的好处有两点：
     *   1. 方法签名从 7 个参数变成 1 个，再加筛选条件不用改这里；
     *   2. 参数校验（page/size 兜底）跟着 HeroQuery 走，
     *      不会出现"Controller 校验了、别处调用 Service 时又忘了校验"。
     *
     * 返回结构：data 里是 { total: 总条数, list: [当前页英雄...] }
     * 前端用 total 算总页数，实现分页条。
     */
    @GetMapping
    public Result<PageResult<Hero>> list(@ModelAttribute HeroQuery query) {
        return Result.success(heroService.getHeroPage(query));
    }

    /**
     * 接口二：英雄详情（含技能列表）
     * GET http://localhost:8080/api/heroes/3              按数字 id（老书签、首页卡片）
     * GET http://localhost:8080/api/heroes/sven           按 slug（站内教学链接用它）
     * GET http://localhost:8080/api/heroes/crystal_maiden
     *
     * 两种写法返回结构完全相同，前端用哪种都行。
     *
     * @param key URL 路径上的英雄标识，@PathVariable 自动取出来（类型声明成 String，
     *            因为 slug 是字符串；是数字时由 Service 转成 id 去查）
     */
    @GetMapping("/{key}")
    public Result<HeroDetailVO> detail(@PathVariable String key) {
        HeroDetailVO vo = heroService.getHeroDetail(key);
        // 查不到时返回 404 错误信息，前端会提示"英雄不存在"
        if (vo == null) {
            return Result.error(404, "英雄不存在（" + key + "）");
        }
        return Result.success(vo);
    }
}
