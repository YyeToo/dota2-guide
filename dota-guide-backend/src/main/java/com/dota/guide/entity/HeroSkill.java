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

    /** 技能来源：基础 / 魔晶 / 神杖（阿哈利姆魔晶、阿哈利姆神杖可升级或新增技能） */
    private String skillSource;

    /** 技能名 */
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

    public String getSkillSource() {
        return skillSource;
    }

    public void setSkillSource(String skillSource) {
        this.skillSource = skillSource;
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
