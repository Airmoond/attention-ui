import { useCallback, useEffect, useState } from "react"
import type { LogEntry } from "@focus-ui/shared"

const LogsPage = (): JSX.Element => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshLogs = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setMessage(null)
    try {
      setLogs(await window.focusUI.getLogs())
    } catch (_error: unknown) {
      setMessage("无法读取日志，请稍后重试。")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshLogs()
  }, [refreshLogs])

  const clearLogs = async (): Promise<void> => {
    setMessage(null)
    try {
      await window.focusUI.clearLogs()
      setLogs([])
      setMessage("日志已清空。")
    } catch (_error: unknown) {
      setMessage("清空日志失败，请稍后重试。")
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">调试日志</p>
      <h2>安全诊断日志</h2>
      <p className="page-intro">仅保留本次运行最近100条安全事件，重启后自动清空。</p>
      <div className="button-row">
        <button disabled={isLoading} onClick={(): void => void refreshLogs()} type="button">
          {isLoading ? "刷新中…" : "刷新"}
        </button>
        <button className="secondary" disabled={isLoading || logs.length === 0} onClick={(): void => void clearLogs()} type="button">
          清空
        </button>
      </div>
      {message ? <p className="notice">{message}</p> : null}
      {!isLoading && logs.length === 0 ? (
        <div className="empty-state">当前没有日志。</div>
      ) : (
        <div className="log-list" aria-label="FocusUI安全日志">
          {[...logs].reverse().map((entry) => (
            <article className={`log-entry log-${entry.level}`} key={entry.id}>
              <div className="log-entry-header">
                <time dateTime={new Date(entry.timestamp).toISOString()}>
                  {new Date(entry.timestamp).toLocaleString()}
                </time>
                <span>{entry.level}</span>
                <strong>{entry.event}</strong>
              </div>
              <p>{entry.message}</p>
              {entry.metadata ? (
                <dl>
                  {Object.entries(entry.metadata).map(([key, value]) => (
                    <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>
                  ))}
                </dl>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default LogsPage
