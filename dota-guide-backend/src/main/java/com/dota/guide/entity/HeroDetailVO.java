package com.dota.guide.entity;

import java.util.ArrayList;
import java.util.List;

/**
 * HeroDetailVO —— 详情接口的返回结构（VO = View Object，专门给前端看的对象）
 *
 * 继承 Hero：自动拥有英雄的基础字段（id / name / intro / tips / items / counters），
 * 再额外加上技能列表 skills，实现"一个英雄 + 他的多条技能"的完整详情。
 * 序列化为 JSON 时，继承来的字段也会一并输出。
 *
 * 为什么不直接把 skills 字段加进 Hero？
 * 因为列表接口返回的 Hero 不需要技能（卡片页用不上，查了浪费），
 * 继承 + 扩展的方式让"列表用父类、详情用子类"，各取所需。
 */
public class HeroDetailVO extends Hero {

    /** 该英雄的全部技能（一对多中的"多"方） */
    private List<HeroSkill> skills = new ArrayList<>();

    public List<HeroSkill> getSkills() {
        return skills;
    }

    public void setSkills(List<HeroSkill> skills) {
        this.skills = skills;
    }
}
