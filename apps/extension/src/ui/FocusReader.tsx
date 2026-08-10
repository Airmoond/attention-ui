import type { FocusReaderBlock, FocusReaderContent } from "../context/focus-content-extractor"

export type FocusReaderProps = {
  content: FocusReaderContent
  onClose: () => void
}

const ReaderBlock = ({ block }: { block: FocusReaderBlock }): React.JSX.Element => {
  switch (block.type) {
    case "heading":
      if (block.level === 3) {
        return <h3 className="focus-ui-reader-heading focus-ui-reader-heading-3">{block.text}</h3>
      }
      return <h2 className="focus-ui-reader-heading">{block.text}</h2>
    case "quote":
      return <blockquote className="focus-ui-reader-quote">{block.text}</blockquote>
    case "list-item":
      return <p className="focus-ui-reader-list-item">{block.text}</p>
    case "code":
      return (
        <pre className="focus-ui-reader-code">
          <code>{block.text}</code>
        </pre>
      )
    case "paragraph":
      return <p className="focus-ui-reader-paragraph">{block.text}</p>
  }
}

export const FocusReader = ({ content, onClose }: FocusReaderProps): React.JSX.Element => (
  <div className="focus-ui-reader-overlay" role="dialog" aria-modal="true" aria-labelledby="focus-ui-reader-title">
    <article className="focus-ui-reader-panel">
      <header className="focus-ui-reader-header">
        <h1 id="focus-ui-reader-title" className="focus-ui-reader-title">
          {content.title}
        </h1>
        <button
          className="focus-ui-reader-close"
          type="button"
          aria-label="关闭FocusUI专注阅读"
          title="关闭"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="focus-ui-reader-content">
        {content.blocks.map((block, index) => (
          <ReaderBlock key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </article>
  </div>
)
