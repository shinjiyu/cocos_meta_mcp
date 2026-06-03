import { pluginInstallUsage, runPluginInstallCli } from "../scripts/lib/plugin-install.mjs";

export function runPluginCli(argv) {
    if (argv[0] === "-h" || argv[0] === "--help") {
        console.error(pluginInstallUsage());
        process.exit(0);
    }
    runPluginInstallCli(argv);
}
