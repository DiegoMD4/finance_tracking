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
          include: [
            "server/**/*.test.ts",
            "tests/integration/**/*.spec.ts",
            "tests/unit/**/*.spec.ts",
          ],
          setupFiles: ["tests/setup/db.ts"],
          // Los tests de integración comparten una única base MySQL real y
          // truncan las mismas tablas en beforeEach, así que no pueden
          // ejecutarse en paralelo entre archivos.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["app/**/*.test.tsx", "components/**/*.test.tsx"],
          setupFiles: ["tests/setup/vitest.setup.ts"],
        },
      },
    ],
  },
})
