package com.dota.guide.exception;

import com.dota.guide.common.Result;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 日志对象：把异常详情打印到后端控制台，排查问题时看这里
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

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
