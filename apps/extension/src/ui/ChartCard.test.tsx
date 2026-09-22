import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChartCard, createChartOption } from "./ChartCard"

const chartData = {
  title: "用户增长率",
  chartType: "line" as const,
  labels: ["2023年", "2024年", "2025年"],
  values: [18.2, 24.6, 31.4],
  unit: "%"
}

describe("ChartCard", () => {
  it("creates a fixed line chart option from validated data", () => {
    const option = createChartOption(chartData)
    expect(option.xAxis).toMatchObject({ type: "category", data: chartData.labels })
    expect(option.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "line", data: chartData.values })])
    )
  })

  it("renders an accessible canvas target and exact fallback values", () => {
    const markup = renderToStaticMarkup(<ChartCard data={chartData} />)
    expect(markup).toContain('role="img"')
    expect(markup).toContain("折线图")
    expect(markup).toContain("2025年")
    expect(markup).toContain("31.4%")
  })
})
