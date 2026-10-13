package com.dota.guide.exception;

import com.dota.guide.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * GlobalExceptionHandler —— 全局异常处理器
 *
 * 作用：兜底捕获 Controller 抛出的所有未处理异常。
 * 如果没有它，代码一旦报错，后端返回的是 Spring 默认的 HTML 错误页，
 * 前端 Axios 会收到一堆 HTML，难以解析；有了它，任何错误都统一返回
 * { code: 500, message: "..." } 的 JSON，前端提示友好。
 *
 * 运行原理：@RestControllerAdvice 声明本类是全局"切面"，
 * 任何 Controller 抛出的异常在返回给浏览器之前，都会先经过这里。
 *
 * ⚠️ 兜底要有兜底的边界：Exception.class 会把"地址写错"这种客户端问题
 * 也一并接住，报成 500（见下面 handleNoResourceFound 的说明）。
 * 所以越具体的异常要写在越前面，让兜底只兜真正兜不住的东西。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 日志对象：把异常详情打印到后端控制台，排查问题时看这里
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 请求的路径没匹配到任何接口 —— 返回 404，而不是 500
     *
     * ============================================================
     * 为什么需要单独处理这一类（这是一个真实踩过的坑）
     * ============================================================
     * Spring Boot 3 处理请求的顺序是：先找 @GetMapping 这类接口，
     * 没找到就把请求当成**静态资源**去查（它以为你要找个首页 HTML 之类的），
     * 还找不着就抛 NoResourceFoundException。
     *
     * 这个异常如果不单独接住，就会掉进下面的 Exception 兜底里，
     * 变成 500「服务器内部错误」—— 于是：
     *   浏览器打开 http://localhost:8080/       → 「服务器内部错误：No static resource .」
     *   接口路径多打一个字母 /api/heroess        → 「服务器内部错误：No static resource api/heroess.」
     * 一个明明是"你地址写错了"的客户端问题，被报成"后端崩了"的服务端问题，
     * 排查方向从一开始就被带偏。
     *
     * ============================================================
     * 关于 @ExceptionHandler 的匹配规则
     * ============================================================
     * 同一个类里有多个 @ExceptionHandler 时，Spring 选**最具体**的那个：
     * NoResourceFoundException 是本方法的类型，Exception 是它的祖先，
     * 所以路径不存在的请求走这里，其他异常仍然走兜底。
     *
     * @param e       被捕获的异常对象
     * @param request 原始请求，用来把用户实际访问的地址回显给他
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public Result<Void> handleNoResourceFound(NoResourceFoundException e, HttpServletRequest request) {
        // 用 request.getRequestURI() 而不是 e.getResourcePath()：
        // 后者返回的路径不带开头的斜杠，访问根路径时还是空字符串，
        // 回显出来是「接口不存在：」，少了个东西看着别扭。
        String path = request.getRequestURI();

        // 这里用 warn 不用 error，也**不打堆栈**：
        // 这是正常的 404，不是故障。打堆栈只会把控制台刷满，
        // 把真正出错的那些异常淹掉。
        log.warn("请求的路径不存在：{}", path);

        return Result.error(404, "接口不存在：" + path);
    }

    /**
     * 捕获所有异常（兜底）
     * @ExceptionHandler 声明本方法处理哪种异常；Exception.class 表示全部类型
     *
     * @param e 被捕获的异常对象
     */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        // 详细堆栈打印到后端控制台（开发调试的关键信息），不暴露给前端
        log.error("服务器内部错误", e);
        // 只把简短原因返回给前端
        return Result.error(500, "服务器内部错误：" + e.getMessage());
    }
}
