package com.dota.guide.mapper;

import com.dota.guide.entity.Hero;
import com.dota.guide.entity.HeroDetailRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * HeroMapper —— 数据访问层（DAO 层），专门负责和数据库打交道
 *
 * MyBatis 的特点：这里只需要写一个接口 + SQL 注解，
 * MyBatis 会在运行时自动生成这个接口的实现类（底层用 JDBC 执行 SQL）。
 *
 * SQL 写在注解里（@Select / @Insert / @Update / @Delete），
 * 复杂 SQL 也可以写在 XML 文件里；本项目查询不算复杂，用注解即可。
 *
 * 第二阶段升级内容：
 *   1. findAll 升级为 findByPage —— 分页 + 关键词/定位/号位筛选
 *   2. 新增 countByFilter —— 查总条数（分页必须知道总数才能算总页数）
 *   3. findById 升级为 findDetailRows —— LEFT JOIN 技能表，一对多关联查询
 */
@Mapper // 告诉 MyBatis：这是一个 Mapper 接口，请为它生成实现类并注册到 Spring 容器
public interface HeroMapper {

    /**
     * 分页查询英雄列表（支持三个可选筛选条件）
     *
     * <script> 标签：在注解里写"动态 SQL"的开关——包上它，
     * 才能使用 <if> 等标签按条件拼接 SQL。
     *
     * <if test="...">：test 里写条件表达式（OGNL 语法），
     * 参数为 null 或空字符串时跳过该条件——用户没搜索时就不拼这个 WHERE 条件。
     *
     * LIMIT #{size} OFFSET #{offset}：MySQL 分页语法，
     * 跳过前 offset 行、取 size 行（第 2 页 24 条 = 跳过 24 条取 24 条）。
     *
     * 注意点：
     *   1. `role` 要加反引号 —— role 是 MySQL 8 的保留字；
     *   2. 所有 #{} 参数都走预编译（? 占位符），用户输入不会直接拼进 SQL，防注入；
     *   3. LIKE 的模糊匹配用 CONCAT('%', #{keyword}, '%') 拼出 "%关键词%"。
     *   4. attr/complexity 是精确匹配（= 而不是 LIKE）：
     *      下拉筛选的值是固定的（力量/敏捷/智力、1/2/3），不需要模糊。
     *   5. keyword 同时匹配 name（官方名）/ alias（俗称，第五阶段新增）/ intro（简介）三列；
     *      排序用 CASE 按"命中权重"排：名字命中 > 俗称命中 > 简介命中，
     *      保证搜"兽"时真正叫"獸"的英雄排第一，而不是简介里带"兽"字的英雄。
     *
     * @Param 注解：给参数起名字，SQL 里的 #{keyword}、#{offset} 靠它对应。
     * 多个参数时必须加（不加的话 MyBatis 只能用 arg0/arg1 这种难懂的名字）。
     */
    @Select("<script>" +
            "SELECT id, name, slug, alias, `role`, pos, attr, attack, complexity, avatar, intro, tips, items, counters FROM hero WHERE 1=1" +
            "<if test='keyword != null and keyword != \"\"'>" +
            " AND (name LIKE CONCAT('%', #{keyword}, '%') OR alias LIKE CONCAT('%', #{keyword}, '%') OR intro LIKE CONCAT('%', #{keyword}, '%'))" +
            "</if>" +
            "<if test='role != null and role != \"\"'>" +
            " AND `role` LIKE CONCAT('%', #{role}, '%')" +
            "</if>" +
            "<if test='pos != null and pos != \"\"'>" +
            " AND pos LIKE CONCAT('%', #{pos}, '%')" +
            "</if>" +
            "<if test='attr != null and attr != \"\"'>" +
            " AND attr = #{attr}" +
            "</if>" +
            "<if test='complexity != null'>" +
            " AND complexity = #{complexity}" +
            "</if>" +
            "<choose>" +
            "<when test='keyword != null and keyword != \"\"'>" +
            " ORDER BY CASE WHEN name LIKE CONCAT('%', #{keyword}, '%') THEN 0" +
            " WHEN alias LIKE CONCAT('%', #{keyword}, '%') THEN 1 ELSE 2 END, id" +
            "</when>" +
            "<otherwise> ORDER BY id</otherwise>" +
            "</choose>" +
            " LIMIT #{size} OFFSET #{offset}" +
            "</script>")
    List<Hero> findByPage(@Param("keyword") String keyword,
                           @Param("role") String role,
                           @Param("pos") String pos,
                           @Param("attr") String attr,
                           @Param("complexity") Integer complexity,
                           @Param("offset") int offset,
                           @Param("size") int size);

    /**
     * 统计满足相同筛选条件的总条数
     *
     * ⚠️ 筛选条件必须和 findByPage 完全一致——
     * 否则会出现"列表显示 3 条、总条数却是 100"这种对不上的 bug。
     * 改了一处，记得同步改另一处。
     */
    @Select("<script>" +
            "SELECT COUNT(*) FROM hero WHERE 1=1" +
            "<if test='keyword != null and keyword != \"\"'>" +
            " AND (name LIKE CONCAT('%', #{keyword}, '%') OR alias LIKE CONCAT('%', #{keyword}, '%') OR intro LIKE CONCAT('%', #{keyword}, '%'))" +
            "</if>" +
            "<if test='role != null and role != \"\"'>" +
            " AND `role` LIKE CONCAT('%', #{role}, '%')" +
            "</if>" +
            "<if test='pos != null and pos != \"\"'>" +
            " AND pos LIKE CONCAT('%', #{pos}, '%')" +
            "</if>" +
            "<if test='attr != null and attr != \"\"'>" +
            " AND attr = #{attr}" +
            "</if>" +
            "<if test='complexity != null'>" +
            " AND complexity = #{complexity}" +
            "</if>" +
            "</script>")
    long countByFilter(@Param("keyword") String keyword,
                       @Param("role") String role,
                       @Param("pos") String pos,
                       @Param("attr") String attr,
                       @Param("complexity") Integer complexity);

    /**
     * 按 id 查询英雄详情（含技能）—— 一对多关联查询
     *
     * LEFT JOIN：以 hero 为主表，把 hero_skill 的技能行"贴"过来：
     *   - 英雄有 6 条技能（4 基础 + 魔晶 + 神杖）→ 查出 6 行（英雄信息重复 6 次，技能信息各不相同）
     *   - 英雄没有技能 → 查出 1 行（技能列为 NULL）
     * 这种"扁平行"由 Service 层组装成"英雄 + 技能列表"结构（见 HeroDetailRow）。
     *
     * 两个细节：
     *   1. 技能列写了 AS 别名（skill_id、skill_key...）：
     *      两表都有 id / name 列，列名冲突时必须用别名区分；
     *      别名会被驼峰映射成 skillId、skillKey...
     *   2. ORDER BY (s.skill_key = '') ASC, FIELD(s.skill_key, 'Q', 'W', 'E', 'R', 'D', 'F'), s.id：
     *      先把有按键的技能按 Q→W→E→R→D→F 排列（D/F 只出现在魔晶/神杖"新增技能"上），
     *      skill_key 为空的"强化类"技能（魔晶/神杖只强化已有技能、不占新按键）排在最后，
     *      按 id 顺序（插入时魔晶在前、神杖在后）。
     *      括号里的 (s.skill_key = '') 是布尔比较：MySQL 里返回 0/1，ASC 让 0 排前面。
     *      FIELD 是 MySQL 函数：返回第一个参数在后续列表中的位置序号。
     */
    @Select("SELECT h.id, h.name, h.slug, h.alias, h.`role`, h.pos, h.attr, h.attack, h.complexity, h.avatar, " +
            "h.intro, h.tips, h.items, h.counters, " +
            "s.id AS skill_id, s.skill_key, s.skill_type, s.skill_source, s.skill_name, s.skill_desc " +
            "FROM hero h LEFT JOIN hero_skill s ON h.id = s.hero_id " +
            "WHERE h.id = #{id} " +
            "ORDER BY (s.skill_key = '') ASC, FIELD(s.skill_key, 'Q', 'W', 'E', 'R', 'D', 'F'), s.id")
    List<HeroDetailRow> findDetailRows(Long id);

    /**
     * 按 slug 查询英雄详情（含技能）—— 第六阶段新增，SQL 和 findDetailRows 完全一致，
     * 只是 WHERE 条件从 id 换成 slug。
     *
     * 为什么要按 slug 查：教学页（新手须知"代表英雄"）的链接用的是英文内部名
     * （sven/axe/crystal_maiden...），数字 id 是数据库内部实现，写死在页面里
     * 数据一重灌就对不上；slug 来自官网头像文件名，永久稳定。
     */
    @Select("SELECT h.id, h.name, h.slug, h.alias, h.`role`, h.pos, h.attr, h.attack, h.complexity, h.avatar, " +
            "h.intro, h.tips, h.items, h.counters, " +
            "s.id AS skill_id, s.skill_key, s.skill_type, s.skill_source, s.skill_name, s.skill_desc " +
            "FROM hero h LEFT JOIN hero_skill s ON h.id = s.hero_id " +
            "WHERE h.slug = #{slug} " +
            "ORDER BY (s.skill_key = '') ASC, FIELD(s.skill_key, 'Q', 'W', 'E', 'R', 'D', 'F'), s.id")
    List<HeroDetailRow> findDetailRowsBySlug(String slug);
}
