import { useEffect, useState } from "react"
import type { AppSettings } from "@attention-ui/shared"

type BehaviorPageProps = {
  settings: AppSettings | null
  onSave: (settings: AppSettings) => Promise<void>
  onResetPreferences: () => Promise<void>
}

const BehaviorPage = ({
  settings,
  onSave,
  onResetPreferences
}: BehaviorPageProps): JSX.Element => {
  const [draft, setDraft] = useState<AppSettings | null>(settings)
  const [delay, setDelay] = useState(settings?.attentionDelayMs.toString() ?? "900")
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isConfirmingReset, setIsConfirmingReset] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    setDraft(settings)
    setDelay(settings?.attentionDelayMs.toString() ?? "900")
  }, [settings])

  const save = async (): Promise<void> => {
    if (!draft) {
      return
    }

    const attentionDelayMs = Number(delay)
    if (!Number.isInteger(attentionDelayMs) || attentionDelayMs < 300 || attentionDelayMs > 3000) {
      setMessage("鼠标停留时间必须是 300 至 3000 毫秒之间的整数。")
      return
    }

    setIsSaving(true)
    setMessage(null)
    try {
      const nextSettings = { ...draft, attentionDelayMs }
      await onSave(nextSettings)
      setDraft(nextSettings)
      setMessage("交互设置已保存。")
    } catch (_error: unknown) {
      setMessage("保存失败，请稍后重试。")
    } finally {
      setIsSaving(false)
    }
  }

  const updateBoolean = (key: keyof Pick<AppSettings, "enableAI" | "enableLocalTools" | "enableFocusMode" | "enableHabitLearning">, value: boolean): void => {
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  const resetHabitData = async (): Promise<void> => {
    setIsResetting(true)
    setMessage(null)
    try {
      await onResetPreferences()
      setMessage("习惯数据已清除")
      setIsConfirmingReset(false)
    } catch (_error: unknown) {
      setMessage("清除失败，请稍后重试。")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">交互设置</p>
      <h2>关注与本地功能</h2>
      <p className="page-intro">调整工具出现的时机，让阅读更符合你的习惯。</p>
      <div className="settings-group"><div className="group-heading"><h3>关注时机</h3><span>自动工具条开启时生效</span></div><div className="form-grid ai-form">
        <label>
          鼠标停留时间（毫秒）
          <input
            aria-describedby="attention-delay-hint"
            max="3000"
            min="300"
            type="number"
            value={delay}
            onChange={(event): void => setDelay(event.target.value)}
          />
          <small id="attention-delay-hint">300–3000 毫秒。时间越长，工具条出现越从容。</small>
        </label>
      </div></div>
      <div className="toggle-list">
        <label><span className="toggle-copy"><strong>启用AI推荐</strong><small>根据内容推荐工具，各网站另有独立开关。</small></span><input aria-label="启用AI推荐" checked={draft?.enableAI ?? false} onChange={(event): void => updateBoolean("enableAI", event.target.checked)} type="checkbox" /></label>
        <label><span className="toggle-copy"><strong>启用本地工具</strong><small>通过本地规则选择适合当前内容的工具。</small></span><input aria-label="启用本地工具" checked={draft?.enableLocalTools ?? false} onChange={(event): void => updateBoolean("enableLocalTools", event.target.checked)} type="checkbox" /></label>
        <label><span className="toggle-copy"><strong>启用专注模式</strong><small>在独立阅读面板中查看正文。</small></span><input aria-label="启用专注模式" checked={draft?.enableFocusMode ?? false} onChange={(event): void => updateBoolean("enableFocusMode", event.target.checked)} type="checkbox" /></label>
        <label><span className="toggle-copy"><strong>启用习惯学习</strong><small>按本地工具使用记录逐步调整排序。</small></span><input aria-label="启用习惯学习" checked={draft?.enableHabitLearning ?? false} onChange={(event): void => updateBoolean("enableHabitLearning", event.target.checked)} type="checkbox" /></label>
      </div>
      {message ? <p className="notice" role="status">{message}</p> : null}
      <div className="button-row">
        <button disabled={!draft || isSaving} onClick={(): void => void save()} type="button">{isSaving ? "保存中…" : "保存交互设置"}</button>
        {!isConfirmingReset ? (
          <button
            className="secondary"
            disabled={isResetting}
            onClick={(): void => {
              setMessage(null)
              setIsConfirmingReset(true)
            }}
            type="button"
          >
            清除习惯数据
          </button>
        ) : null}
      </div>
      {isConfirmingReset ? (
        <div className="confirmation-panel" role="alertdialog" aria-label="确认清除习惯数据">
          <p>确定清除AttentionUI学习到的工具使用偏好吗？</p>
          <div className="button-row">
            <button
              disabled={isResetting}
              onClick={(): void => void resetHabitData()}
              type="button"
            >
              {isResetting ? "清除中…" : "确定清除"}
            </button>
            <button
              className="secondary"
              disabled={isResetting}
              onClick={(): void => setIsConfirmingReset(false)}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default BehaviorPage
