import { forwardRef } from "react"

export type ErrorCardProps = {
  message: string
  onRetry?: () => void
  onBack: () => void
  onClose: () => void
}

export const ErrorCard = forwardRef<HTMLDivElement, ErrorCardProps>(
  ({ message, onRetry, onBack, onClose }, ref): React.JSX.Element => (
    <div ref={ref} className="focus-ui-message-card" role="status" aria-live="polite">
      <p className="focus-ui-message-text">{message}</p>
      <div className="focus-ui-message-actions">
        {onRetry ? (
          <button className="focus-ui-message-button" type="button" onClick={onRetry}>
            重试
          </button>
        ) : null}
        <button
          className="focus-ui-message-button"
          type="button"
          aria-label="返回FocusUI工具条"
          title="返回"
          onClick={onBack}
        >
          返回
        </button>
        <button
          className="focus-ui-message-button"
          type="button"
          aria-label="关闭FocusUI消息"
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
