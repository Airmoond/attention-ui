import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AIResultCard } from "./AIResultCard"

const renderResult = (result: Parameters<typeof AIResultCard>[0]["result"]): string =>
  renderToStaticMarkup(
    <AIResultCard result={result} onBack={() => undefined} onClose={() => undefined} />
  )

describe("AI result card", () => {
  it("renders summary Markdown as escaped React content", () => {
    const markup = renderResult({
      toolId: "summarize",
      success: true,
      content: "# 结论\n- 保留关键数字 <script>alert(1)</script>"
    })

    expect(markup).toContain("AI总结")
    expect(markup).toContain("结论")
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(markup).not.toContain("<script>")
  })

  it("renders validated chart data as a simple list", () => {
    const markup = renderResult({
      toolId: "chart",
      success: true,
      content: "已生成结构化图表数据",
      data: {
        title: "年度营收",
        labels: ["2024", "2025"],
        values: [100, 120],
        unit: "亿元"
      }
    })

    expect(markup).toContain("图表数据")
    expect(markup).toContain("2024")
    expect(markup).toContain("100亿元")
    expect(markup).toContain("120亿元")
  })

  it("renders extracted JSON data as a table", () => {
    const markup = renderResult({
      toolId: "extract",
      success: true,
      content: "已提取结构化数据",
      data: {
        title: "指标",
        items: [
          { label: "营收", value: 120 },
          { label: "单位", value: "亿元" }
        ]
      }
    })

    expect(markup).toContain("<table")
    expect(markup).toContain("营收")
    expect(markup).toContain("亿元")
  })
})

