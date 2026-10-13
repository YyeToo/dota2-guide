package com.dota.guide.common;

/**
 * Result —— 统一的接口返回格式
 *
 * 所有接口都返回 { code, message, data } 三层结构：
 *   code    : 业务状态码，200=成功，404=资源不存在，500=服务器错误
 *   message : 提示信息（成功为 success，失败为具体原因）
 *   data    : 真正的数据（英雄列表 / 单个英雄）
 *
 * 好处：前端只需写一套解析逻辑（见前端 src/api/hero.js 的响应拦截器），
 *       不用为每个接口分别处理成功/失败的判断。
 *
 * 泛型 <T>：data 的类型随接口而定 —— 列表接口是 List<Hero>，详情接口是 Hero，
 * 所以 Result 设计成泛型类，一套代码适配所有接口。
 */
public class Result<T> {

    /** 业务状态码 */
    private Integer code;

    /** 提示信息 */
    private String message;

    /** 数据体 */
    private T data;

    // 无参构造器：JSON 反序列化时需要（本项目用不到，写上作为好习惯）
    public Result() {
    }

    public Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    /** 成功时的快捷构造：code 固定 200 */
    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    /** 失败时的快捷构造：由调用方指定错误码和原因 */
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }

    // ==================== getter / setter ====================

    public Integer getCode() {
        return code;
    }

    public void setCode(Integer code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
