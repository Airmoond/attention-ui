import type { FocusReaderBlock, FocusReaderContent } from "../context/focus-content-extractor"
import { Icon } from "./Icon"
import { useRef } from "react"

export type FocusReaderProps = {
  content: FocusReaderContent
  onClose: () => void
}

const ReaderBlock = ({ block }: { block: FocusReaderBlock }): React.JSX.Element => {
  switch (block.type) {
    case "heading":
      if (block.level === 3) {
        return <h3 className="attention-ui-reader-heading attention-ui-reader-heading-3">{block.text}</h3>
      }
      return <h2 className="attention-ui-reader-heading">{block.text}</h2>
    case "quote":
      return <blockquote className="attention-ui-reader-quote">{block.text}</blockquote>
    case "list-item":
      return <p className="attention-ui-reader-list-item">{block.text}</p>
    case "code":
      return (
        <pre className="attention-ui-reader-code">
          <code>{block.text}</code>
        </pre>
      )
    case "paragraph":
      return <p className="attention-ui-reader-paragraph">{block.text}</p>
  }
}

export const FocusReader = ({ content, onClose }: FocusReaderProps): React.JSX.Element => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  return <div className="attention-ui-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="attention-ui-reader-title" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onClose() }
    if (event.key === "Tab") {
      event.preventDefault()
      // The dialog has two keyboard stops: close and the scrollable reading body.
      if (event.target === closeRef.current) contentRef.current?.focus()
      else closeRef.current?.focus()
    }
  }}>
    <article className="attention-ui-reader-panel">
      <header className="attention-ui-reader-header">
        <h1 id="attention-ui-reader-title" className="attention-ui-reader-title">
          {content.title}
        </h1>
        <button
          ref={closeRef}
          autoFocus
          className="attention-ui-reader-close"
          type="button"
          aria-label="关闭AttentionUI专注阅读"
          title="关闭"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div ref={contentRef} tabIndex={0} aria-label="阅读正文" className="attention-ui-reader-content">
        {content.blocks.map((block, index) => (
          <ReaderBlock key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </article>
  </div>
}
