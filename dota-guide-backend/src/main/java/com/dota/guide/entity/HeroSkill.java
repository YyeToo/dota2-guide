package com.dota.guide.entity;

/**
 * HeroSkill 实体类 —— 对应数据库中的 hero_skill 表
 *
 * 它和 Hero 构成"一对多"关系：一个英雄（1）拥有多条技能（多），
 * 靠 hero_id 字段指向 Hero.id 来关联（每条技能都记住自己属于谁）。
 *
 * 字段命名技巧：数据库列名 hero_id / skill_key 是"下划线命名"，
 * Java 字段 heroId / skillKey 是"驼峰命名"。
 * 两者能自动对应，全靠 application.yml 里的
 * mybatis.map-underscore-to-camel-case: true 配置。
 */
public class HeroSkill {

    /** 主键 id（对应表的 id 列，自增） */
    private Long id;

    /** 所属英雄 id（对应列 hero_id，指向 hero.id，逻辑外键） */
    private Long heroId;

    /** 按键：Q / W / E / R / D / F（魔晶/神杖新增技能常用 D/F 键；被动技能仍显示所在槽位） */
    private String skillKey;

    /** 技能类型：主动（需要按键施放）/ 被动（自动生效） */
    private String skillType;

    /**
     * 技能分类：基础 / 魔晶新增 / 神杖新增 / 魔晶强化 / 神杖强化
     *
     * 这一列同时回答了「哪来的」（基础还是魔晶还是神杖）和「是新增还是纯强化」，
     * 前端拿它直接决定技能卡怎么画，不用去猜。
     * 它从数据库里读，不在 Java 里算 —— 见 sql/lib/skills.js 的物化说明。
     */
    private String skillCategory;

    /** 是否先天技能（出生自带、不占按键也不占技能位）。1 = 是，0 = 否 */
    private Integer isInnate;

    /** 本行在该英雄技能列表里的位次，每个英雄 1..n 连续；查询直接按它排序 */
    private Integer sortOrder;

    /** 技能名（官网中文名，强化行带 ·魔晶强化 / ·神杖强化 后缀） */
    private String skillName;

    /** 技能效果（新手向描述） */
    private String skillDesc;

    // ==================== getter / setter ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getHeroId() {
        return heroId;
    }

    public void setHeroId(Long heroId) {
        this.heroId = heroId;
    }

    public String getSkillKey() {
        return skillKey;
    }

    public void setSkillKey(String skillKey) {
        this.skillKey = skillKey;
    }

    public String getSkillType() {
        return skillType;
    }

    public void setSkillType(String skillType) {
        this.skillType = skillType;
    }

    public String getSkillCategory() {
        return skillCategory;
    }

    public void setSkillCategory(String skillCategory) {
        this.skillCategory = skillCategory;
    }

    public Integer getIsInnate() {
        return isInnate;
    }

    public void setIsInnate(Integer isInnate) {
        this.isInnate = isInnate;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getSkillName() {
        return skillName;
    }

    public void setSkillName(String skillName) {
        this.skillName = skillName;
    }

    public String getSkillDesc() {
        return skillDesc;
    }

    public void setSkillDesc(String skillDesc) {
        this.skillDesc = skillDesc;
    }
}
