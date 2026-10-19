import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws outside the Next.js server bundle; tests run in Node.
  "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "emulator",
          environment: "node",
          include: ["tests/rules/**/*.test.ts", "tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup-emulator.ts"],
          // Tests share one emulator instance; run files sequentially.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
