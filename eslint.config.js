import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const mcpStrictRules = {
    eqeqeq: ["error", "always"],
    "no-var": "error",
    "prefer-const": "error",
    curly: ["error", "all"],
    "no-throw-literal": "error",
    "prefer-promise-reject-errors": "error",
    "no-console": "off",
    "no-unused-vars": [
        "error",
        {
            argsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        },
    ],
};

export default tseslint.config(
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "mcp/plugins/genbot/**",
            "mcp/genbot-runner.mjs",
            "mcp/plugins/candystorm-ir/**",
        ],
    },
    js.configs.recommended,
    {
        files: ["mcp/**/*.mjs", "scripts/**/*.mjs", "bin/**/*.mjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node,
            parserOptions: {
                ecmaFeatures: {
                    importAttributes: true,
                },
            },
        },
        rules: mcpStrictRules,
    },
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
        ...config,
        files: ["extension/source/**/*.ts"],
    })),
    {
        files: ["extension/source/**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-redundant-type-constituents": "off",
            "@typescript-eslint/restrict-plus-operands": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-confusing-void-expression": "off",
            "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-unnecessary-condition": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
);
