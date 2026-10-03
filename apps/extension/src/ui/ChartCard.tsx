import { BarChart, LineChart } from "echarts/charts"
import { GridComponent, TitleComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { init, use, type EChartsCoreOption } from "echarts/core"
import { useEffect, useRef } from "react"
import type { ChartData } from "@attention-ui/shared"

use([BarChart, LineChart, GridComponent, TitleComponent, TooltipComponent, CanvasRenderer])

export const createChartOption = (data: ChartData): EChartsCoreOption => ({
  animation: false,
  aria: { enabled: true, decal: { show: true } },
  grid: { top: 24, right: 18, bottom: 42, left: 58, containLabel: true },
  tooltip: {
    trigger: "axis",
    valueFormatter: (value: unknown): string => `${String(value)}${data.unit ?? ""}`
  },
  xAxis: {
    type: "category",
    data: data.labels,
    axisLabel: { color: "#62626b", interval: 0 },
    axisLine: { lineStyle: { color: "#e6e6eb" } },
    axisTick: { show: false }
  },
  yAxis: {
    type: "value",
    name: data.unit ?? "",
    nameTextStyle: { color: "#62626b" },
    axisLabel: { color: "#62626b" },
    splitLine: { lineStyle: { color: "#e6e6eb", type: "dashed" } }
  },
  series: [
    data.chartType === "line"
      ? {
          type: "line",
          data: data.values,
          smooth: true,
          symbolSize: 8,
          lineStyle: { color: "#0066d6", width: 3 },
          itemStyle: { color: "#0066d6" },
          areaStyle: { color: "rgba(0, 102, 214, 0.07)" }
        }
      : {
          type: "bar",
          data: data.values,
          barMaxWidth: 54,
          itemStyle: { color: "#0066d6", borderRadius: [5, 5, 0, 0] }
        }
  ]
})

export type ChartCardProps = { data: ChartData }

export const ChartCard = ({ data }: ChartCardProps): React.JSX.Element => {
  const chartElementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const chartElement = chartElementRef.current
    if (!chartElement) {
      return
    }

    const chart = init(chartElement, undefined, { renderer: "canvas" })
    chart.setOption(createChartOption(data))
    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(chartElement)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
    }
  }, [data])

  return (
    <div className="attention-ui-structured-result">
      <h3>{data.title}</h3>
      <div
        ref={chartElementRef}
        className="attention-ui-chart-canvas"
        role="img"
        aria-label={`${data.title}，${data.chartType === "bar" ? "柱状图" : "折线图"}`}
      />
      <dl className="attention-ui-chart-list" aria-label="图表数据明细">
        {data.labels.map((label, index) => (
          <div key={`${label}-${index}`}>
            <dt>{label}</dt>
            <dd>{data.values[index]}{data.unit ?? ""}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
