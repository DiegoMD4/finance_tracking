import { defineConfig, devices } from "@playwright/test"
import { loadEnvFile } from "node:process"

loadEnvFile(".env.test.local")
/**
 * Simula la base de datos caída apuntando a un puerto cerrado
 * (ECONNREFUSED inmediato) y corriendo la app en un puerto aparte.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/maintenance.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Google Chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run start -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "mysql://user:pass@127.0.0.1:3307/nonexistent",
      JWT_SECRET: process.env.JWT_SECRET ?? "",
    },
  },
})