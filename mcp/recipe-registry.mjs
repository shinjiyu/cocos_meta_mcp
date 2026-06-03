import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { promotedRecipeToolName } from "./tool-naming.mjs";

const RECIPE_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function promotedToolName(recipeName, customToolName) {
    return promotedRecipeToolName(recipeName, customToolName);
}

export function cocosmcpDir(projectRoot) {
    return path.join(projectRoot, ".cocosmcp");
}

export function recipesDir(projectRoot) {
    return path.join(cocosmcpDir(projectRoot), "recipes");
}

export function auditPath(projectRoot) {
    return path.join(cocosmcpDir(projectRoot), "exec-audit.jsonl");
}

export function registryPath(projectRoot) {
    return path.join(cocosmcpDir(projectRoot), "registry.json");
}

export function recipeFilePath(projectRoot, name) {
    return path.join(recipesDir(projectRoot), `${name}.json`);
}

export function ensureDirs(projectRoot) {
    fs.mkdirSync(recipesDir(projectRoot), { recursive: true });
}

function readRegistry(projectRoot) {
    ensureDirs(projectRoot);
    const file = registryPath(projectRoot);
    if (!fs.existsSync(file)) {
        return { version: 1, recipes: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return { version: 1, recipes: {}, error: "invalid registry.json" };
    }
}

function writeRegistry(projectRoot, registry) {
    ensureDirs(projectRoot);
    fs.writeFileSync(registryPath(projectRoot), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

export function hashText(text) {
    return crypto.createHash("sha256").update(text ?? "").digest("hex").slice(0, 16);
}

export function summarizeValue(value, maxLen = 500) {
    if (value === undefined) {return undefined;}
    try {
        const text = typeof value === "string" ? value : JSON.stringify(value);
        if (text.length <= maxLen) {return text;}
        return `${text.slice(0, maxLen)}…(${text.length} chars)`;
    } catch {
        return String(value).slice(0, maxLen);
    }
}

export function appendExecAudit(projectRoot, entry) {
    ensureDirs(projectRoot);
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
    });
    fs.appendFileSync(auditPath(projectRoot), `${line}\n`, "utf8");
}

export function readAuditEntries(projectRoot, { limit = 500, source } = {}) {
    const file = auditPath(projectRoot);
    if (!fs.existsSync(file)) {return [];}
    const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
    let entries = lines
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    if (source) {entries = entries.filter((e) => e.source === source);}
    if (limit > 0 && entries.length > limit) {entries = entries.slice(-limit);}
    return entries;
}

export function computeExecStats(projectRoot, { limit = 2000 } = {}) {
    const entries = readAuditEntries(projectRoot, { limit });
    const buckets = new Map();

    for (const entry of entries) {
        const key =
            entry.recipeName ??
            (entry.mode === "message"
                ? `message:${entry.module}.${entry.method}`
                : entry.mode === "eval" || entry.mode === "scene-eval"
                  ? `${entry.mode}:${entry.codeHash}`
                  : `${entry.mode}:${entry.method ?? entry.name ?? "unknown"}`);

        if (!buckets.has(key)) {
            buckets.set(key, {
                key,
                count: 0,
                okCount: 0,
                failCount: 0,
                lastTs: null,
                mode: entry.mode,
                recipeName: entry.recipeName,
                module: entry.module,
                method: entry.method,
                codeHash: entry.codeHash,
                sampleCode: entry.codePreview,
            });
        }
        const bucket = buckets.get(key);
        bucket.count += 1;
        if (entry.ok) {bucket.okCount += 1;}
        else {bucket.failCount += 1;}
        bucket.lastTs = entry.ts;
        if (entry.codePreview && !bucket.sampleCode) {bucket.sampleCode = entry.codePreview;}
    }

    const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
    return {
        totalEntries: entries.length,
        uniquePatterns: ranked.length,
        top: ranked.slice(0, 20),
    };
}

function loadRecipeFile(projectRoot, name) {
    const file = recipeFilePath(projectRoot, name);
    if (!fs.existsSync(file)) {return null;}
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return { name, error: `invalid recipe file: ${String(e)}` };
    }
}

export function listRecipes(projectRoot) {
    ensureDirs(projectRoot);
    const registry = readRegistry(projectRoot);
    const files = fs.existsSync(recipesDir(projectRoot))
        ? fs.readdirSync(recipesDir(projectRoot)).filter((f) => f.endsWith(".json"))
        : [];

    const names = new Set([
        ...Object.keys(registry.recipes ?? {}),
        ...files.map((f) => f.replace(/\.json$/, "")),
    ]);

    return [...names]
        .sort()
        .map((name) => {
            const meta = registry.recipes?.[name] ?? {};
            const recipe = loadRecipeFile(projectRoot, name);
            return {
                name,
                description: recipe?.description ?? meta.description,
                mode: recipe?.mode ?? meta.mode,
                promoted: !!meta.promoted,
                toolName: meta.toolName ?? (meta.promoted ? promotedToolName(name) : undefined),
                params: recipe?.params ?? meta.params ?? {},
                createdAt: meta.createdAt,
                updatedAt: meta.updatedAt,
                useCount: meta.useCount ?? 0,
                exists: !!recipe && !recipe.error,
                error: recipe?.error,
            };
        });
}

export function getRecipe(projectRoot, name) {
    const recipe = loadRecipeFile(projectRoot, name);
    if (!recipe) {return null;}
    const registry = readRegistry(projectRoot);
    const meta = registry.recipes?.[name] ?? {};
    return {
        ...recipe,
        promoted: !!meta.promoted,
        toolName: meta.toolName,
        useCount: meta.useCount ?? 0,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
    };
}

function validateRecipeName(name) {
    if (!RECIPE_NAME_RE.test(name)) {
        throw new Error(`invalid recipe name "${name}", use lowercase snake_case`);
    }
}

function validateRecipePayload(recipe) {
    validateRecipeName(recipe.name);
    if (!recipe.description?.trim()) {
        throw new Error("description is required");
    }
    if (!["message", "eval", "scene-script", "scene-eval", "open-url"].includes(recipe.mode)) {
        throw new Error(`unsupported mode: ${recipe.mode}`);
    }
    if ((recipe.mode === "eval" || recipe.mode === "scene-eval") && !recipe.code?.trim()) {
        throw new Error("eval/scene-eval requires code");
    }
    if (recipe.mode === "message" && (!recipe.module || !recipe.method)) {
        throw new Error("message mode requires module and method");
    }
    if (recipe.mode === "scene-script" && !recipe.method) {
        throw new Error("scene-script requires method");
    }
}

export function saveRecipe(projectRoot, recipe, { overwrite = false } = {}) {
    validateRecipePayload(recipe);
    ensureDirs(projectRoot);
    const file = recipeFilePath(projectRoot, recipe.name);
    if (!overwrite && fs.existsSync(file)) {
        throw new Error(`recipe already exists: ${recipe.name}`);
    }

    const clean = {
        name: recipe.name,
        description: recipe.description.trim(),
        mode: recipe.mode,
        params: recipe.params ?? {},
    };

    if (recipe.code) {clean.code = recipe.code;}
    if (recipe.module) {clean.module = recipe.module;}
    if (recipe.method) {clean.method = recipe.method;}
    if (recipe.messageType) {clean.messageType = recipe.messageType;}
    if (recipe.args) {clean.args = recipe.args;}
    if (recipe.url) {clean.url = recipe.url;}
    if (recipe.port !== undefined) {clean.port = recipe.port;}
    if (recipe.mode === "scene-script") {
        clean.sceneExtension = recipe.sceneExtension ?? recipe.extensionName ?? "fg-cocosmcp";
    }

    fs.writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`, "utf8");

    const registry = readRegistry(projectRoot);
    const now = new Date().toISOString();
    const prev = registry.recipes?.[recipe.name] ?? {};
    registry.recipes = registry.recipes ?? {};
    registry.recipes[recipe.name] = {
        description: clean.description,
        mode: clean.mode,
        params: clean.params,
        promoted: prev.promoted ?? false,
        toolName: prev.toolName,
        createdAt: prev.createdAt ?? now,
        updatedAt: now,
        useCount: prev.useCount ?? 0,
    };
    writeRegistry(projectRoot, registry);
    return getRecipe(projectRoot, recipe.name);
}

export function deleteRecipe(projectRoot, name) {
    validateRecipeName(name);
    const file = recipeFilePath(projectRoot, name);
    if (fs.existsSync(file)) {fs.unlinkSync(file);}
    const registry = readRegistry(projectRoot);
    if (registry.recipes?.[name]) {
        delete registry.recipes[name];
        writeRegistry(projectRoot, registry);
    }
    return { ok: true, deleted: name };
}

export function buildZodInputSchema(paramsDef = {}) {
    const shape = {};
    for (const [key, def] of Object.entries(paramsDef)) {
        let field;
        switch (def?.type) {
            case "number":
                field = z.number();
                break;
            case "boolean":
                field = z.boolean();
                break;
            case "array":
                field = z.array(z.unknown());
                break;
            case "string":
            default:
                field = z.string();
                break;
        }
        if (def?.optional || def?.default !== undefined) {field = field.optional();}
        if (def?.description) {field = field.describe(def.description);}
        shape[key] = field;
    }
    return shape;
}

function defaultParams(paramsDef = {}, input = {}) {
    const out = { ...input };
    for (const [key, def] of Object.entries(paramsDef)) {
        if (out[key] === undefined && def?.default !== undefined) {out[key] = def.default;}
    }
    return out;
}

function injectParamsIntoCode(code, params) {
    const prelude = Object.entries(params)
        .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
        .join("\n");
    return `${prelude}\n${code}`;
}

export function buildRecipeExecBody(recipe, params = {}) {
    const resolved = defaultParams(recipe.params, params);
    if (recipe.mode === "message") {
        return {
            mode: "message",
            module: recipe.module,
            method: recipe.method,
            args: recipe.args ?? [],
            messageType: recipe.messageType ?? "request",
        };
    }
    if (recipe.mode === "scene-script") {
        return {
            mode: "scene-script",
            name: recipe.sceneExtension ?? recipe.extensionName ?? "fg-cocosmcp",
            method: recipe.method,
            args: recipe.args ?? [],
        };
    }
    if (recipe.mode === "open-url") {
        return {
            mode: "open-url",
            url: resolved.url ?? recipe.url,
            port: resolved.port ?? recipe.port,
        };
    }
    const code = injectParamsIntoCode(recipe.code, resolved);
    return {
        mode: recipe.mode,
        code,
    };
}

export async function executeCreatorBody(fetchCreatorBridge, body) {
    const health = await fetchCreatorBridge("/health");
    if (!health.ok) {
        return {
            ok: false,
            error: "Creator bridge not reachable",
            health,
        };
    }
    const exec = await fetchCreatorBridge("/exec", "POST", body);
    return {
        ok: exec.ok && exec.body?.ok !== false,
        status: exec.status,
        ...exec.body,
    };
}

export async function runRecipe(projectRoot, recipeName, params, fetchCreatorBridge) {
    const recipe = getRecipe(projectRoot, recipeName);
    if (!recipe || recipe.error) {
        return { ok: false, error: `recipe not found: ${recipeName}` };
    }
    const body = buildRecipeExecBody(recipe, params);
    const started = Date.now();
    const result = await executeCreatorBody(fetchCreatorBridge, body);
    appendExecAudit(projectRoot, {
        source: "recipe",
        recipeName,
        mode: recipe.mode,
        params,
        ok: result.ok,
        durationMs: Date.now() - started,
        error: result.error,
        resultPreview: summarizeValue(result.result ?? result),
    });

    const registry = readRegistry(projectRoot);
    if (registry.recipes?.[recipeName]) {
        registry.recipes[recipeName].useCount = (registry.recipes[recipeName].useCount ?? 0) + 1;
        registry.recipes[recipeName].updatedAt = new Date().toISOString();
        writeRegistry(projectRoot, registry);
    }

    return { recipeName, request: body, ...result };
}

const promotedHandles = new Map();

export function registerPromotedRecipeTool(server, projectRoot, recipeName, fetchCreatorBridge, { toolName } = {}) {
    const recipe = getRecipe(projectRoot, recipeName);
    if (!recipe || recipe.error) {
        throw new Error(`recipe not found: ${recipeName}`);
    }

    const finalToolName = promotedToolName(recipeName, toolName);

    if (promotedHandles.has(finalToolName)) {
        throw new Error(`tool already promoted: ${finalToolName}`);
    }

    const inputSchema = buildZodInputSchema(recipe.params);
    const handle = server.registerTool(
        finalToolName,
        {
            description: `[recipe:${recipeName}] ${recipe.description}`,
            inputSchema,
        },
        async (params) => {
            const result = await runRecipe(projectRoot, recipeName, params ?? {}, fetchCreatorBridge);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                isError: !result.ok,
            };
        },
    );

    promotedHandles.set(finalToolName, handle);

    const registry = readRegistry(projectRoot);
    registry.recipes = registry.recipes ?? {};
    registry.recipes[recipeName] = {
        ...(registry.recipes[recipeName] ?? {}),
        promoted: true,
        toolName: finalToolName,
        updatedAt: new Date().toISOString(),
    };
    writeRegistry(projectRoot, registry);

    return { ok: true, recipeName, toolName: finalToolName, promoted: true };
}

export function demotePromotedRecipeTool(server, projectRoot, recipeName) {
    const registry = readRegistry(projectRoot);
    const meta = registry.recipes?.[recipeName];
    if (!meta?.promoted) {
        return { ok: false, error: `recipe not promoted: ${recipeName}` };
    }

    const toolName = meta.toolName ?? promotedToolName(recipeName);
    const handle = promotedHandles.get(toolName);
    if (handle) {
        handle.remove();
        promotedHandles.delete(toolName);
    }

    meta.promoted = false;
    meta.toolName = undefined;
    meta.updatedAt = new Date().toISOString();
    writeRegistry(projectRoot, registry);
    return { ok: true, recipeName, toolName, promoted: false };
}

export function loadPromotedRecipesOnStartup(server, projectRoot, fetchCreatorBridge) {
    const registry = readRegistry(projectRoot);
    const restored = [];
    const failed = [];
    for (const [name, meta] of Object.entries(registry.recipes ?? {})) {
        if (!meta.promoted) {continue;}
        try {
            const r = registerPromotedRecipeTool(server, projectRoot, name, fetchCreatorBridge, {
                toolName: meta.toolName,
            });
            restored.push(r.toolName);
        } catch (e) {
            failed.push({ name, error: String(e) });
        }
    }
    return { restored, failed };
}

export function buildExecAuditEntry(request, result, startedMs, extra = {}) {
    const code = request.code ?? "";
    return {
        source: extra.source ?? "exec",
        recipeName: extra.recipeName,
        mode: request.mode,
        module: request.module,
        method: request.method,
        name: request.name,
        codeHash: code ? hashText(code) : undefined,
        codePreview: code ? code.slice(0, 300) : undefined,
        ok: result.ok,
        durationMs: Date.now() - startedMs,
        error: result.error,
        resultPreview: summarizeValue(result.result ?? result),
    };
}
