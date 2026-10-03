import { forwardRef, useState } from "react"

export type AskBoxProps = {
  onSubmit: (question: string) => void
  onBack: () => void
  onClose: () => void
}

export const AskBox = forwardRef<HTMLDivElement, AskBoxProps>(
  ({ onSubmit, onBack, onClose }, ref): React.JSX.Element => {
    const [question, setQuestion] = useState("")
    const normalizedQuestion = question.trim()

    return (
      <div ref={ref} className="attention-ui-message-card" role="dialog" aria-label="围绕当前内容提问">
        <h2 className="attention-ui-result-title">向当前内容提问</h2>
        <textarea
          className="attention-ui-ask-input"
          value={question}
          maxLength={500}
          rows={4}
          autoFocus
          aria-label="问题"
          placeholder="输入你想了解的问题"
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && normalizedQuestion) {
              onSubmit(normalizedQuestion)
            }
          }}
        />
        <p className="attention-ui-input-hint">最多500字，Ctrl/⌘ + Enter发送</p>
        <div className="attention-ui-message-actions">
          <button className="attention-ui-message-button" type="button" onClick={onBack}>
            返回
          </button>
          <button
            className="attention-ui-message-button primary"
            type="button"
            disabled={!normalizedQuestion}
            onClick={() => onSubmit(normalizedQuestion)}
          >
            发送
          </button>
          <button className="attention-ui-message-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    )
  }
)

AskBox.displayName = "AskBox"
