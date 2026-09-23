import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests", workers: 1, timeout: 30_000, fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { baseURL: "http://127.0.0.1:4179", browserName: "chromium",
    channel: "chrome", headless: true, viewport: { width: 1320, height: 950 },
    screenshot: "only-on-failure" },
  webServer: { command: "npm run dev -- --port 4179", url: "http://127.0.0.1:4179", reuseExistingServer: false, timeout: 30_000 }
})
