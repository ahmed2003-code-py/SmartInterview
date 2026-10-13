import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    // Integration tests share one local database; run files one after another.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
