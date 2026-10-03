import { forwardRef } from "react"

export type ErrorCardProps = {
  message: string
  onRetry?: () => void
  onBack: () => void
  onClose: () => void
}

export const ErrorCard = forwardRef<HTMLDivElement, ErrorCardProps>(
  ({ message, onRetry, onBack, onClose }, ref): React.JSX.Element => (
    <div ref={ref} className="attention-ui-message-card" role="status" aria-live="polite">
      <p className="attention-ui-message-text">{message}</p>
      <div className="attention-ui-message-actions">
        {onRetry ? (
          <button className="attention-ui-message-button" type="button" onClick={onRetry}>
            重试
          </button>
        ) : null}
        <button
          className="attention-ui-message-button"
          type="button"
          aria-label="返回AttentionUI工具条"
          title="返回"
          onClick={onBack}
        >
          返回
        </button>
        <button
          className="attention-ui-message-button"
          type="button"
          aria-label="关闭AttentionUI消息"
          title="关闭"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  )
)

ErrorCard.displayName = "ErrorCard"
