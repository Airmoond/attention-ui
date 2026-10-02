import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const demoDirectory = resolve(process.cwd(), "../../demo-pages")
const quickStartFile = resolve(process.cwd(), "../../QUICK_START.html")
const readDemo = (name: string): string =>
  readFileSync(resolve(demoDirectory, name), "utf8")

describe("production demo pages", () => {
  it("provides a self-contained beginner guide for the packaged release", () => {
    const guide = readFileSync(quickStartFile, "utf8")
    expect(guide).toContain("FocusUI 0.1.1 学生测试版")
    expect(guide).toContain("chrome://extensions")
    expect(guide).toContain("加载已解压的扩展程序")
    expect(guide).toContain("http://127.0.0.1:17321/demo/article.html")
    expect(guide).toContain("http://127.0.0.1:17321/demo/finance.html")
    expect(guide).not.toMatch(/<script\b/iu)
    expect(guide).not.toMatch(/\bsrc=["']https?:\/\//iu)
    const linkedAddresses = Array.from(
      guide.matchAll(/\bhref=["'](https?:\/\/[^"']+)["']/giu),
      (match) => match[1] ?? ""
    )
    expect(linkedAddresses).toContain("http://127.0.0.1:17321/demo/article.html")
    expect(linkedAddresses).toContain("http://127.0.0.1:17321/demo/finance.html")
    expect(guide).toContain("启用此网站")
    expect(guide).toContain("Alt + Shift + F")
    expect(guide).toContain("自动 AI 工具推荐")
    expect(guide).toContain("反馈")
  })

  it("stay offline, deterministic, and script-free", () => {
    for (const name of ["article.html", "finance.html", "dashboard.html", "styles.css"]) {
      const content = readDemo(name)
      expect(content.length).toBeGreaterThan(500)
      expect(content).not.toMatch(/<script\b/iu)
      expect(content).not.toMatch(/https?:\/\//iu)
      expect(content).not.toContain("Math.random")
    }
  })

  it("provides a semantic long article without reading the sidebar input", () => {
    const article = readDemo("article.html")
    expect(article).toMatch(/<main[\s\S]*<article/iu)
    expect(article.match(/<p\b/giu)?.length ?? 0).toBeGreaterThanOrEqual(8)
    expect(article).toContain("<blockquote>")
    expect(article).toMatch(/<span[^>]*>[\s\S]*<span>/iu)
    expect(article).toMatch(/<aside[\s\S]*<input[^>]+type="search"/iu)
  })

  it("keeps finance labels, values, and units explicit", () => {
    const finance = readDemo("finance.html")
    expect(finance).toContain("2023年营收为80亿元")
    expect(finance).toContain("2024年营收为105亿元")
    expect(finance).toContain("2025年营收为136亿元")
    expect(finance).toContain("Q1利润12亿元")
    expect(finance).toContain("Q4利润29亿元")
    expect(finance).toContain("2023年用户增长率为18.2%")
    expect(finance).toContain("2025年用户增长率为31.4%")
    expect(finance).toMatch(/<table[\s\S]*<tbody/iu)
  })

  it("provides dashboard edge, control, nesting, and large-container fixtures", () => {
    const dashboard = readDemo("dashboard.html")
    for (const marker of ["页面顶部测试区", "页面底部测试区", "页面左侧测试区", "页面右侧测试区", "页面中央测试区"]) {
      expect(dashboard).toContain(marker)
    }
    expect(dashboard).toContain('class="large-container"')
    expect(dashboard).toMatch(/<span[^>]*>[\s\S]*<span>/iu)
    expect(dashboard).toMatch(/<button\b/iu)
    expect(dashboard).toMatch(/<input[^>]+type="search"/iu)
  })
})
