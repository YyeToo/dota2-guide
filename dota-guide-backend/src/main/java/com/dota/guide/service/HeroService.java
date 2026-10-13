package com.dota.guide.service;

import com.dota.guide.common.PageResult;
import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailRow;
import com.dota.guide.entity.HeroDetailVO;
import com.dota.guide.entity.HeroSkill;
import com.dota.guide.mapper.HeroMapper;
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
 * 第二阶段升级：
 *   1. listHeroes → getHeroPage：参数校验 + 计算 offset + 分页查询
 *   2. getHeroById → getHeroDetail：把 JOIN 查出的"扁平行"组装成 英雄+技能 结构
 */
@Service // 把本类注册为 Spring 容器中的一个 Bean（组件），供 Controller 注入使用
public class HeroService {

    /** 默认每页条数（和前端保持一致） */
    private static final int DEFAULT_SIZE = 24;

    /** 每页最多条数：防止有人传 size=999999 一次性拖垮数据库 */
    private static final int MAX_SIZE = 100;

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
     * @param keyword    关键词（模糊匹配英雄名/简介）
     * @param role       定位筛选（如"核心"，模糊匹配 role 列的官方定位标签）
     * @param pos        号位筛选（如"3号位"，模糊匹配 pos 列）
     * @param attr       主属性筛选（力量/敏捷/智力，精确匹配 attr 列）
     * @param complexity 复杂度筛选（1 简单/2 中等/3 困难，精确匹配 complexity 列）
     * @param page       页码，从 1 开始
     * @param size       每页条数
     */
    public PageResult<Hero> getHeroPage(String keyword, String role, String pos,
                                        String attr, Integer complexity, int page, int size) {
        // 参数兜底：前端传脏数据（page=0、size=-1）时也能正常工作，
        // 真实项目里这种防御性校验是 Service 的常见职责
        if (page < 1) {
            page = 1;
        }
        if (size < 1) {
            size = DEFAULT_SIZE;
        }
        if (size > MAX_SIZE) {
            size = MAX_SIZE;
        }

        // 第 2 页取 24 条 = 跳过前 (2-1)*24 = 24 条，这是分页的核心换算
        int offset = (page - 1) * size;

        // 一次请求里跑两条 SQL：一条查总数、一条查当前页
        long total = heroMapper.countByFilter(keyword, role, pos, attr, complexity);
        List<Hero> list = heroMapper.findByPage(keyword, role, pos, attr, complexity, offset, size);
        return new PageResult<>(total, list);
    }

    /**
     * 查询英雄详情（含技能列表）；英雄不存在时返回 null，由 Controller 决定如何响应
     */
    public HeroDetailVO getHeroDetail(Long id) {
        List<HeroDetailRow> rows = heroMapper.findDetailRows(id);
        // 英雄不存在：LEFT JOIN 也查不出任何行
        if (rows.isEmpty()) {
            return null;
        }
        return assembleDetail(rows, id);
    }

    /**
     * 按 slug 查询英雄详情（第六阶段新增）
     * slug 是英雄英文内部名（如 sven，来自官网头像文件名），
     * 教学页的"代表英雄"链接用它——比数字 id 稳定、可读
     */
    public HeroDetailVO getHeroDetailBySlug(String slug) {
        List<HeroDetailRow> rows = heroMapper.findDetailRowsBySlug(slug);
        if (rows.isEmpty()) {
            return null;
        }
        // heroId 从查询结果第 1 行取（slug 查出来才知道是几号英雄）
        return assembleDetail(rows, rows.get(0).getId());
    }

    /**
     * 组装"一对多"详情数据（id 查询和 slug 查询共用，避免两份一样的代码）
     *
     * 这里演示组装过程：SQL 查出的是扁平行（英雄信息重复、技能信息逐行不同），
     * 本方法把第 1 行的英雄字段 + 每行的技能字段，拼成 HeroDetailVO。
     */
    private HeroDetailVO assembleDetail(List<HeroDetailRow> rows, Long heroId) {
        // 组装英雄基础信息（每行的英雄字段都一样，取第 1 行即可）
        HeroDetailRow first = rows.get(0);
        HeroDetailVO vo = new HeroDetailVO();
        vo.setId(first.getId());
        vo.setName(first.getName());
        vo.setSlug(first.getSlug());
        vo.setAlias(first.getAlias());
        vo.setRole(first.getRole());
        vo.setPos(first.getPos());
        vo.setAttr(first.getAttr());
        vo.setAttack(first.getAttack());
        vo.setComplexity(first.getComplexity());
        vo.setAvatar(first.getAvatar());
        vo.setIntro(first.getIntro());
        vo.setTips(first.getTips());
        vo.setItems(first.getItems());
        vo.setCounters(first.getCounters());

        // 组装技能列表：跳过"技能列为 NULL"的行（英雄没技能时 LEFT JOIN 产生的）
        for (HeroDetailRow row : rows) {
            if (row.getSkillId() == null) {
                continue;
            }
            HeroSkill skill = new HeroSkill();
            skill.setId(row.getSkillId());
            skill.setHeroId(heroId);
            skill.setSkillKey(row.getSkillKey());
            skill.setSkillType(row.getSkillType());
            skill.setSkillSource(row.getSkillSource());
            skill.setSkillName(row.getSkillName());
            skill.setSkillDesc(row.getSkillDesc());
            vo.getSkills().add(skill);
        }
        return vo;
    }
}
