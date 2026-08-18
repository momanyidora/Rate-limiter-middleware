import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],

    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    coverage: {
      reporter: ["text", "html"],
    },
  },
});
