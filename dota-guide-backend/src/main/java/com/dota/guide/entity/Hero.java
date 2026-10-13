package com.dota.guide.entity;

/**
 * Hero 实体类 —— 对应数据库中的 hero 表
 *
 * 它是"数据载体"：MyBatis 查询出的每一行记录，都会自动填充到本类的一个对象里。
 * 映射规则：数据库列名 = 类字段名（本项目列名与字段名完全一致）。
 *
 * 实体类标准写法：private 字段 + public 的 getter/setter。
 * 老项目常用 Lombok 的 @Data 注解自动生成 getter/setter，
 * 但新手阶段手写一遍更利于理解，而且不用装 IDE 插件，故本项目手写。
 */
public class Hero {

    /** 主键 id（对应表的 id 列，自增） */
    private Long id;

    /** 英雄名 */
    private String name;

    /** 英雄英文内部名（slug，唯一，如 axe/sven/crystal_maiden；来自官网头像文件名）—— 第六阶段新增列，教学页详情链接用 */
    private String slug;

    /** 英雄俗称/旧译名（顿号分隔，如"剑圣、尤涅若"；搜索框靠它搜到玩家叫法）—— 第五阶段新增列 */
    private String alias;

    /** 定位：官网 9 种定位标签（核心/辅助/爆发/控制/打野/肉盾/逃生/推进/先手，顿号分隔）—— 第四阶段改为官网数据 */
    private String role;

    /** 号位：1-5号位（本教学站自创体系，官网没有号位概念）—— 第四阶段新增列 */
    private String pos;

    /** 主属性：力量 / 敏捷 / 智力（官网数据）—— 第四阶段新增列 */
    private String attr;

    /** 攻击方式：近战 / 远程（官网数据）—— 第四阶段新增列 */
    private String attack;

    /** 操作复杂度：1 简单 / 2 中等 / 3 困难（官网数据）—— 第四阶段新增列 */
    private Integer complexity;

    /** 英雄头像图 URL（官网 CDN）—— 第四阶段新增列 */
    private String avatar;

    /** 英雄简介 */
    private String intro;

    /** 给新手的打法建议 */
    private String tips;

    /** 推荐装备（顿号分隔，如"先锋盾、闪烁匕首"）—— 第二阶段新增列 */
    private String items;

    /** 克制关系与注意事项 —— 第二阶段新增列 */
    private String counters;

    // ==================== getter / setter ====================
    // 序列化为 JSON、MyBatis 填充数据时都会调用它们，缺一不可

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
}
