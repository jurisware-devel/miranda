import {
    defineConfig,
    globalIgnores
} from "eslint/config";

import globals from "globals";

import {
    fixupConfigRules,
} from "@eslint/compat";

import tsParser from "@typescript-eslint/parser";
import reactRefresh from "eslint-plugin-react-refresh";
import js from "@eslint/js";

import {
    FlatCompat,
} from "@eslint/eslintrc";

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tsParser,
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
    )),

    plugins: {
        "react-refresh": reactRefresh,
    },

    rules: {
        "react-refresh/only-export-components": ["warn", {
            allowConstantExport: true,
        }],
    },
}, {
    files: [
        "src/shards/public/**/*.{ts,tsx}",
        "src/components/App*.tsx",
        "src/components/Public*.tsx",
        "src/components/Case*.tsx",
        "src/components/TagCapsule.tsx",
        "src/components/ProfileMenu.tsx",
        "src/layers/Case*.tsx",
    ],
    rules: {
        "no-restricted-imports": ["error", {
            patterns: [
                "**/shards/sub/**",
                "**/shards/admin/**",
                "**/logic/**",
                "**/components/Sub*",
                "**/components/Admin*",
                "**/layers/Sub*",
                "**/layers/Admin*",
            ],
        }],
    },
}, {
    files: [
        "src/shards/sub/**/*.{ts,tsx}",
        "src/components/Sub*.tsx",
        "src/layers/Sub*.tsx",
    ],
    rules: {
        "no-restricted-imports": ["error", {
            patterns: [
                "**/shards/public/**",
                "**/shards/admin/**",
                "**/logic/**",
                "**/components/App*",
                "**/components/Public*",
                "**/components/Case*",
                "**/components/TagCapsule",
                "**/components/ProfileMenu",
                "**/components/Admin*",
                "**/layers/Case*",
                "**/layers/Admin*",
            ],
        }],
    },
}, {
    files: [
        "src/shards/admin/**/*.{ts,tsx}",
        "src/components/Admin*.tsx",
    ],
    rules: {
        "no-restricted-imports": ["error", {
            patterns: [
                "**/shards/public/**",
                "**/shards/sub/**",
                "**/logic/**",
                "**/components/Sub*",
                "**/components/App*",
                "**/components/Public*",
                "**/layers/Sub*",
                "**/layers/Case*",
            ],
        }],
    },
}, {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
        "no-restricted-imports": ["error", {
            patterns: [
                "**/shards/**",
                "**/components/**",
                "**/layers/**",
                "**/pages/**",
                "**/logic/hooks/**",
            ],
        }],
    },
}, {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
        globals: {
            ...globals.node,
        },
    },
}, globalIgnores(["**/dist", "**/.amplify/**"])]);
