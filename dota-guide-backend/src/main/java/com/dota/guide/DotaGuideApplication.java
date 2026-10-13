package com.dota.guide;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 启动类 —— 整个 Spring Boot 应用的入口
 *
 * 运行原理：
 *   main 方法调用 SpringApplication.run()，Spring Boot 会：
 *   1. 启动内嵌的 Tomcat 服务器（默认端口 8080，可在 application.yml 修改）
 *   2. 自动扫描本类所在包（com.dota.guide）及其子包下的所有组件：
 *      标注了 @RestController、@Service、@Mapper、@Configuration 等注解的类
 *      会被自动创建对象并注册到 Spring 容器（这叫"组件扫描"）
 *   3. 读取 application.yml 中的配置（数据库连接等）
 *
 * 所以后面写的 Controller/Service/Mapper 只要放在 com.dota.guide 包下，
 * 不需要任何额外的"注册"代码，Spring 会自动发现它们 —— 这叫"约定优于配置"。
 */
@SpringBootApplication // 组合注解 = @Configuration + @EnableAutoConfiguration + @ComponentScan
public class DotaGuideApplication {

    public static void main(String[] args) {
        // 启动应用；返回值是 Spring 容器上下文（本项目用不到）
        SpringApplication.run(DotaGuideApplication.class, args);
    }
}
