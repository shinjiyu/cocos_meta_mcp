import { z } from "zod";

/** 多开路由：放在 schema 首位，避免部分客户端对尾部字段处理异常。 */
export const projectRootField = z
    .string()
    .optional()
    .describe("多开时指定目标工程绝对路径；省略则用当前工程（唯一在线实例会自动选中）。");

export const useProjectInputSchema = z.object({
    projectRoot: z
        .string()
        .describe("要切换到的 Cocos 工程绝对路径（后续调用默认路由到该工程）。"),
});

export const listBridgesInputSchema = z.object({
    probe: z
        .boolean()
        .optional()
        .describe("true=对每个实例 GET /health 并清理离线条目；默认 true。"),
});

export const healthInputSchema = z.object({
    projectRoot: projectRootField,
});

export const execInputSchema = z.object({
    projectRoot: projectRootField,
    mode: z.enum(["message", "eval", "scene-script", "scene-eval", "open-url"]),
    module: z.string().optional(),
    method: z.string().optional(),
    name: z.string().optional(),
    args: z.array(z.unknown()).optional(),
    messageType: z.enum(["request", "send"]).optional(),
    code: z.string().optional(),
    url: z.string().optional(),
    port: z.number().optional(),
});

export const runRecipeInputSchema = z.object({
    projectRoot: projectRootField,
    name: z.string(),
    params: z.record(z.unknown()).optional(),
});
