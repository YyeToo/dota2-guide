package com.dota.guide.controller;

import com.dota.guide.common.PageResult;
import com.dota.guide.common.Result;
import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailVO;
import com.dota.guide.service.HeroService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HeroController —— 控制层（对外接口层）
 *
 * 职责：接收前端的 HTTP 请求，调用 Service 完成业务，把结果包装成 JSON 返回。
 * 一个 REST 接口的完整链路：
 *   前端 Axios → Controller → Service → Mapper → MySQL → 原路返回 JSON
 *
 * 常用注解速记：
 *   @RestController : 类上标注，表示所有方法的返回值直接序列化成 JSON 写回响应体
 *   @RequestMapping  : 给本类所有接口统一加路径前缀
 *   @GetMapping      : 处理 GET 请求（查询）
 *   @PathVariable    : 取出 URL 路径中的参数，如 /api/heroes/3 中的 3
 *   @RequestParam    : 取出 URL 问号后面的参数，如 /api/heroes?page=2 中的 page
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
     * @RequestParam 的两个常用属性：
     *   required = false   —— 参数可以省略（不传就是 null，筛选条件就不生效）
     *   defaultValue = "1" —— 参数省略时使用默认值
     *
     * 筛选参数说明（第四阶段新增 attr/complexity）：
     *   attr        主属性筛选（力量/敏捷/智力），官网同款分组
     *   complexity  复杂度筛选（1 简单/2 中等/3 困难），官网"新手可玩"即 complexity=1
     *
     * 返回结构：data 里是 { total: 总条数, list: [当前页英雄...] }
     * 前端用 total 算总页数，实现分页条。
     */
    @GetMapping
    public Result<PageResult<Hero>> list(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "pos", required = false) String pos,
            @RequestParam(value = "attr", required = false) String attr,
            @RequestParam(value = "complexity", required = false) Integer complexity,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "24") int size) {
        return Result.success(heroService.getHeroPage(keyword, role, pos, attr, complexity, page, size));
    }

    /**
     * 接口二：英雄详情（含技能列表）
     * GET http://localhost:8080/api/heroes/{id}   例如 /api/heroes/1
     *
     * @param id URL 路径上的英雄 id，@PathVariable 会自动取出来并转换成 Long 类型
     */
    @GetMapping("/{id}")
    public Result<HeroDetailVO> detail(@PathVariable Long id) {
        HeroDetailVO vo = heroService.getHeroDetail(id);
        // 查不到时返回 404 错误信息，前端会提示"英雄不存在"
        if (vo == null) {
            return Result.error(404, "英雄不存在（id=" + id + "）");
        }
        return Result.success(vo);
    }

    /**
     * 接口三：英雄详情（按 slug 查询，第六阶段新增）
     * GET http://localhost:8080/api/heroes/slug/sven   例如 /api/heroes/slug/crystal_maiden
     *
     * slug 是什么：hero 表的唯一标识列，英雄英文内部名（来自官网头像文件名）。
     * 教学页的"代表英雄"链接用它（/heroes/sven），数字 id 是数据库内部实现，
     * 写死在页面里数据一重灌就对不上；slug 永久稳定、还可读。
     *
     * 路径冲突说明：/slug/{slug} 是两段路径，/{id} 是一段路径，
     * 两个接口不会互相抢（Spring 按路径段数区分）。
     */
    @GetMapping("/slug/{slug}")
    public Result<HeroDetailVO> detailBySlug(@PathVariable String slug) {
        HeroDetailVO vo = heroService.getHeroDetailBySlug(slug);
        if (vo == null) {
            return Result.error(404, "英雄不存在（slug=" + slug + "）");
        }
        return Result.success(vo);
    }
}
