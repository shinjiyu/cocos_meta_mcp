/** "3.8.8" → "cc388" */
export function cocosVersionSlug(version) {
    if (!version || version === "unknown") {return "unknown";}
    const parts = String(version)
        .replace(/^[^\d]*/, "")
        .split(".")
        .filter(Boolean);
    if (!parts.length) {return "unknown";}
    return `cc${parts.join("")}`;
}

/** cocosmcp_genbot_generate + cc388 → cocosmcp_cc388_genbot_generate（仅插件 tool） */
export function versionedToolName(versionSlug, baseName) {
    if (!baseName.startsWith("cocosmcp_")) {
        return `cocosmcp_${versionSlug}_${baseName}`;
    }
    const rest = baseName.slice("cocosmcp_".length);
    if (rest.startsWith(`${versionSlug}_`)) {return baseName;}
    return `cocosmcp_${versionSlug}_${rest}`;
}

/** recipe 提升：不带 Cocos 版本，默认 cocosmcp_r_{name} */
export function promotedRecipeToolName(recipeName, customToolName) {
    if (customToolName?.trim()) {return customToolName.trim();}
    return `cocosmcp_r_${recipeName}`;
}
