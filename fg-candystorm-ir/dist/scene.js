"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
const path_1 = require("path");
module.paths.push((0, path_1.join)(Editor.App.path, "node_modules"));
/**
 * 场景进程脚本：供 candystorm_exec scene-eval / scene-script（name=fg-candystorm-ir）调用。
 */
exports.methods = {
    /**
     * 在场景进程执行 async 函数体（可用 cc、console）。
     */
    async eval(code) {
        var _a;
        const trimmed = typeof code === "string" ? code.trim() : "";
        if (!trimmed) {
            return { ok: false, error: "empty code" };
        }
        try {
            const AsyncFunction = Object.getPrototypeOf(async function () {
                /* noop */
            }).constructor;
            const cc = require("cc");
            const fn = new AsyncFunction("cc", "console", trimmed);
            const result = await fn(cc, console);
            return { ok: true, result };
        }
        catch (e) {
            const err = e;
            return { ok: false, error: (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(e), stack: err === null || err === void 0 ? void 0 : err.stack };
        }
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQTRCO0FBRTVCLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUEsV0FBSSxFQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFFekQ7O0dBRUc7QUFDVSxRQUFBLE9BQU8sR0FBRztJQUNuQjs7T0FFRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBWTs7UUFDbkIsTUFBTSxPQUFPLEdBQUcsT0FBTyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM1RCxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDWCxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLENBQUM7UUFDOUMsQ0FBQztRQUNELElBQUksQ0FBQztZQUNELE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSztnQkFDN0MsVUFBVTtZQUNkLENBQUMsQ0FBQyxDQUFDLFdBRTBDLENBQUM7WUFDOUMsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pCLE1BQU0sRUFBRSxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDdkQsTUFBTSxNQUFNLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JDLE9BQU8sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ2hDLENBQUM7UUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ1QsTUFBTSxHQUFHLEdBQUcsQ0FBVSxDQUFDO1lBQ3ZCLE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxPQUFPLG1DQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLEtBQUssRUFBRSxDQUFDO1FBQzlFLENBQUM7SUFDTCxDQUFDO0NBQ0osQ0FBQyJ9