import fs from "node:fs";
import path from "node:path";

/** 写入 Creator 可识别的 package.json（去掉 $schema / devDependencies 等） */
export function sanitizeExtensionPackage(manifest) {
    const editor = manifest.editor ?? ">=3.8.0";
    return {
        package_version: manifest.package_version ?? 2,
        name: manifest.name,
        version: manifest.version ?? "1.0.0",
        title: manifest.title ?? manifest.name,
        description: manifest.description ?? "",
        author: manifest.author ?? "cocos-meta-mcp",
        editor,
        main: manifest.main ?? "./dist/main.js",
        contributions: manifest.contributions ?? {},
    };
}

export function writeInstalledPackageJson(destDir, manifest) {
    const clean = sanitizeExtensionPackage(manifest);
    fs.writeFileSync(path.join(destDir, "package.json"), `${JSON.stringify(clean, null, 4)}\n`, "utf8");
    return clean;
}

export function validateExtensionInstall(destDir) {
    const issues = [];
    const pkgFile = path.join(destDir, "package.json");
    const mainJs = path.join(destDir, "dist", "main.js");
    const sceneJs = path.join(destDir, "dist", "scene.js");

    if (!fs.existsSync(pkgFile)) {
        issues.push("missing package.json");
    } else {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
            if (pkg.package_version !== 2) {
                issues.push(`package_version should be 2, got ${pkg.package_version}`);
            }
            if (!pkg.name) {
                issues.push("package.json missing name");
            }
            if (path.basename(destDir) !== pkg.name) {
                issues.push(`folder name must match package name: ${path.basename(destDir)} != ${pkg.name}`);
            }
            if (pkg.$schema) {
                issues.push("$schema should be removed from installed package.json");
            }
        } catch (e) {
            issues.push(`invalid package.json: ${e}`);
        }
    }
    if (!fs.existsSync(mainJs)) {
        issues.push("missing dist/main.js — run npm run build:extension");
    }
    if (!fs.existsSync(sceneJs)) {
        issues.push("missing dist/scene.js");
    }
    return issues;
}
