package com.dota.guide.service;

import com.dota.guide.common.PageResult;
import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailVO;
import com.dota.guide.mapper.HeroMapper;
import com.dota.guide.query.HeroQuery;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * HeroService —— 业务层
 *
 * 为什么 Controller 不直接调用 Mapper，中间还要隔一层 Service？
 * 因为真实项目里的"业务逻辑"（数据校验、权限判断、缓存、事务、多表配合等）
 * 都写在 Service 里，Controller 只负责"接请求、返回结果"。
 * 分层让每层职责单一，好维护、好测试。
 *
 * ============================================================
 * 这一版比上一版短了将近一半，少掉的都是"搬运"
 * ============================================================
 *   1. 分页参数兜底（page<1 当 1、size 超上限砍掉）搬进了 HeroQuery 的 setter ——
 *      这条不变量归数据自己管，Service 不用每次再检查一遍；
 *   2. getHeroDetail(id) / getHeroDetailBySlug(slug) 合并成一个 getHeroDetail(key)，
 *      因为 Mapper 的一条查询就能同时认两种标识；
 *   3. 40 行的 assembleDetail（把 JOIN 出来的扁平行手工拼成嵌套结构）
 *      整个删掉了 —— 这件事现在由 HeroMapper.xml 里的 <collection> 在 MyBatis
 *      内部完成，SQL 查出什么形状，返回的对象就是什么形状。
 *
 * 剩下的两个方法各做一件事：算分页、判断 key 是不是数字。
 * 这才是业务层该有的样子：只琢磨业务规则，不掺和数据的搬运和拼装。
 */
@Service // 把本类注册为 Spring 容器中的一个 Bean（组件），供 Controller 注入使用
public class HeroService {

    /**
     * 依赖注入的推荐方式：构造器注入
     * Spring 创建 HeroService 对象时，会自动把 HeroMapper 的实现类传进构造器。
     */
    private final HeroMapper heroMapper;

    public HeroService(HeroMapper heroMapper) {
        this.heroMapper = heroMapper;
    }

    /**
     * 分页查询英雄列表
     *
     * 参数校验已经由 HeroQuery 的 setter 完成（对象一造出来 page/size 就一定是合法的），
     * 所以这里直接查就行。一次请求跑两条 SQL：一条查总数、一条查当前页。
     *
     * @param query 前端传来的筛选条件 + 分页参数
     */
    public PageResult<Hero> getHeroPage(HeroQuery query) {
        long total = heroMapper.countByFilter(query);
        List<Hero> list = heroMapper.findByPage(query);
        return new PageResult<>(total, list);
    }

    /**
     * 查询英雄详情（含技能列表）
     *
     * key 既可以是数字 id（/api/heroes/3，老书签还在用）也可以是 slug
     * （/api/heroes/sven，站内链接用它，因为 slug 是永久稳定的英文内部名）。
     * 前端不需要判断自己手上是哪种 —— 判断放在这里做一次，外面就不用关心了。
     *
     * @param key 英雄标识：数字 id 或 slug
     * @return 英雄详情；查无此人时返回 null，由 Controller 决定如何响应
     */
    public HeroDetailVO getHeroDetail(String key) {
        // 是纯数字就额外传一个数值形式的 id，让 SQL 能命中 id 那一支；
        // 不是数字就传 null，SQL 里 `h.id = NULL` 恒不成立，这一支自动失效。
        // parseLong 可能溢出（用户传一串超长数字），所以交给 try/catch 兜住：溢出就当成 slug 查。
        Long numericKey = toNumericKey(key);
        return heroMapper.findByKey(key, numericKey);
    }

    /**
     * 把 key 转成数字 id；不是纯数字（或是超出 Long 范围的天文数字）时返回 null
     *
     * "\d+" 只认整串数字，所以 "sven"、"12abc"、"sven2" 都会返回 null；
     * "003" 这种能转成 3，但数据库里没有 id=3 的 slug 叫 "003"，不会误伤。
     */
    private Long toNumericKey(String key) {
        if (key == null || !key.matches("\\d+")) {
            return null;
        }
        try {
            return Long.valueOf(key);
        } catch (NumberFormatException e) {
            // 数字长到 Long 装不下 —— 那它一定不是合法 id，当 slug 处理即可
            return null;
        }
    }
}
