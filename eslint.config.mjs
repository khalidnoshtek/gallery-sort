import next from "eslint-config-next";

export default [
  ...next,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "node:fs/promises",
              importNames: ["unlink", "rm", "rmdir", "rename"],
              message:
                "Destructive FS calls must go through src/lib/safe-ops/. See ARCHITECTURE.md §6.",
            },
            {
              name: "fs/promises",
              importNames: ["unlink", "rm", "rmdir", "rename"],
              message:
                "Destructive FS calls must go through src/lib/safe-ops/. See ARCHITECTURE.md §6.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/safe-ops/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];
