import { test, expect, type Page, type Locator } from "@playwright/test"
import path from "node:path"
const fixture = (name: string): string => path.resolve("fixtures", name)
const paper = (page: Page, number: number): Locator => page.locator('.pdf-page[data-page="' + number + '"]')
test.beforeEach(async ({ page }) => { await page.goto("/") })
async function open(page: Page, name: string): Promise<void> {
  await page.getByLabel("打开本地 PDF").setInputFiles(fixture(name))
}
async function jump(page: Page, number: number): Promise<void> {
  await page.getByLabel("页码", { exact: true }).fill(String(number))
  await page.getByLabel("页码", { exact: true }).press("Enter")
  await expect(paper(page, number)).toHaveAttribute("data-state", "ready")
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 " + number + " / 3 页")
}
async function selectByDrag(page: Page, text: string, number = 1): Promise<void> {
  const span = paper(page, number).locator(".textLayer span").filter({ hasText: text })
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
    await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
    await expect(page.locator(".pdf-page")).toHaveCount(3)
    for (let p = 1; p <= 3; p++) {
      await jump(page, p)
      await expect(paper(page, p).locator(".textLayer")).toContainText(number <= 5 ? "本页锚点" : "Page anchor")
      expect(await paper(page, p).locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext("2d")
        if (!ctx) return 0
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let ink = 0
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! < 180 && pixels[i + 3]! > 0) ink++
        return ink
      })).toBeGreaterThan(500)
    }
  })
}
test("zoom buttons keep source page and return to it", async ({ page }) => {
  await open(page, "sample-03.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await jump(page, 2)
  await page.getByRole("button", { name: "放大", exact: true }).click()
  await page.getByRole("button", { name: "放大", exact: true }).click()
  await expect(page.getByLabel("缩放比例")).toHaveText("150%")
  await expect(paper(page, 2)).toHaveAttribute("data-state", "ready")
  await selectByDrag(page, "本页锚点", 2)
  await expect(page.locator("#selection-page")).toHaveText("来源：第 2 页")
  await page.getByRole("button", { name: "记录此片段" }).click()
  await page.screenshot({ path: "test-results/chinese-selection.png" })
  await jump(page, 3)
  await page.getByRole("button", { name: "返回来源页" }).click()
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 2 / 3 页")
  await expect(page.locator("#saved-page")).toHaveText("来源：第 2 页")
  await page.getByRole("button", { name: "缩小", exact: true }).click()
  await expect(page.getByLabel("缩放比例")).toHaveText("125%")
})
test("English columns allow selection without adjoining column", async ({ page }) => {
  await open(page, "sample-08.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  const span = paper(page, 1).locator(".textLayer span").filter({ hasText: "Column 1:" })
  expect(await span.count()).toBe(3)
  const box = await span.nth(0).boundingBox()
  if (!box) throw new Error("Column missing")
  await page.mouse.move(box.x + 1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + Math.min(170, box.width - 1), box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator("#selection")).toContainText("Column 1")
  await expect(page.locator("#selection")).not.toContainText("Column 2")
  await page.screenshot({ path: "test-results/english-columns.png" })
})
test("opening and navigating sends no requests outside local assets", async ({ page }) => {
  const external: string[] = []
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.hostname !== "127.0.0.1") { external.push(url.origin); return route.abort() }
    return route.continue()
  })
  await open(page, "sample-01.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await jump(page, 2)
  expect(external).toEqual([])
})
test("image-only page is readable but not reported as selectable text", async ({ page }) => {
  await open(page, "scanned.pdf")
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("暂不支持扫描件 OCR")
  await expect(paper(page, 1).locator(".textLayer")).toBeEmpty()
})
for (const [name, message] of [
  ["encrypted.pdf", "加密 PDF 暂不支持"], ["corrupt.pdf", "PDF 无法读取"], ["too-many-pages.pdf", "文档超过 120 页"]
]) {
  test("reject " + name, async ({ page }) => {
    await open(page, name!)
    await expect(page.getByRole("status", { name: "阅读状态" })).toContainText(message!)
    await open(page, "sample-06.pdf")
    await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  })
}
test("reject files over size cap before parsing", async ({ page }) => {
  await page.getByLabel("打开本地 PDF").setInputFiles({ name: "large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(20 * 1024 * 1024 + 1) })
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("文件超过 20 MB")
})
test("reject non-PDF contents", async ({ page }) => {
  await page.getByLabel("打开本地 PDF").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") })
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("文件不是有效 PDF")
})
test("close clears excerpt and supports repeated opening", async ({ page }) => {
  await open(page, "sample-01.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await selectByDrag(page, "本页锚点")
  await page.getByRole("button", { name: "记录此片段" }).click()
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "关闭文档" }).click()
    await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("文档已关闭")
    await expect(page.locator("#saved")).toBeHidden()
    await expect(page.locator("#selection")).toBeEmpty()
    await expect(page.locator(".pdf-page")).toHaveCount(0)
    await open(page, "sample-06.pdf")
    await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  }
})
test("wheel outside the paper scrolls continuously and updates page number", async ({ page }) => {
  await open(page, "sample-06.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  const before = await paper(page, 1).boundingBox()
  await page.mouse.move(8, 450)
  await page.mouse.wheel(0, 880)
  await expect.poll(async () => (await paper(page, 1).boundingBox())!.y).toBeLessThan(before!.y - 700)
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 2 / 3 页")
  expect(await page.locator("#viewport").evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1)
  await expect(page.getByRole("button", { name: "网页全屏", exact: true })).toBeInViewport()
})
test("web fullscreen keeps sidebar, has direct zoom and exits with Escape", async ({ page }) => {
  await open(page, "sample-06.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await jump(page, 2)
  await page.getByRole("button", { name: "网页全屏", exact: true }).click()
  await expect(page.locator("header")).toBeHidden()
  await expect(page.getByRole("complementary", { name: "片段验证" })).toBeInViewport()
  await expect(page.getByRole("button", { name: "退出网页全屏" })).toHaveAttribute("aria-pressed", "true")
  expect((await page.locator("main").boundingBox())!.width).toBe(1320)
  await page.getByRole("button", { name: "适合宽度" }).click()
  await expect(paper(page, 2)).toHaveAttribute("data-state", "ready")
  expect(await page.locator("#viewport").evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2)
  await page.screenshot({ path: "test-results/continuous-fullscreen.png" })
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "网页全屏", exact: true })).toHaveAttribute("aria-pressed", "false")
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 2 / 3 页")
})
test("native drag across page boundary records both pages and returns to start", async ({ page }) => {
  await open(page, "sample-06.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await expect(paper(page, 2)).toHaveAttribute("data-state", "ready")
  const start = paper(page, 1).locator(".textLayer span").filter({ hasText: "FocusUI original fixture" })
  const end = paper(page, 2).locator(".textLayer span").filter({ hasText: "Page anchor:" })
  expect(await start.count()).toBe(1)
  expect(await end.count()).toBe(1)
  const initial = await start.boundingBox()
  await page.mouse.move(8, 400)
  await page.mouse.wheel(0, initial!.y - 420)
  await expect.poll(async () => (await start.boundingBox())!.y).toBeLessThan(500)
  const a = await start.boundingBox()
  const b = await end.boundingBox()
  await page.mouse.move(a!.x + 1, a!.y + a!.height / 2)
  await page.mouse.down()
  await page.mouse.move(b!.x + b!.width - 1, b!.y + b!.height / 2, { steps: 20 })
  await page.mouse.up()
  await expect(page.locator("#selection-page")).toHaveText("来源：第 1–2 页")
  await expect(page.locator("#selection")).toContainText("FocusUI original fixture")
  await expect(page.locator("#selection")).toContainText("Page anchor")
  await expect(page.locator("#selection")).not.toContainText("正在准备")
  await page.getByRole("button", { name: "记录此片段" }).click()
  await expect(page.locator("#saved-page")).toHaveText("来源：第 1–2 页")
  await page.screenshot({ path: "test-results/cross-page-selection.png" })
  await jump(page, 3)
  await page.getByRole("button", { name: "返回来源页" }).click()
  await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 1 / 3 页")
})
test("rapid zoom and file replacement cannot restore old pages", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await open(page, "sample-01.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await page.getByRole("button", { name: "放大", exact: true }).click({ clickCount: 3, delay: 30 })
  await open(page, "sample-06.pdf")
  await expect(paper(page, 1)).toHaveAttribute("data-state", "ready")
  await expect(paper(page, 1).locator(".textLayer")).toContainText("Study notes P06")
  await expect(page.locator("#pages")).not.toContainText("学习资料")
  expect(errors).toEqual([])
})
test("long document bounds live canvases and redraws pages on return", async ({ page }) => {
  await open(page, "continuous.pdf")
  await expect(page.locator(".pdf-page")).toHaveCount(12)
  for (const number of [1, 6, 12, 1]) {
    await page.getByLabel("页码", { exact: true }).fill(String(number))
    await page.getByLabel("页码", { exact: true }).press("Enter")
    await expect(paper(page, number)).toHaveAttribute("data-state", "ready")
    await expect(page.getByRole("status", { name: "阅读状态" })).toContainText("第 " + number + " / 12 页")
    await expect.poll(() => page.locator(".pdf-page canvas").evaluateAll(nodes =>
      nodes.filter(node => (node as HTMLCanvasElement).width > 0).length
    )).toBeLessThanOrEqual(5)
    await expect(paper(page, number).locator(".textLayer")).toContainText("Study notes P06")
  }
})
