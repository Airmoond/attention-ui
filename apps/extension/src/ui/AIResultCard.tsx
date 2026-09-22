import { forwardRef, type ReactNode } from "react"
import {
  ChartDataSchema,
  ExtractedDataSchema,
  type ToolId,
  type ToolResult
} from "@focus-ui/shared"
import { ChartCard } from "./ChartCard"

const RESULT_TITLES: Readonly<Record<ToolId, string>> = {
  summarize: "AI总结",
  explain: "AI解释",
  ask: "AI回答",
  chart: "图表数据",
  extract: "提取结果",
  focus: "专注模式"
}

const renderInlineMarkdown = (content: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/gu
  let previousIndex = 0
  let tokenIndex = 0

  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > previousIndex) {
      nodes.push(content.slice(previousIndex, index))
    }

    const token = match[0]
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${tokenIndex}`}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{token.slice(1, -1)}</code>)
    }
    previousIndex = index + token.length
    tokenIndex += 1
  }

  if (previousIndex < content.length) {
    nodes.push(content.slice(previousIndex))
  }
  return nodes
}

const splitMarkdownTableRow = (line: string): string[] =>
  line.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|").map((cell) => cell.trim())

const isMarkdownTableDivider = (line: string): boolean => {
  const cells = splitMarkdownTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell))
}

const SafeMarkdownText = ({ content }: { content: string }): React.JSX.Element => {
  const lines = content.split(/\r?\n/u)
  const blocks: ReactNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const nextLine = lines[index + 1]
    if (line.includes("|") && nextLine && isMarkdownTableDivider(nextLine)) {
      const headers = splitMarkdownTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitMarkdownTableRow(lines[index] ?? ""))
        index += 1
      }
      index -= 1
      blocks.push(
        <div className="focus-ui-table-scroll" key={`table-${index}`}>
          <table className="focus-ui-data-table focus-ui-markdown-table">
            <thead>
              <tr>{headers.map((cell, cellIndex) => <th key={`head-${cellIndex}`}>{renderInlineMarkdown(cell, `head-${cellIndex}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      {renderInlineMarkdown(row[cellIndex] ?? "", `cell-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/u.exec(line)
    if (heading?.[2]) {
      blocks.push(<h3 key={`heading-${index}`}>{renderInlineMarkdown(heading[2], `heading-${index}`)}</h3>)
      continue
    }

    const bullet = /^[-*]\s+(.+)$/u.exec(line)
    if (bullet?.[1]) {
      blocks.push(
        <p key={`bullet-${index}`} className="focus-ui-result-list-item">
          {renderInlineMarkdown(bullet[1], `bullet-${index}`)}
        </p>
      )
      continue
    }

    blocks.push(
      <p key={`paragraph-${index}`}>
        {line ? renderInlineMarkdown(line, `paragraph-${index}`) : "\u00a0"}
      </p>
    )
  }

  return <div className="focus-ui-result-text">{blocks}</div>
}

const ChartDataView = ({ data }: { data: unknown }): React.JSX.Element | null => {
  const parsedData = ChartDataSchema.safeParse(data)
  if (!parsedData.success) {
    return null
  }

  return <ChartCard data={parsedData.data} />
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
