import { chromium } from "@playwright/test"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
const root = path.resolve("../..")
const catalog = JSON.parse((await readFile(path.join(root, "docs/validation/v0.2-catalog.json"), "utf8")).replace(/^\uFEFF/, "")) as { web: Array<{id: string; site: string; title: string; url: string}> }
const browser = await chromium.launch({ channel: "chrome", headless: true })
const results: object[] = []
try {
  for (const sample of catalog.web) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const started = Date.now()
    try {
      const response = await page.goto(sample.url, { waitUntil: "domcontentloaded", timeout: 12_000 })
      const title = await page.title()
      const denied = /验证|验证码|安全检查|captcha|access denied|security check/i.test(title)
      const headings = denied ? [] : await page.locator("h1").allTextContents()
      const code = response?.status() ?? null
      results.push({ id: sample.id, requestedUrl: sample.url, finalUrl: page.url(), httpStatus: code,
        title, headings: headings.map(s => s.trim()).filter(Boolean).slice(0, 3),
        state: denied ? "access-challenge-not-bypassed" : code !== null && code >= 400 ? "http-error" : headings.length ? "page-loaded-extension-not-tested" : "needs-manual-review",
        durationMs: Date.now() - started })
      console.log(sample.id + " " + code + " " + title.slice(0, 50))
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "Unknown navigation error"
      results.push({id: sample.id, requestedUrl: sample.url, state: "navigation-failed", error: message, durationMs: Date.now() - started})
      console.log(sample.id + " navigation-failed")
    } finally { await context.close() }
  }
} finally { await browser.close() }
await writeFile(path.join(root, "docs/validation/v0.2-web-observations.json"), JSON.stringify({checkedAt: new Date().toISOString(), purpose:"Read-only page accessibility; not AttentionUI compatibility acceptance", results}, null, 2) + "\n")
