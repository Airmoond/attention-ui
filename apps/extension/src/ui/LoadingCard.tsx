import { forwardRef } from "react"
import type { ToolId } from "@focus-ui/shared"

const LOADING_LABELS: Readonly<Record<ToolId, string>> = {
  summarize: "正在生成AI总结…",
  explain: "正在生成AI解释…",
  ask: "正在回答问题…",
  chart: "正在生成图表数据…",
  extract: "正在提取结构化数据…",
  focus: "正在打开专注模式…"
}

export type LoadingCardProps = {
  toolId: ToolId
  onClose: () => void
}

export const LoadingCard = forwardRef<HTMLDivElement, LoadingCardProps>(
  ({ toolId, onClose }, ref): React.JSX.Element => (
    <div ref={ref} className="focus-ui-message-card" role="status" aria-live="polite">
      <div className="focus-ui-loading-row">
        <span className="focus-ui-loading-dot" aria-hidden="true" />
        <p className="focus-ui-message-text">{LOADING_LABELS[toolId]}</p>
      </div>
      <div className="focus-ui-message-actions">
        <button className="focus-ui-message-button" type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
)

LoadingCard.displayName = "LoadingCard"
