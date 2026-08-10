import { forwardRef } from "react"
import {
  ChartDataSchema,
  ExtractedDataSchema,
  type ToolId,
  type ToolResult
} from "@focus-ui/shared"

const RESULT_TITLES: Readonly<Record<ToolId, string>> = {
  summarize: "AI总结",
  explain: "AI解释",
  ask: "AI回答",
  chart: "图表数据",
  extract: "提取结果",
  focus: "专注模式"
}

const SafeMarkdownText = ({ content }: { content: string }): React.JSX.Element => (
  <div className="focus-ui-result-text">
    {content.split(/\r?\n/u).map((line, index) => {
      const heading = /^(#{1,3})\s+(.+)$/u.exec(line)
      if (heading?.[2]) {
        return <h3 key={index}>{heading[2]}</h3>
      }
      if (/^[-*]\s+/u.test(line)) {
        return <p key={index} className="focus-ui-result-list-item">{line.replace(/^[-*]\s+/u, "")}</p>
      }
      return <p key={index}>{line || "\u00a0"}</p>
    })}
  </div>
)

const ChartDataView = ({ data }: { data: unknown }): React.JSX.Element | null => {
  const parsedData = ChartDataSchema.safeParse(data)
  if (!parsedData.success) {
    return null
  }

  return (
    <div className="focus-ui-structured-result">
      <h3>{parsedData.data.title}</h3>
      <dl className="focus-ui-chart-list">
        {parsedData.data.labels.map((label, index) => (
          <div key={`${label}-${index}`}>
            <dt>{label}</dt>
            <dd>
              {parsedData.data.values[index]}
              {parsedData.data.unit ?? ""}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const ExtractedDataView = ({ data }: { data: unknown }): React.JSX.Element | null => {
  const parsedData = ExtractedDataSchema.safeParse(data)
  if (!parsedData.success) {
    return null
  }

  return (
    <div className="focus-ui-structured-result">
      <h3>{parsedData.data.title}</h3>
      <div className="focus-ui-table-scroll">
        <table className="focus-ui-data-table">
          <thead>
            <tr><th>字段</th><th>值</th></tr>
          </thead>
          <tbody>
            {parsedData.data.items.map((item, index) => (
              <tr key={`${item.label}-${index}`}>
                <th>{item.label}</th>
                <td>{item.value === null ? "—" : String(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export type AIResultCardProps = {
  result: ToolResult
  onBack: () => void
  onClose: () => void
}

export const AIResultCard = forwardRef<HTMLDivElement, AIResultCardProps>(
  ({ result, onBack, onClose }, ref): React.JSX.Element => (
    <div ref={ref} className="focus-ui-message-card focus-ui-result-card" role="dialog" aria-label={RESULT_TITLES[result.toolId]}>
      <h2 className="focus-ui-result-title">{RESULT_TITLES[result.toolId]}</h2>
      {result.toolId === "chart" ? <ChartDataView data={result.data} /> : null}
      {result.toolId === "extract" ? <ExtractedDataView data={result.data} /> : null}
      {result.toolId !== "chart" && result.toolId !== "extract" ? (
        <SafeMarkdownText content={result.content} />
      ) : null}
      <div className="focus-ui-message-actions">
        <button className="focus-ui-message-button" type="button" onClick={onBack}>
          返回
        </button>
        <button className="focus-ui-message-button" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
)

AIResultCard.displayName = "AIResultCard"

