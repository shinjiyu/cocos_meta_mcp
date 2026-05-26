import { join } from "path";

module.paths.push(join(Editor.App.path, "node_modules"));

/**
 * 场景进程脚本：供 cocosmcp_exec scene-eval / scene-script（name=fg-cocosmcp）调用。
 */
export const methods = {
    /**
     * 在场景进程执行 async 函数体（可用 cc、console）。
     */
    async eval(code: string) {
        const trimmed = typeof code === "string" ? code.trim() : "";
        if (!trimmed) {
            return { ok: false, error: "empty code" };
        }
        try {
            const AsyncFunction = Object.getPrototypeOf(async function () {
                /* noop */
            }).constructor as new (
                ...params: string[]
            ) => (...args: unknown[]) => Promise<unknown>;
            const cc = require("cc");
            const fn = new AsyncFunction("cc", "console", trimmed);
            const result = await fn(cc, console);
            return { ok: true, result };
        } catch (e) {
            const err = e as Error;
            return { ok: false, error: err?.message ?? String(e), stack: err?.stack };
        }
    },
};
