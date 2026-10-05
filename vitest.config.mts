import { configDefaults, defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    pool: "threads",
    exclude: [...configDefaults.exclude, ".agents/**", "tests/e2e/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "tests/integration/**/*.spec.ts"],
          setupFiles: ["tests/setup/db.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["app/**/*.test.tsx"],
          setupFiles: ["tests/setup/vitest.setup.ts"],
        },
      },
    ],
  },
})
