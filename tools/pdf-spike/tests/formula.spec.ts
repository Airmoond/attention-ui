import { test, expect, type Page } from "@playwright/test"

function fixture(): Buffer {
  // Original two-page mixed text sample. Standard Symbol font supplies alpha;
  // no third-party PDF, model result or font file is embedded in the repository.
  const stream = "BT /F1 16 Tf 40 680 Td (Before ) Tj /F2 16 Tf (a) Tj /F1 16 Tf ( after.) Tj ET"
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => { pdf += String(offset).padStart(10, "0") + " 00000 n \n" })
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}
async function open(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("#file").setInputFiles({ name: "mixed.pdf", mimeType: "application/pdf", buffer: fixture() })
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute("data-state", "ready")
}
async function select(page: Page, number = 1): Promise<void> {
  const spans = page.locator(`.pdf-page[data-page="${number}"] .textLayer span`)
  const start = spans.filter({ hasText: "Before" })
  await start.scrollIntoViewIfNeeded()
  const a = (await start.boundingBox())!
  const end = (await spans.filter({ hasText: "after." }).boundingBox())!
  await page.mouse.move(a.x + 1, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width - 1, end.y + end.height / 2, { steps: 25 })
  await page.mouse.up()
  await expect(page.locator("#recognize-formulas")).toBeEnabled()
}

test("mixed selection keeps text and formula image in original order without automatic OCR", async ({ page }) => {
  const calls: string[] = []
  page.on("request", request => { if (request.url().includes("/__formula/")) calls.push(request.url()) })
  await open(page)
  await select(page)
  await expect(page.locator("#formula-preview img")).toHaveCount(1)
  expect(await page.locator("#formula-preview").evaluate(node => Array.from(node.childNodes).map(n =>
    n instanceof HTMLImageElement ? "FORMULA" : n.textContent).join(""))).toMatch(/Before.*FORMULA.*after/s)
  expect(calls).toEqual([])
  await page.locator("#pin").click()
  await expect(page.locator(".saved-mixed img")).toHaveCount(1)
  await page.mouse.click(8, 400)
  await expect(page.locator("#formula-panel")).toBeHidden()
  await expect(page.locator(".saved-mixed img")).toHaveCount(1)
  await page.locator("#close").click()
  await expect(page.locator(".saved-mixed")).toHaveCount(0)
})

test("structured OCR result fills only formula slots and stale replies cannot restore a cleared selection", async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/__formula/recognize", async route => {
    await gate
    await route.fulfill({ json: { results: [{ latex: "\\alpha", seconds: 0.1 }] } })
  })
  await open(page)
  await select(page)
  const requested = page.waitForRequest("**/__formula/recognize")
  await page.locator("#recognize-formulas").click()
  await requested
  await page.mouse.click(8, 400)
  release()
  await expect(page.locator("#formula-panel")).toBeHidden()
  await expect(page.locator("#formula-results textarea")).toHaveCount(0)
  await select(page)
  await page.locator("#recognize-formulas").click()
  await expect(page.locator("#formula-results textarea")).toHaveValue("\\alpha")
  await page.locator("#pin").click()
  await expect(page.locator("#saved-text")).toContainText("Before")
  await expect(page.locator("#saved-text")).toContainText("\\(\\alpha\\)")
  await expect(page.locator("#saved-text")).toContainText("after")
})

test("formula endpoint rejects missing token, remote origin and invalid images", async ({ request }) => {
  expect((await request.post("/__formula/recognize", { data: { images: [] } })).status()).toBe(401)
  expect((await request.get("/__formula/session", { headers: { Origin: "https://example.com" } })).status()).toBe(403)
  const { token } = await (await request.get("/__formula/session")).json()
  expect((await request.post("/__formula/recognize", { headers: { "X-Formula-Token": token }, data: { images: ["https://example.com/x.png"] } })).status()).toBe(400)
})

test("real offline OCR on supplied lecture preserves prose and recognizes the density fraction", async ({ page }) => {
  test.setTimeout(120_000)
  const local = process.env.FOCUSUI_TEST_PDF
  test.skip(!local || !process.env.FOCUSUI_TEST_OCR, "Optional real local OCR acceptance; no model downloads during tests")
  await page.goto("/")
  await page.locator("#file").setInputFiles(local!)
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute("data-state", "ready")
  await page.locator("#page").fill("6")
  await page.locator("#page").press("Enter")
  await expect(page.locator('.pdf-page[data-page="6"]')).toHaveAttribute("data-state", "ready")
  const spans = page.locator('.pdf-page[data-page="6"] .textLayer span')
  const a = (await spans.filter({ hasText: "We assume" }).boundingBox())!
  const b = (await spans.filter({ hasText: "Hence, the conditional" }).boundingBox())!
  await page.mouse.move(a.x + 1, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2, { steps: 35 })
  await page.mouse.up()
  await expect(page.locator("#recognize-formulas")).toBeEnabled()
  await expect(page.locator("#formula-preview img")).toHaveCount(5)
  await page.locator("#recognize-formulas").click()
  await expect(page.locator("#copy-mixed")).toBeEnabled({ timeout: 90_000 })
  const values = await page.locator("#formula-results textarea").evaluateAll(nodes => nodes.map(n => (n as HTMLTextAreaElement).value))
  expect(values).toContain("f(\\epsilon)=\\frac{1}{\\sqrt{2\\pi}\\sigma}\\exp\\left(-\\frac{\\epsilon^{2}}{2\\sigma^{2}}\\right)")
  await expect(page.locator("#formula-preview")).toContainText("We assume")
  await expect(page.locator("#formula-preview")).toContainText("Hence")
  await page.screenshot({ path: "test-results/mixed-formula-ocr.png" })
})


test("mixed selection across pages preserves page order and formula origins", async ({ page }) => {
  await open(page)
  await page.locator("#zoom-out").click()
  await page.locator("#zoom-out").click()
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute("data-state", "ready")
  await expect(page.locator('.pdf-page[data-page="2"]')).toHaveAttribute("data-state", "ready")
  const a = (await page.locator('.pdf-page[data-page="1"] .textLayer span').filter({ hasText: "Before" }).boundingBox())!
  const b = (await page.locator('.pdf-page[data-page="2"] .textLayer span').filter({ hasText: "after." }).boundingBox())!
  await page.mouse.move(a.x + 0.2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width - 0.2, b.y + b.height / 2, { steps: 30 })
  await page.mouse.up()
  await expect(page.locator("#recognize-formulas")).toBeEnabled()
  await expect(page.locator("#formula-preview img")).toHaveCount(2)
  await expect(page.locator("#formula-preview img").nth(0)).toHaveAttribute("alt", "第 1 页公式原图")
  await expect(page.locator("#formula-preview img").nth(1)).toHaveAttribute("alt", "第 2 页公式原图")
  await expect(page.locator("#selection-page")).toHaveText("来源：第 1–2 页")
})

test("failed or malformed OCR leaves source images and offers retry without exporting a result", async ({ page }) => {
  await page.route("**/__formula/recognize", route => route.fulfill({ json: { results: [{ latex: "", seconds: 0 }] } }))
  await open(page)
  await select(page)
  await page.locator("#recognize-formulas").click()
  await expect(page.locator("#formula-status")).toContainText("本机识别未完成")
  await expect(page.locator("#copy-mixed")).toBeDisabled()
  await expect(page.locator("#formula-preview img")).toHaveCount(1)
  await expect(page.locator("#recognize-formulas")).toBeEnabled()
})
