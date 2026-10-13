package com.dota.guide.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CorsConfig —— 跨域（CORS）配置
 *
 * 什么是跨域？
 *   浏览器有"同源策略"：协议、域名、端口三者完全一致才允许直接访问。
 *   我们的前端跑在 http://localhost:5173（Vite），后端在 http://localhost:8080，
 *   端口不同就算"跨域"，浏览器默认会拦截后端的响应。
 *
 * 解决方式有两种（二选一，本项目用第 1 种）：
 *   1. 后端允许跨域 —— 即本类：在后端响应头里声明"允许来自 5173 的请求"。
 *   2. 前端开发服务器代理 —— Vite 的 proxy 配置（见前端 vite.config.js 中的注释），
 *      把 /api 开头的请求转发到 8080，浏览器只跟 5173 通信，就不算跨域了。
 */
@Configuration // 声明这是一个配置类，Spring Boot 启动时会加载
public class CorsConfig implements WebMvcConfigurer {

    /**
     * 注册跨域规则
     * CorsRegistry：Spring MVC 提供的跨域配置注册器
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")                 // 规则作用的路径：/** 表示所有接口
                .allowedOriginPatterns("*")        // 允许的来源域名。开发阶段放开为 *，
                                                   // 上线时应改成具体地址，如 http://localhost:5173
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                                                   // 允许的 HTTP 方法；OPTIONS 是跨域预检请求要用
                .allowedHeaders("*")               // 允许的请求头
                .allowCredentials(false)           // 是否允许携带 Cookie；若为 true 则不能配 *，
                                                   // 两者冲突 Spring 会直接启动报错
                .maxAge(3600);                     // 预检请求结果缓存 3600 秒，减少重复预检
    }
}
