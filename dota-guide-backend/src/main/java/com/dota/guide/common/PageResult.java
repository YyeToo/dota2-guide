package com.dota.guide.common;

import java.util.List;

/**
 * PageResult —— 分页查询的统一返回结构
 *
 * 泛型类 <T>：T 可以是任何类型（本项目里是 Hero）。
 * 前端拿到的 data 结构：{ total: 123, list: [英雄1, 英雄2, ...] }
 *
 * total：符合条件的总条数（前端用 total / size 算总页数）
 * list ：当前页的数据
 */
public class PageResult<T> {

    /** 总条数 */
    private long total;

    /** 当前页数据 */
    private List<T> list;

    // 构造器：创建对象时就必须把两个字段都传进来，避免漏赋值
    public PageResult(long total, List<T> list) {
        this.total = total;
        this.list = list;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public List<T> getList() {
        return list;
    }

    public void setList(List<T> list) {
        this.list = list;
    }
}
