package com.dota.guide.mapper;

import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailVO;
import com.dota.guide.query.HeroQuery;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * HeroMapper —— 数据访问层（DAO 层），只负责和数据库打交道
 *
 * ============================================================
 * 这个接口现在只有 3 个方法，SQL 全在 HeroMapper.xml 里
 * ============================================================
 * 原来 SQL 写在 @Select 注解里，一共 4 个方法、160 行，其中：
 *   - findByPage 和 countByFilter 的 5 个 WHERE 谓词被复制了两份；
 *   - findDetailRows(id) 和 findDetailRowsBySlug(slug) 的 SQL 除了 WHERE 条件
 *     一个字都不差（原注释自己写着"SQL 和 findDetailRows 完全一致"）；
 *   - 两个详情方法返回的是"扁平行"（每行重复一遍英雄信息），
 *     得由 Service 层再写 40 行循环去组装成"英雄 + 技能列表"。
 *
 * 搬进 XML 之后这三点一起消失了：
 *   - WHERE 谓词抽成 <sql id="filters">，两个查询 <include> 同一份；
 *   - 详情只剩 findByKey 一个方法，id 和 slug 用 WHERE ... OR ... 一次判完；
 *   - 返回类型从 List<HeroDetailRow> 变成 HeroDetailVO，嵌套结构由 <collection>
 *     在 MyBatis 内部折叠完成，Service 里不再有组装循环。
 *
 * ============================================================
 * 关于 @Param
 * ============================================================
 * 单个参数时 MyBatis 可以直接用（findByKey 有两个参数所以必须加）。
 * 加了 @Param("key") 之后，XML 里才能写 #{key}。
 *
 * 方法名 = XML 里 <select> 的 id，接口全限定名 = <mapper namespace>，
 * 这两条对上了，@Mapper 生成的实现类才知道每个方法该执行哪段 SQL。
 */
@Mapper // 告诉 MyBatis：这是一个 Mapper 接口，请为它生成实现类并注册到 Spring 容器
public interface HeroMapper {

    /**
     * 分页查询英雄列表（支持关键词/定位/号位/主属性/复杂度 5 个可选筛选条件）
     *
     * 返回的 Hero 对象由 MyBatis 按列名自动映射（map-underscore-to-camel-case）。
     *
     * @param query 查询条件对象；偏移量和条数由它的 getOffset() / getSize() 提供，
     *              这两个值在 setter 里已经做过兜底，调用方不需要再校验
     */
    List<Hero> findByPage(HeroQuery query);

    /**
     * 统计满足同一套筛选条件的总条数（分页要靠它算总页数）
     *
     * 和 findByPage 共用 XML 里的 <sql id="filters"> 片段，
     * 所以不存在"改了一处忘了改另一处"导致列表和总数对不上的可能。
     */
    long countByFilter(HeroQuery query);

    /**
     * 按 key 查询英雄详情（含技能列表）—— key 既可以是数字 id 也可以是 slug
     *
     * @param key        用户传来的标识：/api/heroes/3 传 "3"，/api/heroes/sven 传 "sven"
     * @param numericKey key 是纯数字时传它的数值，否则传 null
     *                   （null 时 SQL 里 `h.id = NULL` 恒不成立，这一支自动失效）
     * @return 英雄 + 技能列表；查无此人时返回 null
     */
    HeroDetailVO findByKey(@Param("key") String key, @Param("numericKey") Long numericKey);
}
