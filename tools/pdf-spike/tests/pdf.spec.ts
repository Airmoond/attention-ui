import { test, expect, type Page } from "@playwright/test"
import path from "node:path"
const fixture = (name: string): string => path.resolve("fixtures", name)
test.beforeEach(async ({ page }) => { await page.goto("/") })
async function open(page: Page, name: string): Promise<void> {
  await page.getByLabel("打开本地 PDF").setInputFiles(fixture(name))
}
async function selectByDrag(page: Page, text: string): Promise<void> {
  const span = page.locator("#text-layer span").filter({ hasText: text })
  expect(await span.count()).toBe(1)
  const box = await span.boundingBox()
  if (!box) throw new Error("Text span not visible")
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + Math.min(160, box.width - 2), box.y + box.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator("#selection")).not.toBeEmpty()
}
for (let number = 1; number <= 10; number++) {
  test("text fixture " + number + " renders all 3 pages", async ({ page }) => {
    await open(page, "sample-" + String(number).padStart(2, "0") + ".pdf")
    for (let p = 1; p <= 3; p++) {
      await expect(page.getByRole("status")).toContainText("第 " + p + " / 3 页 · 可选择文字")
      await expect(page.locator("#surface")).toHaveAttribute("data-page", String(p))
      await expect(page.locator("#text-layer")).toContainText(number <= 5 ? "本页锚点" : "Page anchor")
      expect(await page.locator("#canvas").evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext("2d")
        if (!ctx) return 0
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let ink = 0
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! < 180 && pixels[i + 3]! > 0) ink++
        return ink
      })).toBeGreaterThan(500)
      if (p < 3) await page.getByRole("button", { name: "下一页", exact: true }).click()
    }
  })
}
test("native selection after zoom keeps source page and returns to it", async ({ page }) => {
  await open(page, "sample-03.pdf")
  await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  await page.getByRole("button", { name: "下一页", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("第 2 / 3 页")
  await page.getByLabel("缩放").selectOption("1.5")
  await expect(page.getByLabel("缩放")).toBeEnabled()
  await selectByDrag(page, "本页锚点")
  await expect(page.locator("#selection-page")).toHaveText("来源：第 2 页")
  await page.getByRole("button", { name: "记录此片段" }).click()
  await page.screenshot({ path: "test-results/chinese-selection.png", fullPage: true })
  await page.getByRole("button", { name: "下一页", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("第 3 / 3 页")
  await page.getByRole("button", { name: "返回来源页" }).click()
  await expect(page.getByRole("status")).toContainText("第 2 / 3 页")
  await expect(page.locator("#saved-page")).toHaveText("来源：第 2 页")
})
test("English columns allow selection without adjoining column", async ({ page }) => {
  await open(page, "sample-08.pdf")
  await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  const span = page.locator("#text-layer span").filter({ hasText: "Column 1:" })
  // This sentence occurs in three paragraphs; select the first documented paragraph.
  expect(await span.count()).toBe(3)
  const box = await span.nth(0).boundingBox()
  if (!box) throw new Error("Column missing")
  await page.mouse.move(box.x + 1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + Math.min(170, box.width - 1), box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator("#selection")).toContainText("Column 1")
  await expect(page.locator("#selection")).not.toContainText("Column 2")
  await page.screenshot({ path: "test-results/english-columns.png", fullPage: true })
})
test("opening and navigating sends no requests outside local assets", async ({ page }) => {
  const external: string[] = []
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.hostname !== "127.0.0.1") { external.push(url.origin); return route.abort() }
    return route.continue()
  })
  await open(page, "sample-01.pdf")
  await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  await page.getByRole("button", { name: "下一页", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("第 2 / 3 页")
  expect(external).toEqual([])
})
test("image-only page is readable but not reported as selectable text", async ({ page }) => {
  await open(page, "scanned.pdf")
  await expect(page.getByRole("status")).toContainText("暂不支持扫描件 OCR")
  await expect(page.locator("#text-layer")).toBeEmpty()
})
for (const [name, message] of [
  ["encrypted.pdf", "加密 PDF 暂不支持"],
  ["corrupt.pdf", "PDF 无法读取"],
  ["too-many-pages.pdf", "文档超过 120 页"]
]) {
  test("reject " + name, async ({ page }) => {
    await open(page, name!)
    await expect(page.getByRole("status")).toContainText(message!)
    await open(page, "sample-06.pdf")
    await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  })
}
test("reject files over size cap before parsing", async ({ page }) => {
  await page.getByLabel("打开本地 PDF").setInputFiles({ name: "large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) })
  await expect(page.getByRole("status")).toContainText("文件超过 20 MB")
})
test("reject non-PDF contents", async ({ page }) => {
  await page.getByLabel("打开本地 PDF").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") })
  await expect(page.getByRole("status")).toContainText("文件不是有效 PDF")
})
test("close and switch clears excerpt and supports repeated opening", async ({ page }) => {
  await open(page, "sample-01.pdf")
  await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  await selectByDrag(page, "本页锚点")
  await page.getByRole("button", { name: "记录此片段" }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "关闭文档" }).click()
    await expect(page.getByRole("status")).toContainText("文档已关闭")
    await expect(page.locator("#saved")).toBeHidden()
    await expect(page.locator("#selection")).toBeEmpty()
    await open(page, "sample-06.pdf")
    await expect(page.getByRole("status")).toContainText("第 1 / 3 页")
  }
})
