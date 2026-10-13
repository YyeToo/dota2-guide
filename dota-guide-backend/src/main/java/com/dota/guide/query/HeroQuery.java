package com.dota.guide.query;

/**
 * HeroQuery —— 英雄列表的查询条件
 *
 * ============================================================
 * 为什么要有这个类
 * ============================================================
 * 改之前，一个筛选条件要穿三层：
 *
 *   Controller.list(keyword, role, pos, attr, complexity, page, size)   ← 7 个参数
 *     → Service.getHeroPage(同样 7 个)
 *       → Mapper.findByPage(7 个) 和 countByFilter(前 5 个)
 *
 * 七元组在每一层都重抄一遍，加一个筛选条件要改 4 处签名；
 * 更麻烦的是 `findByPage` 和 `countByFilter` 的 WHERE 谓词必须**手工保持一致**
 * —— 少同步一处，就会出现「列表显示 3 条、总条数却是 100」这种对不上的 bug
 * （原代码里那句「改了一处，记得同步改另一处」就是这个意思）。
 *
 * 现在两个方法吃同一个对象，Mapper 里 WHERE 谓词也抽成了共享片段（见 HeroMapper.xml），
 * 从「靠人记得同步」变成「结构上没法不同步」。
 *
 * ============================================================
 * 分页兜底放在 setter 里
 * ============================================================
 * 原来的兜底逻辑（page < 1 当 1、size < 1 当 24、size 超上限砍掉）
 * 是写在 Service 方法体里的。挪进 setter 之后有个好处：
 * **对象一旦构造出来，它的 page/size 就一定是合法的**，
 * 任何拿到它的代码都不用再检查一遍 —— 这条不变量由对象自己保证，而不是靠调用方自觉。
 *
 * 上限从 100 提到 500 是修一个真实的漏洞，不是为了放宽限制 —— 见 MAX_SIZE 的注释。
 */
public class HeroQuery {

    /** 默认每页条数（和前端保持一致） */
    public static final int DEFAULT_SIZE = 24;

    /**
     * 每页最多条数。防止有人传 size=999999 一次性把整张表拖出来。
     *
     * 原来是 100，改成 500 修的是一个「静默截断」问题：
     * 集成测试的 fetchAllHeroes() 传的是 size=500 想"一次拿完 127 个英雄"，
     * 但 500 被静默砍成 100，它实际只拿到前 100 个 ——
     * 于是那几条「遍历每个英雄检查字段」的测试，27 个英雄从来没被检查过，
     * 而测试全绿、没有任何提示。这类"参数被吞掉、调用方毫不知情"的行为
     * 比报错难查得多。
     *
     * 选 500 是因为它要够得着当前 127 个英雄（留出几倍的余量），
     * 同时仍然挡得住 size=999999 这种拖全表的请求。
     * 前端不受影响：它按 size=24 一页页翻，永远碰不到这个上限。
     */
    public static final int MAX_SIZE = 500;

    // ==================== 筛选条件 ====================
    // 字段名必须和前端传的 URL 参数名一致 ——
    // Controller 用 @ModelAttribute 绑定，Spring 是按字段名去 ? 后面找的。

    /** 关键词：同时模糊匹配 官方名(name) / 俗称(alias) / 简介(intro) 三列 */
    private String keyword;

    /** 定位：模糊匹配 role 列（官网 9 定位标签，顿号分隔，所以用 LIKE 能匹配到其中任意一个） */
    private String role;

    /** 号位：模糊匹配 pos 列（如「3号位」，复合值「4/5号位」也能被 LIKE '%3号位%' 之外的写法命中） */
    private String pos;

    /** 主属性：精确匹配 attr 列（力量/敏捷/智力/全才，取值固定所以不用模糊） */
    private String attr;

    /** 复杂度：精确匹配 complexity 列（1 简单 / 2 中等 / 3 困难） */
    private Integer complexity;

    // ==================== 分页 ====================
    // 字段默认值就是「没传参数时」的取值，所以前端不传 page/size 也能正常工作。

    /** 页码，从 1 开始 */
    private int page = 1;

    /** 每页条数 */
    private int size = DEFAULT_SIZE;

    // ==================== getter / setter ====================

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
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

    public Integer getComplexity() {
        return complexity;
    }

    public void setComplexity(Integer complexity) {
        this.complexity = complexity;
    }

    public int getPage() {
        return page;
    }

    /** 页码小于 1 一律当第 1 页（前端传 page=0 或负数时不至于查出空列表） */
    public void setPage(int page) {
        this.page = Math.max(1, page);
    }

    public int getSize() {
        return size;
    }

    /**
     * 每页条数兜底：
     *   size < 1    → 用默认值 24（传 0 或负数当没传）
     *   size > 500  → 砍到 500（防止一次拖出整张表）
     */
    public void setSize(int size) {
        this.size = size < 1 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
    }

    public int getOffset() {
        return (page - 1) * size;
    }
}
