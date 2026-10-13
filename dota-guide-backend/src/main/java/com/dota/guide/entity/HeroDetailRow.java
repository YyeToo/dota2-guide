package com.dota.guide.entity;

/**
 * HeroDetailRow —— 一对多 JOIN 查询的"行"结构（只在 Mapper 和 Service 之间传递）
 *
 * 为什么需要它：
 * SQL 里 LEFT JOIN 查出来的结果是"扁平"的行 ——
 * 英雄信息在每一行重复出现，技能信息每行不同（斧王有 4 条技能就查出来 4 行）。
 * 这个类对应其中"一行"的所有列。
 *
 * Service 层拿到 List<HeroDetailRow> 后，
 * 会组装成 HeroDetailVO（一个英雄对象 + 技能列表）再返回给前端。
 * 这种"扁平行"类通常叫 DTO（Data Transfer Object，数据传输对象），
 * 名字里的 Row 表示"它就是查询结果的一行"。
 */
public class HeroDetailRow {

    // ---------- 来自 hero 表 ----------
    private Long id;
    private String name;
    private String slug;   // 英文内部名（第六阶段新增列）
    private String alias;  // 俗称/旧译名（第五阶段新增列）
    private String role;
    private String pos;
    private String attr;
    private String attack;
    private Integer complexity;
    private String avatar;
    private String intro;
    private String tips;
    private String items;
    private String counters;

    // ---------- 来自 hero_skill 表 ----------
    // SQL 里写了 AS 别名（skill_id、skill_key...），因为两表都有 id/name 列，
    // 列名冲突时必须用别名区分；别名会自动驼峰映射成 skillId、skillKey...
    private Long skillId;
    private String skillKey;
    private String skillType;
    private String skillSource;
    private String skillName;
    private String skillDesc;

    // ==================== getter / setter ====================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getAlias() {
        return alias;
    }

    public void setAlias(String alias) {
        this.alias = alias;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getPos() {
        return pos;
    }

    public void setPos(String pos) {
        this.pos = pos;
    }

    public String getAttr() {
        return attr;
    }

    public void setAttr(String attr) {
        this.attr = attr;
    }

    public String getAttack() {
        return attack;
    }

    public void setAttack(String attack) {
        this.attack = attack;
    }

    public Integer getComplexity() {
        return complexity;
    }

    public void setComplexity(Integer complexity) {
        this.complexity = complexity;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getIntro() {
        return intro;
    }

    public void setIntro(String intro) {
        this.intro = intro;
    }

    public String getTips() {
        return tips;
    }

    public void setTips(String tips) {
        this.tips = tips;
    }

    public String getItems() {
        return items;
    }

    public void setItems(String items) {
        this.items = items;
    }

    public String getCounters() {
        return counters;
    }

    public void setCounters(String counters) {
        this.counters = counters;
    }

    public Long getSkillId() {
        return skillId;
    }

    public void setSkillId(Long skillId) {
        this.skillId = skillId;
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
