package com.dota.guide;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * 后端集成测试 —— 真实数据库 + 真实 Spring 容器 + 完整 HTTP 链路
 *
 * ============================================================
 * 这个测试是干什么的（为什么值得存在）
 * ============================================================
 * 它守的是一类**真实发生过的 bug**：SQL 文件和代码对不上了。
 *
 * 具体那次：hero 表加了 slug 列，init.sql 里定义成 NOT NULL UNIQUE DEFAULT ''，
 * 但仓库里发布的 heroes_full.sql 是在加列之前生成的，INSERT 语句里没有 slug。
 * 结果全新安装时 127 个英雄的 slug 全是空字符串，插到第 2 条就撞唯一键：
 *     ERROR 1062: Duplicate entry '' for key 'uk_slug'
 * 整份导入失败，英雄表 0 行。
 *
 * 数据库结构、生成器、发布出去的 .sql 三者不一致 —— 这种错编译不报、单元测试
 * 也发现不了，只有「真的连上数据库、真的走一遍接口」才能抓到。
 * 所以这个测试不用内存库（H2），故意连真实的 MySQL。
 *
 * ============================================================
 * 怎么跑
 * ============================================================
 *   先确保 MySQL 服务在跑、dota_guide 库里有数据（见 README 快速开始）
 *   cd dota-guide-backend
 *   ./mvnw test
 *
 * 想只跑这一个类：
 *   ./mvnw test -Dtest=HeroApiIntegrationTest
 *
 * ============================================================
 * 它是只读的
 * ============================================================
 * 下面全是 GET 请求，不写库、不建表、不删数据 —— 对着生产库跑也安全。
 */
@SpringBootTest
@AutoConfigureMockMvc
class HeroApiIntegrationTest {

    /** MockMvc：不真的监听端口，但把请求完整走一遍 DispatcherServlet → Controller → Service → Mapper */
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /** 官网目前的英雄总数。官网新增英雄后这个数会变 —— 那时候请一并更新它 */
    private static final int EXPECTED_HERO_COUNT = 127;

    /** 发一个 GET 请求，把响应体解析成 JSON 树 */
    private JsonNode getJson(String url) throws Exception {
        MvcResult result = mockMvc.perform(get(url)).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /**
     * 取全部英雄（size 给大一点，一次拿完，方便做整体校验）。
     *
     * 这个方法里有**两道守卫**，都是为了挡住"测试假通过"：
     *
     * 1. 列表非空。下面好几条测试都是「遍历每个英雄，检查某字段」的形式 ——
     *    英雄表空的时候那个循环一次都不执行，测试会绿。而空表恰恰是那个
     *    fresh-install bug 的症状，正是最该报错的时候。
     *
     * 2. 拿到的条数 == total。请求的是 size=500，但如果这个值被后端的上限
     *    静默砍掉（HeroQuery.MAX_SIZE 原来就是 100），循环只会遍历到被砍剩的那部分，
     *    少检查的英雄一个都不会报出来。这条断言把"静默少拿"变成"直接失败"。
     *
     * 两道守卫都放在这个公共出口上，所有调用方一次受益。
     */
    private JsonNode fetchAllHeroes() throws Exception {
        JsonNode body = getJson("/api/heroes?size=500");
        assertEquals(200, body.path("code").asInt(), "列表接口没返回成功：" + body);

        JsonNode list = body.path("data").path("list");
        assertFalse(list.isEmpty(),
                "英雄列表是空的，后面的逐条校验都会假通过。大概率是 SQL 文件导入失败了 —— "
                        + "检查 heroes_full.sql 的 INSERT 列清单是否和 init.sql 的表结构一致（尤其是 slug 列）。");

        long total = body.path("data").path("total").asLong();
        assertEquals(total, list.size(),
                "一次请求只要到 " + list.size() + " 条，但总数是 " + total + " 条 —— size 被上限截断了。"
                        + "这样后面「遍历每个英雄」的检查会漏掉没拿到的那部分，而且不会有任何提示。"
                        + "如果英雄数确实超过了 size 上限，请把这里的 size 和 HeroQuery.MAX_SIZE 一起调大。");
        return list;
    }

    // ============================================================
    // 1. 列表接口 + 数据完整性
    // ============================================================

    @Test
    @DisplayName("列表接口能返回全部 127 名英雄")
    void listReturnsAllHeroes() throws Exception {
        JsonNode body = getJson("/api/heroes?size=500");
        assertEquals(200, body.path("code").asInt());

        long total = body.path("data").path("total").asLong();
        // 先单独断言 total > 0：这是那个 bug 最直接的症状（导入全挂时这里是 0），
        // 这样它失败时一眼就能看出是「库里没数据」而不是「英雄数变了」。
        assertTrue(total > 0,
                "英雄表是空的！大概率是 SQL 文件导入失败了 —— 检查 heroes_full.sql 的 "
                        + "INSERT 列清单是否和 init.sql 的表结构一致（尤其是 slug 列）。");
        assertEquals(EXPECTED_HERO_COUNT, total,
                "英雄总数变了。如果官网新增了英雄、你已重新跑过 update_all.sh，"
                        + "请把这个测试里的 EXPECTED_HERO_COUNT 一起改掉；否则说明数据不对。");
    }

    @Test
    @DisplayName("每个英雄都有非空的 slug（那个 fresh-install bug 的直接守卫）")
    void everyHeroHasSlug() throws Exception {
        List<String> missing = new ArrayList<>();
        for (JsonNode hero : fetchAllHeroes()) {
            String slug = hero.path("slug").asText();
            if (slug == null || slug.isBlank()) {
                missing.add(hero.path("name").asText());
            }
        }
        assertTrue(missing.isEmpty(),
                "这些英雄的 slug 是空的：" + missing
                        + "。slug 是 NOT NULL UNIQUE 列，空值会让整份导入撞唯一键失败。");
    }

    @Test
    @DisplayName("slug 全局唯一")
    void slugsAreUnique() throws Exception {
        Set<String> seen = new HashSet<>();
        List<String> duplicates = new ArrayList<>();
        for (JsonNode hero : fetchAllHeroes()) {
            String slug = hero.path("slug").asText();
            if (!seen.add(slug)) {
                duplicates.add(slug);
            }
        }
        assertTrue(duplicates.isEmpty(), "有重复的 slug：" + duplicates);
    }

    @Test
    @DisplayName("列表接口的关键字段都没有落空")
    void listFieldsArePopulated() throws Exception {
        JsonNode heroes = fetchAllHeroes();
        assertFalse(heroes.isEmpty());

        List<String> problems = new ArrayList<>();
        for (JsonNode hero : heroes) {
            String name = hero.path("name").asText();
            // attr / attack / complexity 来自官网；role / pos / intro 是本站数据
            if (hero.path("attr").asText().isBlank()) problems.add(name + " 缺主属性");
            if (hero.path("attack").asText().isBlank()) problems.add(name + " 缺攻击方式");
            if (hero.path("complexity").asInt() <= 0) problems.add(name + " 缺复杂度");
            if (hero.path("role").asText().isBlank()) problems.add(name + " 缺定位");
            if (hero.path("intro").asText().isBlank()) problems.add(name + " 缺简介");
            if (hero.path("avatar").asText().isBlank()) problems.add(name + " 缺头像");
        }
        assertTrue(problems.isEmpty(), "字段缺失：" + problems);
    }

    // ============================================================
    // 2. 详情接口（一个地址，认 slug 也认 id）
    // ============================================================

    @Test
    @DisplayName("按 slug 查详情：/api/heroes/sven 返回斯温")
    void detailBySlug() throws Exception {
        JsonNode body = getJson("/api/heroes/sven");
        assertEquals(200, body.path("code").asInt(), "按 slug 查不到：" + body);

        JsonNode hero = body.path("data");
        assertEquals("sven", hero.path("slug").asText());
        assertEquals("斯温", hero.path("name").asText(), "slug 和英雄对不上了");
    }

    @Test
    @DisplayName("查不到的英雄返回 404，而不是 500")
    void detailByUnknownKey() throws Exception {
        JsonNode body = getJson("/api/heroes/no-such-hero-xyz");
        assertEquals(404, body.path("code").asInt());
    }

    @Test
    @DisplayName("数字 key 仍然按 id 解析（老书签 /heroes/3 还能用）")
    void detailByNumericKey() throws Exception {
        // 详情接口合并成一个 /api/heroes/{key} 之后，数字进来必须还走 id 分支 ——
        // 否则第七阶段之前留下的书签和首页卡片会全部失效。
        JsonNode list = fetchAllHeroes();
        long firstId = list.get(0).path("id").asLong();

        JsonNode body = getJson("/api/heroes/" + firstId);
        assertEquals(200, body.path("code").asInt(), "按 id 查不到：" + body);
        assertEquals(firstId, body.path("data").path("id").asLong());
    }

    @Test
    @DisplayName("同一个英雄按 id 和按 slug 查，返回的结构和内容完全一致")
    void idAndSlugReturnTheSameHero() throws Exception {
        // key 有两种写法是这一版新加的便利，但便利不能变成"两条返回结构不同的路"。
        // 这条测试把「两种写法等价」钉死：万一以后有人在 id 分支上多查了或少查了什么，这里会红。
        JsonNode list = fetchAllHeroes();
        List<String> problems = new ArrayList<>();

        for (JsonNode summary : list) {
            long id = summary.path("id").asLong();
            String slug = summary.path("slug").asText();
            String name = summary.path("name").asText();

            JsonNode byId = getJson("/api/heroes/" + id).path("data");
            JsonNode bySlug = getJson("/api/heroes/" + slug).path("data");

            if (!byId.equals(bySlug)) {
                problems.add(name + "（id=" + id + " / slug=" + slug + "）");
            }
        }
        assertTrue(problems.isEmpty(),
                "这些英雄按 id 查和按 slug 查的结果不一样：" + problems);
    }

    // ============================================================
    // 3. 英雄与技能的关联（一对多 join）
    // ============================================================

    /** 技能分类的合法取值。和 sql/lib/skills.js 里那五类一一对应 */
    private static final Set<String> SKILL_CATEGORIES = Set.of(
            "基础", "魔晶新增", "神杖新增", "魔晶强化", "神杖强化");

    @Test
    @DisplayName("每个英雄都至少有一条技能，且技能字段完整")
    void everyHeroHasSkills() throws Exception {
        List<Long> withoutSkills = new ArrayList<>();
        List<String> problems = new ArrayList<>();

        for (JsonNode hero : fetchAllHeroes()) {
            long id = hero.path("id").asLong();
            String name = hero.path("name").asText();

            JsonNode data = getJson("/api/heroes/" + id).path("data");
            JsonNode skills = data.path("skills");

            if (skills.isEmpty()) {
                withoutSkills.add(id);
                continue;
            }
            for (JsonNode skill : skills) {
                String skillName = skill.path("skillName").asText();
                if (skillName.isBlank()) problems.add(name + " 有技能没名字");
                // skillDesc 允许为空（极少数技能官网就没写描述），但技能名和分类必须有
                String category = skill.path("skillCategory").asText();
                if (category.isBlank()) problems.add(name + "/" + skillName + " 缺技能分类");
                else if (!SKILL_CATEGORIES.contains(category)) {
                    // 分类是物化进数据库的，冒出没见过的取值说明生成器和前端对不上了
                    problems.add(name + "/" + skillName + " 技能分类取值非法：" + category);
                }
                if (skill.path("skillType").asText().isBlank()) problems.add(name + "/" + skillName + " 缺主动/被动");
                if (skill.path("isInnate").isMissingNode()) problems.add(name + "/" + skillName + " 缺 isInnate");
                if (skill.path("sortOrder").isMissingNode()) problems.add(name + "/" + skillName + " 缺 sortOrder");
            }
        }

        assertTrue(withoutSkills.isEmpty(), "这些英雄一条技能都没有（hero_skill 表没挂上？）：" + withoutSkills);
        assertTrue(problems.isEmpty(), "技能字段缺失：" + problems);
    }

    @Test
    @DisplayName("每个英雄的 sortOrder 都是 1..n 连续且不重号")
    void sortOrderIsContiguousPerHero() throws Exception {
        // 这条守的是「技能显示顺序」本身。顺序错乱是静默的：接口照常返回 200，
        // 只是技能排错了位置，人眼看着一堆技能卡很难发现。
        // 数据库上有 UNIQUE KEY (hero_id, sort_order) 兜着重号，
        // 这里再从接口这一侧确认一遍「拿到的就是 1..n 连续」。
        List<String> problems = new ArrayList<>();

        for (JsonNode hero : fetchAllHeroes()) {
            long id = hero.path("id").asLong();
            String name = hero.path("name").asText();
            JsonNode skills = getJson("/api/heroes/" + id).path("data").path("skills");

            List<Integer> orders = new ArrayList<>();
            for (JsonNode skill : skills) orders.add(skill.path("sortOrder").asInt());
            Collections.sort(orders);

            List<Integer> expected = new ArrayList<>();
            for (int i = 1; i <= orders.size(); i++) expected.add(i);

            if (!orders.equals(expected)) {
                problems.add(name + "(id=" + id + ") 的 sortOrder 是 " + orders + "，应为 " + expected);
            }
        }

        assertTrue(problems.isEmpty(), "这些英雄的技能位次不连续：" + problems);
    }

    @Test
    @DisplayName("英雄的中文名没有乱码（UTF-8 链路是通的）")
    void chineseTextIsNotMangled() throws Exception {
        // 编码问题在数据库里表现为「乱码」，在 Java 这边看起来却是合法的字符串 ——
        // 所以不能只看「非空」，要确认拿到的确实是那几个汉字。
        JsonNode sven = getJson("/api/heroes/sven").path("data");
        assertEquals("斯温", sven.path("name").asText());

        JsonNode juggernaut = getJson("/api/heroes/juggernaut").path("data");
        assertEquals("主宰", juggernaut.path("name").asText());
        assertFalse(juggernaut.path("intro").asText().isBlank());
    }
}
